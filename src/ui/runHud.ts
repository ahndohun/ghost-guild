import { TICKS_PER_SECOND } from "../sim/constants";
import type { MatchResult, MatchState } from "../sim";
import type { LeaderboardEntry } from "./arenaApi";
import { requiredElement } from "./dom";

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
  requiredElement(documentRef, "hud-hp").textContent = String(Math.ceil(hero.hp));
  requiredElement(documentRef, "hud-level").textContent = String(hero.level);
  requiredElement(documentRef, "hud-kills").textContent = String(hero.kills);
  requiredElement(documentRef, "hud-time").textContent = `${time}s`;
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
  const items: HTMLLIElement[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry !== undefined) {
      const item = documentRef.createElement("li");
      item.textContent = `#${index + 1} ${entry.name} ${entry.classId} ${entry.score}`;
      items.push(item);
    }
  }
  list.replaceChildren(...items);
}
