import { renderMatch } from "../render/canvas";
import { startPixelSpriteLoad } from "../render/pixelSprites";
import { TICKS_PER_SECOND } from "../sim/constants";
import { createMatch, resultFromState } from "../sim";
import type { MatchResult } from "../sim";
import { createAudioEngine } from "./audio";
import { createMatchSoundObserver } from "./audioEvents";
import { fetchLeaderboard, ignoreExpectedApiError } from "./arenaApi";
import type { ServerLoadout } from "./arenaApi";
import { createArenaRunPlan } from "./arenaRun";
import { leaderboardFromResult, submitArenaResult } from "./arenaResults";
import { requiredButton, requiredCanvas, requiredElement } from "./dom";
import { wireGuildInteractions } from "./guildInteractions";
import { renderGuildView } from "./guildView";
import { createLobbyStage } from "./lobbyStage";
import { addLootToStash, inventoryFromSave } from "./inventory";
import { screenMarkup } from "./markup";
import { currentLoadout } from "./meta";
import { renderLeaderboard, renderRanking, updateMirror } from "./runHud";
import { applyBestSurvival, formatBestSurvivalLine, loadSave } from "./save";
import { settleHeroLoot } from "../sim/loot";
import {
  clearAutorun,
  guildSectionOrder,
  parseSeed,
  persist,
  setActiveGuildSection,
  setVisibleScreen,
  shouldSkipTitle,
} from "./screenUtils";
import type { GuildSection, GuildSectionPanes, GuildSectionTabs } from "./screenUtils";

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
  startPixelSpriteLoad();

  const params = new URLSearchParams(windowRef.location.search);
  const fixedSeed = parseSeed(params.get("seed"));
  const fastMode = params.get("fast") === "1";
  const autoplay = params.get("autoplay") === "1";
  // Presence of any seed/fast/autoplay key skips title (E2E surface unchanged).
  const skipTitle = shouldSkipTitle(params);
  const controller = createScreenController(documentRef, windowRef, fixedSeed, fastMode);

  if (skipTitle) {
    // Same-turn visibility: title never paints for autoplay/seed/fast paths.
    controller.enterGuild();
    if (autoplay) {
      controller.deploySolo();
    }
    return;
  }

  controller.showTitle();
}

