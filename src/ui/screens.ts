import { renderMatch } from "../render/canvas";
import { startPixelSpriteLoad } from "../render/pixelSprites";
import { TICKS_PER_SECOND } from "../sim/constants";
import {
  classDefinitions,
  createMatch,
  resultFromState,
  temperamentDefinitions,
  temperamentForClass,
  weaponDefinitions,
} from "../sim";
import type { MatchResult } from "../sim";
import { createAudioEngine } from "./audio";
import { createMatchSoundObserver } from "./audioEvents";
import { classDetailSummary } from "./classDetail";
import { ignoreExpectedApiError } from "./arenaApi";
import type { ServerLoadout } from "./arenaApi";
import { createArenaRunPlan } from "./arenaRun";
import { submitArenaResult } from "./arenaResults";
import { requiredButton, requiredCanvas, requiredElement, requiredInput } from "./dom";
import { wireGuildInteractions } from "./guildInteractions";
import { renderGuildView } from "./guildView";
import { createLobbyStage } from "./lobbyStage";
import { addLootToStash, inventoryFromSave } from "./inventory";
import { screenMarkup } from "./markup";
import { classPortraitPath, skillIconPath } from "./art";
import { currentLoadout } from "./meta";
import { renderLeaderboard, renderRanking, updateMirror } from "./runHud";
import { buildRunReport } from "./runReport";
import { applyBestSurvival, formatBestSurvivalLine, loadSave, normalizePlayerNameInput } from "./save";
import type { CoachStep } from "./save";
import {
  clearAutorun,
  guildSectionOrder,
  parseSeed,
  persist,
  setActiveGuildSection,
  setGuildShellScale,
  setVisibleScreen,
  shouldSkipTitle,
} from "./screenUtils";
import type { GuildSection, GuildSectionPanes, GuildSectionTabs } from "./screenUtils";

type RunMode = "solo" | "arena";

