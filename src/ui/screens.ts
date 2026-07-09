import { renderMatch } from "../render/canvas";
import { TICKS_PER_SECOND } from "../sim/constants";
import { createMatch, heroClassIds, resultFromState } from "../sim";
import type { MatchResult } from "../sim";
import { ignoreExpectedApiError } from "./arenaApi";
import type { ServerLoadout } from "./arenaApi";
import { createArenaRunPlan } from "./arenaRun";
import { leaderboardFromResult, submitArenaResult } from "./arenaResults";
import { requiredButton, requiredCanvas, requiredElement, requiredInput } from "./dom";
import { renderGuildView, traitInputEntries, updateTrait } from "./guildView";
import { screenMarkup } from "./markup";
import { classUnlockCosts, currentLoadout, nextUpgradeCost, permStatUpgrades } from "./meta";
import { renderLeaderboard, renderRanking, updateMirror } from "./runHud";
import { loadSave } from "./save";
import { clearAutorun, parseSeed, persist, setVisibleScreen } from "./screenUtils";

type RunMode = "solo" | "arena";

type RunSession = {
  match: ReturnType<typeof createMatch>;
  mode: RunMode;
  serverLoadout: ServerLoadout | undefined;
  animationFrame: number | undefined;
  lastFrameTime: number | undefined;
  accumulatorMs: number;
  lastMirrorTime: number;
};

type RunStart = {
  readonly match: ReturnType<typeof createMatch>;
  readonly mode: RunMode;
  readonly arenaOffline: boolean;
  readonly serverLoadout: ServerLoadout | undefined;
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
  const screenElements = { guild: guildScreen, run: runScreen, results: resultsScreen };
  const gameState = requiredElement(documentRef, "game-state");

  const braveryInput = requiredInput(documentRef, "trait-bravery");
  const greedInput = requiredInput(documentRef, "trait-greed");
  const focusInput = requiredInput(documentRef, "trait-focus");
  const deploySoloButton = requiredButton(documentRef, "deploy-solo");
  const deployArenaButton = requiredButton(documentRef, "deploy-arena");
  const autorunButton = requiredButton(documentRef, "toggle-autorun");
  const backButton = requiredButton(documentRef, "back-to-guild");
  const guildControls = { braveryInput, greedInput, focusInput, autorunButton };

  for (const classId of heroClassIds) {
    requiredButton(documentRef, `class-${classId}`).addEventListener("click", () => {
      if (save.unlockedClasses[classId]) {
        save = { ...save, classId };
      } else {
        const cost = classUnlockCosts[classId];
        if (save.gold < cost) {
          return;
        }
        save = {
          ...save,
          gold: save.gold - cost,
          classId,
          unlockedClasses: { ...save.unlockedClasses, [classId]: true },
        };
      }
      persist(windowRef, save);
      renderGuild();
    });
  }

  for (const upgrade of permStatUpgrades) {
    requiredButton(documentRef, `buy-${upgrade.id}`).addEventListener("click", () => {
      const owned = save.permStats[upgrade.id];
      const cost = nextUpgradeCost(upgrade.id, owned);
      if (save.gold < cost) {
        return;
      }

      save = {
        ...save,
        gold: save.gold - cost,
        permStats: { ...save.permStats, [upgrade.id]: owned + 1 },
      };
      persist(windowRef, save);
      renderGuild();
    });
  }

  for (const entry of traitInputEntries(guildControls)) {
    entry.input.addEventListener("input", () => {
      save = { ...save, traits: updateTrait(save.traits, entry.id, Number(entry.input.value)) };
      persist(windowRef, save);
      renderGuild();
    });
  }

  deploySoloButton.addEventListener("click", () => deploySolo());
  deployArenaButton.addEventListener("click", () => {
    void deployArena();
  });
  autorunButton.addEventListener("click", () => {
    save = { ...save, autorun: !save.autorun };
    persist(windowRef, save);
    renderGuild();
  });
  backButton.addEventListener("click", () => {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    renderGuild();
    setVisibleScreen(screenElements, "guild");
  });

  function renderGuild(): void {
    renderGuildView(documentRef, save, guildControls);
  }

  function deploySolo(): void {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    const match = createMatch({
      seed: consumeLocalSeed(),
      heroes: [currentLoadout(save)],
    });
    startRun({ match, mode: "solo", arenaOffline: false, serverLoadout: undefined });
  }

  async function deployArena(): Promise<void> {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;

    const arenaRun = await createArenaRunPlan(save, fixedSeed, consumeLocalSeed);
    const match = createMatch({
      seed: arenaRun.seed,
      heroes: arenaRun.heroes,
    });
    startRun({ match, mode: "arena", arenaOffline: arenaRun.offline, serverLoadout: arenaRun.serverLoadout });
  }

  function startRun(input: RunStart): void {
    session = {
      match: input.match,
      mode: input.mode,
      serverLoadout: input.serverLoadout,
      animationFrame: undefined,
      lastFrameTime: undefined,
      accumulatorMs: 0,
      lastMirrorTime: 0,
    };

    setVisibleScreen(screenElements, "run");
    requiredElement(documentRef, "arena-offline-badge").classList.toggle("hidden", !input.arenaOffline);
    updateMirror(documentRef, gameState, input.match.state);
    renderMatch(canvas, input.match.state);

    if (fastMode) {
      runFast(input.match);
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
    finishRun(resultFromState(match.state));
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
      finishRun(resultFromState(session.match.state));
      return;
    }

    session.animationFrame = windowRef.requestAnimationFrame(runFrame);
  }

  function finishRun(result: MatchResult): void {
    if (session === undefined) {
      return;
    }

    showResults(result, session.mode, session.serverLoadout);
  }

  function showResults(result: MatchResult, mode: RunMode, serverLoadout: ServerLoadout | undefined): void {
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
    renderRanking(documentRef, result, primary.heroId);
    renderLeaderboard(documentRef, mode === "arena" ? leaderboardFromResult(result) : []);
    setVisibleScreen(screenElements, "results");
    session = undefined;

    if (mode === "arena" && serverLoadout !== undefined) {
      void submitArenaResult(documentRef, serverLoadout, primary, result).catch(ignoreExpectedApiError);
    }

    if (mode === "solo" && save.autorun) {
      autorunTimer = windowRef.setTimeout(() => deploySolo(), 4000);
    }
  }

  function consumeLocalSeed(): number {
    const seed = fixedSeed ?? save.nextSeed;
    if (fixedSeed === undefined) {
      save = { ...save, nextSeed: save.nextSeed + 1 };
      persist(windowRef, save);
    }
    return seed;
  }

  return { renderGuild, deploySolo };
}
