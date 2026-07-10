import { TICKS_PER_SECOND } from "../sim/constants";
import type { MatchResult, MatchState } from "../sim";
import type { LeaderboardEntry } from "./arenaApi";
import { requiredElement } from "./dom";

/** Renderer-side XP curve (mirrors sim/levelup xpNeededForLevel). Do not import from levelup. */
function xpNeededForLevel(level: number): number {
  return 5 + 3 * level;
}

export function updateMirror(documentRef: Document, element: HTMLElement, state: MatchState): void {
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

  requiredElement(documentRef, "hud-hp").textContent = `${Math.ceil(hero.hp)}/${Math.round(hero.maxHp)}`;
  requiredElement(documentRef, "hud-level").textContent = String(hero.level);
  requiredElement(documentRef, "hud-time").textContent = `${time}s`;

  const hpRatio = hero.maxHp > 0 ? Math.max(0, Math.min(1, hero.hp / hero.maxHp)) : 0;
  requiredElement(documentRef, "hud-hp-fill").style.height = `${hpRatio * 100}%`;

  // Prefer live xpToNext when present; fall back to curve for safety.
  const xpNeeded = hero.xpToNext > 0 ? hero.xpToNext : xpNeededForLevel(hero.level);
  const xpRatio = xpNeeded > 0 ? Math.max(0, Math.min(1, hero.xp / xpNeeded)) : 0;
  requiredElement(documentRef, "hud-xp-fill").style.width = `${xpRatio * 100}%`;
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

export function renderLeaderboard(documentRef: Document, entries: readonly LeaderboardEntry[]): void {
  const list = requiredElement(documentRef, "leaderboard-list");
  const section = requiredElement(documentRef, "leaderboard-section");
  section.classList.toggle("hidden", entries.length === 0);
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
