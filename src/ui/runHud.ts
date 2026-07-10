import { classDefinitions } from "../sim";
import { MAX_TICKS, RUN_SECONDS, TICKS_PER_SECOND } from "../sim/constants";
import type { MatchResult, MatchState } from "../sim";
import type { LeaderboardEntry } from "./arenaApi";
import { requiredElement } from "./dom";

export type HudRunMode = "solo" | "arena";

/** Renderer-side XP curve (mirrors sim/levelup xpNeededForLevel). Do not import from levelup. */
function xpNeededForLevel(level: number): number {
  return 5 + 3 * level;
}

export function updateMirror(
  documentRef: Document,
  element: HTMLElement,
  state: MatchState,
  mode: HudRunMode = "solo",
): void {
  const hero = state.heroes[0];
  if (hero === undefined) {
    return;
  }

  const time = Math.floor(state.tick / TICKS_PER_SECOND);
  element.dataset.phase = state.phase;
  element.dataset.time = String(time);
  element.dataset.hp = String(Math.ceil(hero.hp));
  element.dataset.level = String(hero.level);
  element.dataset.kills = String(hero.kills);
  element.dataset.gold = String(Math.floor(hero.gold));
  element.dataset.seed = String(state.seed);
  // E2E identity signal: class + class-derived temperament (Traits v3).
  element.dataset.class = hero.classId;
  element.dataset.temperament = hero.temperament;
  element.dataset.mode = mode;

  requiredElement(documentRef, "hud-hp").textContent = `${Math.ceil(hero.hp)}/${Math.round(hero.maxHp)}`;
  requiredElement(documentRef, "hud-level").textContent = String(hero.level);
  requiredElement(documentRef, "hud-time").textContent = `${time}s`;
  requiredElement(documentRef, "run-mode").textContent = mode.toUpperCase();
  requiredElement(documentRef, "run-progress").textContent = `${time} / ${RUN_SECONDS}s`;
  requiredElement(documentRef, "run-remaining").textContent = `${Math.max(0, RUN_SECONDS - time)}s LEFT`;
  requiredElement(documentRef, "run-kills").textContent = String(hero.kills);
  requiredElement(documentRef, "run-gold").textContent = String(Math.floor(hero.gold));
  requiredElement(documentRef, "run-score").textContent = String(scoreFromState(state));
  requiredElement(documentRef, "run-class").textContent = classDefinitions[hero.classId].name;
  requiredElement(documentRef, "run-behavior").textContent = hero.currentIntent.replaceAll("-", " ").toUpperCase();
  requiredElement(documentRef, "run-behavior-reason").textContent = hero.currentIntentReason;
  requiredElement(documentRef, "run-progress-fill").style.width = `${Math.min(1, time / RUN_SECONDS) * 100}%`;

  const hpRatio = hero.maxHp > 0 ? Math.max(0, Math.min(1, hero.hp / hero.maxHp)) : 0;
  requiredElement(documentRef, "hud-hp-fill").style.height = `${hpRatio * 100}%`;

  // Prefer live xpToNext when present; fall back to curve for safety.
  const xpNeeded = hero.xpToNext > 0 ? hero.xpToNext : xpNeededForLevel(hero.level);
  const xpRatio = xpNeeded > 0 ? Math.max(0, Math.min(1, hero.xp / xpNeeded)) : 0;
  requiredElement(documentRef, "hud-xp-fill").style.width = `${xpRatio * 100}%`;
}

function scoreFromState(state: MatchState): number {
  const hero = state.heroes[0];
  if (hero === undefined) {
    return 0;
  }
  const lifeTick = hero.deathTick ?? state.tick;
  const survived = hero.alive && state.tick >= MAX_TICKS;
  const survivedSeconds = survived ? RUN_SECONDS : Math.floor(lifeTick / TICKS_PER_SECOND);
  const survivalMultiplier = hero.temperament === "survivor"
    ? (hero.perks.includes("priestOutlast") ? 1.6 : 1.4)
    : 1;
  return Math.floor(
    hero.kills * 10
      + Math.floor(hero.gold)
      + survivedSeconds * 5 * survivalMultiplier
      + (survived ? 500 : 0),
  );
}

export function renderRanking(documentRef: Document, result: MatchResult, localHeroId: number): void {
  const list = requiredElement(documentRef, "result-ranking");
  const items: HTMLLIElement[] = [];
  for (const heroId of result.ranking) {
    const hero = result.heroes.find((entry) => entry.heroId === heroId);
    if (hero !== undefined) {
      const item = documentRef.createElement("li");
      item.classList.toggle("local-row", hero.heroId === localHeroId);
      item.textContent = `#${hero.rank} ${hero.name} ${hero.classId} ${hero.score}`;
      items.push(item);
    }
  }
  list.replaceChildren(...items);
}

export function renderLeaderboard(
  documentRef: Document,
  entries: readonly LeaderboardEntry[],
  status = entries.length === 0 ? "NO WORLD ENTRIES" : "WORLD RANKINGS LIVE",
): void {
  const list = requiredElement(documentRef, "leaderboard-list");
  requiredElement(documentRef, "leaderboard-status").textContent = status;
  const items: HTMLLIElement[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry !== undefined) {
      const item = documentRef.createElement("li");
      const badge = entry.temperament === undefined ? "" : ` ${entry.temperament}`;
      item.textContent = `#${index + 1} ${entry.name} ${entry.classId}${badge} ${entry.score}`;
      items.push(item);
    }
  }
  list.replaceChildren(...items);
}