function createScreenController(
  documentRef: Document,
  windowRef: Window,
  fixedSeed: number | undefined,
  fastMode: boolean,
): { showTitle(): void; enterGuild(): void; renderGuild(): void; deploySolo(): void } {
  let save = loadSave(windowRef.localStorage);
  let session: RunSession | undefined;
  let autorunTimer: number | undefined;

  const audio = createAudioEngine(documentRef, {
    enabled: !fastMode,
    muted: save.soundMuted === true,
    onMutedChange: (soundMuted) => {
      save = { ...save, soundMuted };
      persist(windowRef, save);
    },
  });
  const matchSound = createMatchSoundObserver(audio, !fastMode);

  const canvas = requiredCanvas(documentRef, "run-canvas");
  const titleScreen = requiredElement(documentRef, "screen-title");
  const guildScreen = requiredElement(documentRef, "screen-guild");
  const runScreen = requiredElement(documentRef, "screen-run");
  const resultsScreen = requiredElement(documentRef, "screen-results");
  const screenElements = {
    title: titleScreen,
    guild: guildScreen,
    run: runScreen,
    results: resultsScreen,
  };
  const gameState = requiredElement(documentRef, "game-state");
  const lobbyStage = createLobbyStage(documentRef, windowRef);

  const guildSectionTabs = {} as GuildSectionTabs;
  const guildSectionPanes = {} as GuildSectionPanes;
  for (const section of guildSectionOrder) {
    guildSectionTabs[section] = requiredButton(documentRef, `guild-tab-${section}`);
    guildSectionPanes[section] = requiredElement(documentRef, `guild-section-${section}`);
  }
  function activateGuildSection(section: GuildSection): void {
    setActiveGuildSection(guildSectionPanes, guildSectionTabs, section);
  }
  for (const section of guildSectionOrder) {
    guildSectionTabs[section].addEventListener("click", () => {
      activateGuildSection(section);
    });
  }

  const startGameButton = requiredButton(documentRef, "start-game");
  const deploySoloButton = requiredButton(documentRef, "deploy-solo");
  const deployArenaButton = requiredButton(documentRef, "deploy-arena");
  const backButton = requiredButton(documentRef, "back-to-guild");
  const guildControls = {
    ...wireGuildInteractions({
      documentRef,
      windowRef,
      getSave: () => save,
      setSave: (nextSave) => {
        save = nextSave;
      },
      renderGuild: () => renderGuild(),
    }),
    lobbyStage,
  };

  startGameButton.addEventListener("click", () => {
    enterGuild();
  });
  deploySoloButton.addEventListener("click", () => deploySolo());
  deployArenaButton.addEventListener("click", () => {
    void deployArena();
  });
  backButton.addEventListener("click", () => {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    audio.setBgmTrack("guild");
    setVisibleScreen(screenElements, "guild");
    activateGuildSection("overview");
    renderGuild();
  });

  function showTitle(): void {
    lobbyStage.stop();
    setVisibleScreen(screenElements, "title");
  }

  function enterGuild(): void {
    setVisibleScreen(screenElements, "guild");
    activateGuildSection("overview");
    renderGuild();
  }

  function renderGuild(): void {
    renderGuildView(documentRef, save, guildControls);
    lobbyStage.start();
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

    audio.setBgmTrack("battle");
    lobbyStage.stop();
    matchSound.startMatch(input.match.state);
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
    // Chunked so the main thread never freezes — cloud E2E browsers judge a
    // multi-second synchronous loop as an unresponsive page.
    let guard = 30000;
    const chunk = (): void => {
      let budget = 600;
      while (match.state.phase !== "finished" && guard > 0 && budget > 0) {
        match.step();
        guard -= 1;
        budget -= 1;
      }
      renderMatch(canvas, match.state);
      updateMirror(documentRef, gameState, match.state);
      if (match.state.phase !== "finished" && guard > 0) {
        windowRef.setTimeout(chunk, 0);
        return;
      }
      finishRun(resultFromState(match.state));
    };
    chunk();
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

    matchSound.observeMatch(session.match.state);
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

    audio.setBgmTrack("guild");
    const best = applyBestSurvival(save.bestSurvivalSeconds, primary.survivedSeconds);
    const inventory = addLootToStash(
      inventoryFromSave(save),
      settleHeroLoot(primary.items, primary.survived),
    );
    save = {
      ...save,
      gold: save.gold + primary.gold,
      bestSurvivalSeconds: best.bestSurvivalSeconds,
      equippedItems: inventory.equippedItems,
      stash: inventory.stash,
    };
    persist(windowRef, save);
    requiredElement(documentRef, "result-score").textContent = String(primary.score);
    requiredElement(documentRef, "result-rank").textContent = String(primary.rank);
    requiredElement(documentRef, "result-kills").textContent = String(primary.kills);
    requiredElement(documentRef, "result-time").textContent = `${primary.survivedSeconds}s`;
    requiredElement(documentRef, "result-gold-earned").textContent = String(primary.gold);
    renderBestSurvivalLine(documentRef, best, primary.survived);
    renderRanking(documentRef, result, primary.heroId);
    renderLeaderboard(documentRef, mode === "arena" ? leaderboardFromResult(result) : []);
    lobbyStage.stop();
    setVisibleScreen(screenElements, "results");
    session = undefined;

    if (mode === "arena" && serverLoadout !== undefined) {
      void submitArenaResult(documentRef, serverLoadout, primary, result).catch(ignoreExpectedApiError);
    }

    if (mode === "solo") {
      void renderSoloLeaderboard().catch(ignoreExpectedApiError);
    }

    if (mode === "solo" && save.autorun) {
      autorunTimer = windowRef.setTimeout(() => deploySolo(), 4000);
    }
  }

  async function renderSoloLeaderboard(): Promise<void> {
    try {
      const leaderboard = await fetchLeaderboard();
      renderLeaderboard(documentRef, leaderboard);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      renderLeaderboard(documentRef, []);
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

  return { showTitle, enterGuild, renderGuild, deploySolo };
}

function renderBestSurvivalLine(
  documentRef: Document,
  best: { bestSurvivalSeconds: number; isNewBest: boolean },
  survived: boolean,
): void {
  const el = requiredElement(documentRef, "best-survival");
  el.textContent = formatBestSurvivalLine(best, survived);
  el.classList.toggle("is-new-best", best.isNewBest);
  el.classList.toggle("is-survived", survived);
}
