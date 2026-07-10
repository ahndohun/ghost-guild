import { storeSave } from "./save";
import type { GuildSave } from "./save";

export type ScreenElements = {
  readonly title: HTMLElement;
  readonly guild: HTMLElement;
  readonly run: HTMLElement;
  readonly results: HTMLElement;
};

export type VisibleScreen = "title" | "guild" | "run" | "results";

const screenOrder: readonly VisibleScreen[] = ["title", "guild", "run", "results"];

/** Auto-skip title when any of seed/fast/autoplay is present (key presence, any value). */
export function shouldSkipTitle(params: URLSearchParams): boolean {
  return params.has("seed") || params.has("fast") || params.has("autoplay");
}

export function setVisibleScreen(screens: ScreenElements, visible: VisibleScreen): void {
  for (const name of screenOrder) {
    const element = screens[name];
    const isVisible = name === visible;
    element.classList.toggle("hidden", !isVisible);
    element.classList.toggle("screen-active", isVisible);
  }
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
