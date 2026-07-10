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

/** Guild subsections (Plan 002): a fixed shell with one bounded pane visible at a time. */
export type GuildSection = "overview" | "class" | "training" | "gear";

export const guildSectionOrder: readonly GuildSection[] = ["overview", "class", "training", "gear"];

export type GuildSectionPanes = Record<GuildSection, HTMLElement>;
export type GuildSectionTabs = Record<GuildSection, HTMLButtonElement>;

const guildShellWidth = 960;
const guildShellHeight = 540;

/** Keeps the Guild's logical 960x540 shell fitted to the current viewport. */
export function setGuildShellScale(shell: HTMLElement, windowRef: Window): void {
  const scale = Math.min(windowRef.innerWidth / guildShellWidth, windowRef.innerHeight / guildShellHeight);
  shell.style.setProperty("--shell-scale", String(scale));
}

/** Toggles pane visibility + tab aria-pressed/selected state; does not re-render content. */
export function setActiveGuildSection(
  panes: GuildSectionPanes,
  tabs: GuildSectionTabs,
  active: GuildSection,
): void {
  for (const name of guildSectionOrder) {
    const isActive = name === active;
    panes[name].classList.toggle("hidden", !isActive);
    tabs[name].classList.toggle("selected", isActive);
    tabs[name].setAttribute("aria-pressed", isActive ? "true" : "false");
  }
}

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
