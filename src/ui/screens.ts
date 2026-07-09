import { renderMatch } from "../render/canvas";
import { TICKS_PER_SECOND } from "../sim/constants";
import { createMatch, heroClassIds, resultFromState } from "../sim";
import type { MatchResult, TraitProfile } from "../sim";
import { requiredButton, requiredCanvas, requiredElement, requiredInput } from "./dom";
import { screenMarkup } from "./markup";
import { renderRanking, updateMirror } from "./runHud";
import { loadSave, storeSave } from "./save";
import type { GuildSave } from "./save";

type RunSession = {
  match: ReturnType<typeof createMatch>;
  animationFrame: number | undefined;
  lastFrameTime: number | undefined;
  accumulatorMs: number;
  lastMirrorTime: number;
};

const tickMs = 1000 / TICKS_PER_SECOND;

export function bootGhostGuild(documentRef: Document, windowRef: Window): void {
  const app = requiredElement(documentRef, "app");
  app.innerHTML = screenMarkup();

  const params = new URLSearchParams(windowRef.location.search);
  const fixedSeed = parseSeed(params.get("seed"));
  const fastMode = params.get("fast") === "1";
  const autoplay = params.get("autoplay") === "1";
  const controller = createScreenController(documentRef, windowRef, fixedSeed, fastMode);
  controller.renderGuild();

  if (autoplay) {
    controller.deploySolo();
  }
}