type RunSession = {
  match: ReturnType<typeof createMatch>;
  mode: RunMode;
  arenaOffline: boolean;
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
const soloDeathPresentationMs = 720;

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
  let lastResultMode: RunMode = "solo";
  let autorunTimer: number | undefined;
  let deploymentPending = false;
  let deploymentToken = 0;
  let deferredDeployment: RunMode | undefined;

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
  const guildShell = guildScreen.querySelector<HTMLElement>(".guild-shell");
  if (guildShell === null) {
    throw new Error("Missing .guild-shell");
  }
  const resizeGuildShell = (): void => setGuildShellScale(guildShell, windowRef);
  resizeGuildShell();
  windowRef.addEventListener("resize", resizeGuildShell);
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
      if (section === "training" && currentCoachStep() === 4) {
        completeCoach();
      }
    });
  }

  const startGameButton = requiredButton(documentRef, "start-game");
  const deploySoloButton = requiredButton(documentRef, "deploy-solo");
  const deployArenaButton = requiredButton(documentRef, "deploy-arena");
  const deploySoloLabel = requiredElement(documentRef, "deploy-solo-label");
  const deployArenaLabel = requiredElement(documentRef, "deploy-arena-label");
  const battleOpenButton = requiredButton(documentRef, "battle-open");
  const battleCloseButton = requiredButton(documentRef, "battle-close");
  const battleModal = requiredElement(documentRef, "battle-modal");
  const settingsOpenButton = requiredButton(documentRef, "settings-open");
  const settingsPopover = requiredElement(documentRef, "settings-popover");
  const backButton = requiredButton(documentRef, "back-to-guild");
  const runAgainButton = requiredButton(documentRef, "run-again");
  const adjustBuildButton = requiredButton(documentRef, "adjust-build");
  const coachPanel = requiredElement(documentRef, "coach-panel");
  const coachRunPanel = requiredElement(documentRef, "coach-run-panel");
  const coachResultsPanel = requiredElement(documentRef, "coach-results-panel");
  const coachStepLabel = requiredElement(documentRef, "coach-step-label");
  const coachMessage = requiredElement(documentRef, "coach-message");
  const coachSkipButton = requiredButton(documentRef, "coach-skip");
  const coachRunSkipButton = requiredButton(documentRef, "coach-run-skip");
  const coachResultsSkipButton = requiredButton(documentRef, "coach-results-skip");
  const coachReplayButton = requiredButton(documentRef, "coach-replay");
  const nameModal = requiredElement(documentRef, "name-modal");
  const nameModalCopy = requiredElement(documentRef, "name-modal-copy");
  const nameModalError = requiredElement(documentRef, "name-modal-error");
  const nameInput = requiredInput(documentRef, "player-name");
  const nameConfirmButton = requiredButton(documentRef, "confirm-player-name");
  const nameCloseButton = requiredButton(documentRef, "name-modal-close");
  const renamePlayerButton = requiredButton(documentRef, "rename-player");
  let nameRequired = false;
  const guildControls = {
    ...wireGuildInteractions({
      documentRef,
      windowRef,
      getSave: () => save,
      setSave: (nextSave) => {
        save = nextSave;
      },
      renderGuild: () => renderGuild(),
      onClassSelected: () => {
        if (currentCoachStep() === 1) {
          setCoachProgress(2, false);
        }
      },
    }),
    lobbyStage,
  };

  startGameButton.addEventListener("click", () => {
    enterGuild();
  });
  battleOpenButton.addEventListener("click", () => openBattleModal());
  battleCloseButton.addEventListener("click", () => closeBattleModal(true));
  deploySoloButton.addEventListener("click", () => {
    if (currentCoachStep() === 2) {
      setCoachProgress(3, false);
    }
    deploySolo();
  });
  deployArenaButton.addEventListener("click", () => {
    void deployArena();
  });
  backButton.addEventListener("click", () => returnToGuild("class"));
  adjustBuildButton.addEventListener("click", () => returnToGuild("training"));
  runAgainButton.addEventListener("click", () => {
    if (lastResultMode === "arena") {
      void deployArena();
      return;
    }
    deploySolo();
  });

  function returnToGuild(section: GuildSection): void {
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    audio.setBgmTrack("guild");
    setVisibleScreen(screenElements, "guild");
    if (currentCoachStep() === 3) {
      setCoachProgress(4, false);
    }
    activateGuildSection(section);
    if (section === "training" && currentCoachStep() === 4) {
      completeCoach();
    }
    renderGuild();
    guildSectionTabs[section].focus();
  }
  coachSkipButton.addEventListener("click", () => completeCoach());
  coachRunSkipButton.addEventListener("click", () => completeCoach());
  coachResultsSkipButton.addEventListener("click", () => completeCoach());
  coachReplayButton.addEventListener("click", () => {
    closeSettings(false);
    setCoachProgress(1, false);
    activateGuildSection("class");
    guildSectionTabs.class.focus();
  });
  settingsOpenButton.addEventListener("click", () => {
    if (settingsPopover.classList.contains("hidden")) {
      openSettings();
    } else {
      closeSettings(true);
    }
  });
  settingsPopover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings(true);
    }
  });
  renamePlayerButton.addEventListener("click", () => openNameModal(false));
  nameCloseButton.addEventListener("click", () => closeNameModal());
  nameInput.addEventListener("input", () => {
    nameModalError.textContent = "";
    nameConfirmButton.disabled = nameInput.value.trim().length === 0;
  });
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmPlayerName();
    }
    if (event.key === "Escape" && !nameRequired) {
      event.preventDefault();
      closeNameModal();
    }
  });
  nameConfirmButton.addEventListener("click", () => confirmPlayerName());

  function showTitle(): void {
    lobbyStage.stop();
    setVisibleScreen(screenElements, "title");
  }

  function enterGuild(): void {
    setVisibleScreen(screenElements, "guild");
    activateGuildSection("class");
    renderGuild();
    if (save.playerName.trim().length === 0) {
      openNameModal(true);
    }
  }

  function openBattleModal(): void {
    if (deploymentPending) {
      return;
    }
    closeSettings(false);
    battleModal.classList.remove("hidden");
    battleOpenButton.setAttribute("aria-expanded", "true");
    deploySoloButton.focus();
  }

  function closeBattleModal(restoreFocus: boolean): void {
    if (deploymentPending) {
      return;
    }
    battleModal.classList.add("hidden");
    battleOpenButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      battleOpenButton.focus();
    }
  }

  function openSettings(): void {
    settingsPopover.classList.remove("hidden");
    settingsOpenButton.setAttribute("aria-expanded", "true");
    const first = settingsPopover.querySelector<HTMLButtonElement>("button");
    first?.focus();
  }

  function closeSettings(restoreFocus: boolean): void {
    settingsPopover.classList.add("hidden");
    settingsOpenButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      settingsOpenButton.focus();
    }
  }

  function openNameModal(required: boolean): void {
    nameRequired = required;
    nameInput.value = save.playerName;
    nameModalCopy.textContent = required
      ? "Leave your name — the sand will remember it."
      : "Rename the gladiator whose story the crowd remembers.";
    nameModalError.textContent = "";
    nameConfirmButton.disabled = nameInput.value.trim().length === 0;
    nameCloseButton.classList.toggle("hidden", required);
    nameModal.classList.remove("hidden");
    nameInput.focus();
    nameInput.select();
  }

  function closeNameModal(): void {
    if (nameRequired) {
      return;
    }
    nameModal.classList.add("hidden");
    renamePlayerButton.focus();
  }

  function confirmPlayerName(): void {
    const playerName = normalizePlayerNameInput(nameInput.value, "");
    if (playerName.length === 0) {
      nameModalError.textContent = "The arena needs a name.";
      nameInput.focus();
      return;
    }
    save = { ...save, playerName };
    persist(windowRef, save);
    nameRequired = false;
    nameModal.classList.add("hidden");
    renderGuild();
    const deferred = deferredDeployment;
    deferredDeployment = undefined;
    if (deferred === "solo") {
      deploySolo();
    } else if (deferred === "arena") {
      void deployArena();
    } else {
      guildSectionTabs.class.focus();
    }
  }

  function renderGuild(): void {
    renderGuildView(documentRef, save, guildControls);
    renderSelectedClassDetail();
    renderCoach();
    lobbyStage.start();
  }

  function renderSelectedClassDetail(): void {
    const definition = classDefinitions[save.classId];
    const temperamentId = temperamentForClass(save.classId);
    const temperament = temperamentDefinitions[temperamentId];
    const summary = classDetailSummary(save.classId, temperamentId);
    const weapons = definition.startingWeapons ?? [definition.startingWeapon];
    const portrait = requiredElement(documentRef, "selected-class-portrait");
    const weaponIcon = requiredElement(documentRef, "selected-class-weapon-icon");
    if (portrait instanceof HTMLImageElement) {
      portrait.src = classPortraitPath(save.classId);
      portrait.alt = `${definition.name} portrait`;
    }
    if (weaponIcon instanceof HTMLImageElement) {
      weaponIcon.src = skillIconPath(definition.startingWeapon);
    }
    requiredElement(documentRef, "selected-class-name").textContent = definition.name;
    requiredElement(documentRef, "selected-class-behavior-name").textContent = temperament.name;
    requiredElement(documentRef, "selected-class-weapons").textContent = weapons
      .map((weaponId) => weaponDefinitions[weaponId].name)
      .join(" + ");
    const strength = requiredElement(documentRef, "selected-class-strength");
    const weakness = requiredElement(documentRef, "selected-class-weakness");
    const behavior = requiredElement(documentRef, "selected-class-behavior");
    strength.textContent = summary.strength;
    weakness.textContent = summary.weakness;
    behavior.textContent = summary.behavior;
    strength.title = definition.strength;
    weakness.title = definition.weakness;
    behavior.title = temperament.hardRule;
    strength.setAttribute("aria-label", `Strength: ${definition.strength}`);
    weakness.setAttribute("aria-label", `Weakness: ${definition.weakness}`);
    behavior.setAttribute("aria-label", `Behavior: ${temperament.hardRule}`);
  }

  function currentCoachStep(): CoachStep | undefined {
    return save.coachCompleted === true ? undefined : (save.coachStep ?? 1);
  }

  function setCoachProgress(coachStep: CoachStep, coachCompleted: boolean): void {
    save = { ...save, coachStep, coachCompleted };
    persist(windowRef, save);
    renderCoach();
  }

  function completeCoach(): void {
    setCoachProgress(4, true);
  }

  function renderCoach(): void {
    const step = currentCoachStep();
    coachPanel.classList.toggle("hidden", step === undefined || step === 3);
    coachRunPanel.classList.toggle("hidden", step !== 3);
    coachResultsPanel.classList.toggle("hidden", step !== 3);
    if (step === undefined) {
      return;
    }

    coachStepLabel.textContent = `COACH ${step}/4`;
    switch (step) {
      case 1:
        coachMessage.textContent = "Choose a class.";
        break;
      case 2:
        coachMessage.textContent = `Read ${classDefinitions[save.classId].name}'s behavior, then enter a PRACTICE BOUT.`;
        break;
      case 3:
        coachMessage.textContent = "Watch the run, then return to the Guild.";
        break;
      case 4:
        coachMessage.textContent = "Open Training to invest your earnings.";
        break;
    }
  }

  function deploySolo(): void {
    if (deploymentPending) {
      return;
    }
    if (save.playerName.trim().length === 0) {
      deferredDeployment = "solo";
      openNameModal(true);
      return;
    }
    setDeploymentPending(true, "solo");
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;
    const match = createMatch({
      seed: consumeLocalSeed(),
      heroes: [currentLoadout(save)],
    });
    startRun({ match, mode: "solo", arenaOffline: false, serverLoadout: undefined });
  }

  async function deployArena(): Promise<void> {
    if (deploymentPending) {
      return;
    }
    if (save.playerName.trim().length === 0) {
      deferredDeployment = "arena";
      openNameModal(true);
      return;
    }
    const token = deploymentToken + 1;
    deploymentToken = token;
    setDeploymentPending(true, "arena");
    clearAutorun(windowRef, autorunTimer);
    autorunTimer = undefined;

    try {
      const arenaRun = await createArenaRunPlan(save, fixedSeed, consumeLocalSeed);
      if (token !== deploymentToken || !deploymentPending) {
        return;
      }
      const match = createMatch({
        seed: arenaRun.seed,
        heroes: arenaRun.heroes,
      });
      startRun({ match, mode: "arena", arenaOffline: arenaRun.offline, serverLoadout: arenaRun.serverLoadout });
    } catch (error) {
      if (token === deploymentToken) {
        setDeploymentPending(false, "arena");
      }
      throw error;
    }
  }

  function setDeploymentPending(pending: boolean, mode: RunMode): void {
    deploymentPending = pending;
    deploySoloButton.disabled = pending;
    deployArenaButton.disabled = pending;
    battleCloseButton.disabled = pending;
    battleOpenButton.disabled = pending;
    deploySoloButton.setAttribute("aria-busy", pending && mode === "solo" ? "true" : "false");
    deployArenaButton.setAttribute("aria-busy", pending && mode === "arena" ? "true" : "false");
    deploySoloLabel.textContent = pending && mode === "solo" ? "OPENING THE GATE…" : "PRACTICE BOUT";
    deployArenaLabel.textContent = pending && mode === "arena" ? "SUMMONING RIVALS…" : "GRAND BOUT";
  }

  function startRun(input: RunStart): void {
    session = {
      match: input.match,
      mode: input.mode,
      arenaOffline: input.arenaOffline,
      serverLoadout: input.serverLoadout,
      animationFrame: undefined,
      lastFrameTime: undefined,
      accumulatorMs: 0,
      lastMirrorTime: 0,
    };

    audio.setBgmTrack("battle");
    setDeploymentPending(false, input.mode);
    closeBattleModal(false);
    lobbyStage.stop();
    matchSound.startMatch(input.match.state);
    setVisibleScreen(screenElements, "run");
    requiredElement(documentRef, "arena-offline-badge").classList.toggle("hidden", !input.arenaOffline);
    updateMirror(documentRef, gameState, input.match.state, input.mode);
    renderMatch(canvas, input.match.state, 0);
    requiredElement(documentRef, "run-canvas-frame").focus();

    if (fastMode) {
      runFast(input.match, input.mode);
      return;
    }

    session.animationFrame = windowRef.requestAnimationFrame(runFrame);
  }

  function runFast(match: ReturnType<typeof createMatch>, mode: RunMode): void {
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
      renderMatch(canvas, match.state, match.state.tick * tickMs);
      updateMirror(documentRef, gameState, match.state, mode);
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
    renderMatch(canvas, session.match.state, time);
    if (time - session.lastMirrorTime >= 500) {
      updateMirror(documentRef, gameState, session.match.state, session.mode);
      session.lastMirrorTime = time;
    }

    if (session.match.state.phase === "finished") {
      updateMirror(documentRef, gameState, session.match.state, session.mode);
      finishRun(resultFromState(session.match.state));
      return;
    }

    session.animationFrame = windowRef.requestAnimationFrame(runFrame);
  }

  function finishRun(result: MatchResult): void {
    if (session === undefined) {
      return;
    }

    const primary = result.heroes.find((hero) => hero.heroId === 1) ?? result.heroes[0];
    if (!fastMode && session.mode === "solo" && primary?.survived === false) {
      presentSoloDeath(result, session);
      return;
    }

    showResults(result, session.mode, session.arenaOffline, session.serverLoadout);
  }

  function presentSoloDeath(result: MatchResult, finishingSession: RunSession): void {
    const renderDeathFrame = (time: number): void => {
      if (session !== finishingSession) {
        return;
      }

      renderMatch(canvas, finishingSession.match.state, time);
      finishingSession.animationFrame = windowRef.requestAnimationFrame(renderDeathFrame);
    };

    finishingSession.animationFrame = windowRef.requestAnimationFrame(renderDeathFrame);
    windowRef.setTimeout(() => {
      if (session !== finishingSession) {
        return;
      }

      if (finishingSession.animationFrame !== undefined) {
        windowRef.cancelAnimationFrame(finishingSession.animationFrame);
        finishingSession.animationFrame = undefined;
      }
      showResults(result, finishingSession.mode, finishingSession.arenaOffline, finishingSession.serverLoadout);
    }, soloDeathPresentationMs);
  }

  function showResults(
    result: MatchResult,
    mode: RunMode,
    arenaOffline: boolean,
    serverLoadout: ServerLoadout | undefined,
  ): void {
    const primary = result.heroes.find((hero) => hero.heroId === 1) ?? result.heroes[0];
    if (primary === undefined) {
      return;
    }

    audio.setBgmTrack("guild");
    lastResultMode = mode;
    const report = buildRunReport(primary, mode, save.gold);
    const best = applyBestSurvival(save.bestSurvivalSeconds, primary.survivedSeconds);
    const inventory = addLootToStash(
      inventoryFromSave(save),
      report.settledItemIds,
    );
    save = {
      ...save,
      gold: report.goldAfter,
      bestSurvivalSeconds: best.bestSurvivalSeconds,
      equippedItems: inventory.equippedItems,
      stash: inventory.stash,
    };
    persist(windowRef, save);
    requiredElement(documentRef, "result-score").textContent = String(primary.score);
    requiredElement(documentRef, "result-rank").textContent = String(primary.rank);
    requiredElement(documentRef, "result-kills").textContent = String(primary.kills);
    requiredElement(documentRef, "result-time").textContent = `${primary.survivedSeconds}s`;
    requiredElement(documentRef, "result-outcome").textContent = report.outcome;
    requiredElement(documentRef, "result-gold-before").textContent = String(report.goldBefore);
    requiredElement(documentRef, "result-gold-earned").textContent = String(report.goldEarned);
    requiredElement(documentRef, "result-gold-after").textContent = String(report.goldAfter);
    requiredElement(documentRef, "result-loot").textContent = report.lootNames.length === 0
      ? "No loot"
      : report.lootNames.join(" · ");
    requiredElement(documentRef, "result-rank-cell").classList.toggle("hidden", !report.showPlacement);
    requiredElement(documentRef, "match-ranking-section").classList.toggle("hidden", !report.showMatchRanking);
    requiredElement(documentRef, "leaderboard-section").classList.toggle("hidden", !report.showWorldLeaderboard);
    renderBestSurvivalLine(documentRef, best, primary.survived);
    renderRanking(documentRef, result, primary.heroId);
    renderLeaderboard(
      documentRef,
      [],
      arenaOffline || serverLoadout === undefined
        ? "WORLD LEADERBOARD UNAVAILABLE · OFFLINE MATCH"
        : "LOADING WORLD RANKINGS…",
    );
    lobbyStage.stop();
    setVisibleScreen(screenElements, "results");
    runAgainButton.focus();
    session = undefined;

    if (mode === "arena" && !arenaOffline && serverLoadout !== undefined) {
      void submitArenaResult(documentRef, serverLoadout, primary).catch(ignoreExpectedApiError);
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
