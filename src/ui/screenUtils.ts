import { storeSave } from "./save";
import type { GuildSave } from "./save";

export type ScreenElements = {
  readonly guild: HTMLElement;
  readonly run: HTMLElement;
  readonly results: HTMLElement;
};

export type VisibleScreen = "guild" | "run" | "results";

export function setVisibleScreen(screens: ScreenElements, visible: VisibleScreen): void {
  screens.guild.classList.toggle("hidden", visible !== "guild");
  screens.run.classList.toggle("hidden", visible !== "run");
  screens.results.classList.toggle("hidden", visible !== "results");
}

export function parseSeed(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const seed = Number.parseInt(value, 10);
  return Number.isFinite(seed) ? seed : undefined;
}

export function persist(windowRef: Window, save: GuildSave): void {
  storeSave(windowRef.localStorage, save);
}

export function clearAutorun(windowRef: Window, timer: number | undefined): void {
  if (timer !== undefined) {
    windowRef.clearTimeout(timer);
  }
}