function createScreenController(
  documentRef: Document,
  windowRef: Window,
  fixedSeed: number | undefined,
  fastMode: boolean,
): { renderGuild(): void; deploySolo(): void } {
  let save = loadSave(windowRef.localStorage);
  let session: RunSession | undefined;
  let autorunTimer: number | undefined;

  const canvas = requiredCanvas(documentRef, "run-canvas");
  const guildScreen = requiredElement(documentRef, "screen-guild");
  const runScreen = requiredElement(documentRef, "screen-run");
  const resultsScreen = requiredElement(documentRef, "screen-results");
  const gameState = requiredElement(documentRef, "game-state");

  const braveryInput = requiredInput(documentRef, "trait-bravery");
  const greedInput = requiredInput(documentRef, "trait-greed");
  const focusInput = requiredInput(documentRef, "trait-focus");
  const deploySoloButton = requiredButton(documentRef, "deploy-solo");
  const autorunButton = requiredButton(documentRef, "toggle-autorun");
  const backButton = requiredButton(documentRef, "back-to-guild");

  for (const classId of heroClassIds) {
    requiredButton(documentRef, `class-${classId}`).addEventListener("click", () => {
      save = { ...save, classId };
      persist(windowRef, save);
      renderGuild();
    });
  }

  const traitInputs = [
    { input: braveryInput, id: "bravery" },
    { input: greedInput, id: "greed" },
    { input: focusInput, id: "focus" },
  ];
  for (const entry of traitInputs) {
    entry.input.addEventListener("input", () => {
      save = { ...save, traits: updateTrait(save.traits, entry.id, Number(entry.input.value)) };
      persist(windowRef, save);
      renderGuild();
    });
  }

  deploySoloButton.addEventListener("click", () => deploySolo());
  autorunButton.addEventListener("click", () => {
    save = { ...save, autorun: !save.autorun };
    persist(windowRef, save);
    renderGuild();
  });
  backButton.addEventListener("click", () => {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    renderGuild();
    setScreen(guildScreen, runScreen, resultsScreen, "guild");
  });

  function renderGuild(): void {
    braveryInput.value = String(save.traits.bravery);
    greedInput.value = String(save.traits.greed);
    focusInput.value = String(save.traits.focus);
    requiredElement(documentRef, "trait-bravery-value").textContent = String(save.traits.bravery);
    requiredElement(documentRef, "trait-greed-value").textContent = String(save.traits.greed);
    requiredElement(documentRef, "trait-focus-value").textContent = String(save.traits.focus);
    requiredElement(documentRef, "gold-amount").textContent = String(Math.floor(save.gold));
    autorunButton.textContent = save.autorun ? "AUTO-RUN ON" : "AUTO-RUN OFF";
    autorunButton.setAttribute("aria-pressed", save.autorun ? "true" : "false");

    for (const classId of heroClassIds) {
      const button = requiredButton(documentRef, `class-${classId}`);
      button.classList.toggle("selected", save.classId === classId);
    }
  }

  function deploySolo(): void {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    const seed = fixedSeed ?? save.nextSeed;
    if (fixedSeed === undefined) {
      save = { ...save, nextSeed: save.nextSeed + 1 };
      persist(windowRef, save);
    }

    const match = createMatch({
      seed,
      heroes: [
        {
          classId: save.classId,
          traits: save.traits,
        },
      ],
    });
    session = {
      match,
      animationFrame: undefined,
      lastFrameTime: undefined,
      accumulatorMs: 0,
      lastMirrorTime: 0,
    };

    setScreen(guildScreen, runScreen, resultsScreen, "run");
    updateMirror(documentRef, gameState, match.state);
    renderMatch(canvas, match.state);

    if (fastMode) {
      runFast(match);
      return;
    }

    session.animationFrame = windowRef.requestAnimationFrame(runFrame);
  }

  function runFast(match: ReturnType<typeof createMatch>): void {
    let guard = 30000;
    while (match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
    }
    renderMatch(canvas, match.state);
    updateMirror(documentRef, gameState, match.state);
    showResults(resultFromState(match.state));
  }

  function runFrame(time: number): void {
    if (session === undefined) {
      return;
    }

    if (session.lastFrameTime === undefined) {
      session.lastFrameTime = time;
    }

    session.accumulatorMs += Math.min(120, time - session.lastFrameTime);
    session.lastFrameTime = time;
    while (session.accumulatorMs >= tickMs && session.match.state.phase !== "finished") {
      session.match.step();
      session.accumulatorMs -= tickMs;
    }

    renderMatch(canvas, session.match.state);
    if (time - session.lastMirrorTime >= 500) {
      updateMirror(documentRef, gameState, session.match.state);
      session.lastMirrorTime = time;
    }

    if (session.match.state.phase === "finished") {
      updateMirror(documentRef, gameState, session.match.state);
      showResults(resultFromState(session.match.state));
      return;
    }

    session.animationFrame = windowRef.requestAnimationFrame(runFrame);
  }

  function showResults(result: MatchResult): void {
    const primary = result.heroes.find((hero) => hero.heroId === 1) ?? result.heroes[0];
    if (primary === undefined) {
      return;
    }

    save = { ...save, gold: save.gold + primary.gold };
    persist(windowRef, save);
    requiredElement(documentRef, "result-score").textContent = String(primary.score);
    requiredElement(documentRef, "result-rank").textContent = String(primary.rank);
    requiredElement(documentRef, "result-kills").textContent = String(primary.kills);
    requiredElement(documentRef, "result-time").textContent = `${primary.survivedSeconds}s`;
    requiredElement(documentRef, "result-gold-earned").textContent = String(primary.gold);
    renderRanking(documentRef, result);
    setScreen(guildScreen, runScreen, resultsScreen, "results");
    session = undefined;

    if (save.autorun) {
      autorunTimer = windowRef.setTimeout(() => deploySolo(), 4000);
    }
  }

  return { renderGuild, deploySolo };
}

function updateTrait(traits: TraitProfile, id: string, value: number): TraitProfile {
  const nextValue = Math.max(0, Math.min(100, Math.round(value)));
  switch (id) {
    case "bravery":
      return { ...traits, bravery: nextValue };
    case "greed":
      return { ...traits, greed: nextValue };
    case "focus":
      return { ...traits, focus: nextValue };
    default:
      return traits;
  }
}

function setScreen(guild: HTMLElement, run: HTMLElement, results: HTMLElement, visible: "guild" | "run" | "results"): void {
  guild.classList.toggle("hidden", visible !== "guild");
  run.classList.toggle("hidden", visible !== "run");
  results.classList.toggle("hidden", visible !== "results");
}

function parseSeed(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const seed = Number.parseInt(value, 10);
  return Number.isFinite(seed) ? seed : undefined;
}

function persist(windowRef: Window, save: GuildSave): void {
  storeSave(windowRef.localStorage, save);
}

function clearAutorun(windowRef: Window, timer: number | undefined): void {
  if (timer !== undefined) {
    windowRef.clearTimeout(timer);
  }
}
