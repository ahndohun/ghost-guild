import type { Locator, Page } from "@playwright/test";
import { expect, finishNameOnboarding, test } from "./helpers";

type Rect = { x: number; y: number; width: number; height: number };

const sections = ["class", "training", "gear"] as const;
const epsilon = 1;

async function rect(locator: Locator): Promise<Rect> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value as Rect;
}

function expectContained(inner: Rect, outer: Rect): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - epsilon);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - epsilon);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + epsilon);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + epsilon);
}

async function shellScale(page: Page): Promise<number> {
  return page.locator(".guild-shell").evaluate((shell) => {
    return Number.parseFloat(getComputedStyle(shell).getPropertyValue("--shell-scale"));
  });
}

test.describe("Guild fixed-shell geometry", () => {
  test("letterboxes one 960x540 shell and keeps every section control inside it", async ({ page }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    const shell = page.locator(".guild-shell");
    const pane = page.locator(".guild-pane");
    const actions = page.locator(".guild-actions");
    const scale = await shellScale(page);
    const shellBox = await rect(shell);

    expect(scale).toBeCloseTo(
      await page.evaluate(() => Math.min(window.innerWidth / 960, window.innerHeight / 540)),
      6,
    );
    expect(shellBox.width / scale).toBeCloseTo(960, 1);
    expect(shellBox.height / scale).toBeCloseTo(540, 1);
    expect(shellBox.x).toBeGreaterThanOrEqual(-epsilon);
    expect(shellBox.y).toBeGreaterThanOrEqual(-epsilon);
    expect(shellBox.x + shellBox.width).toBeLessThanOrEqual(
      (await page.evaluate(() => window.innerWidth)) + epsilon,
    );
    expect(shellBox.y + shellBox.height).toBeLessThanOrEqual(
      (await page.evaluate(() => window.innerHeight)) + epsilon,
    );
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
      await page.evaluate(() => window.innerHeight),
    );
    const scrollOwnership = await page.evaluate(() => {
      const pane = document.querySelector<HTMLElement>(".guild-pane");
      const shell = document.querySelector<HTMLElement>(".guild-shell");
      const body = document.querySelector<HTMLElement>(".guild-body");
      const actions = document.querySelector<HTMLElement>(".guild-actions");
      if (pane === null || shell === null || body === null || actions === null) {
        return null;
      }
      return {
        pane: getComputedStyle(pane).overflowY,
        shell: getComputedStyle(shell).overflowY,
        body: getComputedStyle(body).overflowY,
        actions: getComputedStyle(actions).overflowY,
        page: getComputedStyle(document.documentElement).overflowY,
      };
    });
    expect(scrollOwnership).toEqual({
      pane: "auto",
      shell: "visible",
      body: "visible",
      actions: "visible",
      page: "hidden",
    });

    const paneBox = await rect(pane);
    const actionsBox = await rect(actions);
    expectContained(paneBox, shellBox);
    expect(paneBox.y + paneBox.height).toBeLessThanOrEqual(actionsBox.y + epsilon);

    for (const section of sections) {
      await page.getByTestId(`guild-tab-${section}`).click();
      await expect(page.locator(`#guild-section-${section}`)).toBeVisible();

      if (section === "class") {
        const classPaneBox = await rect(pane);
        const classShellBox = await rect(shell);
        const classCards = page.getByTestId("class-roster").locator(".class-card");
        await expect(classCards).toHaveCount(11);

        const classPaneMetrics = await pane.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
        }));
        expect(classPaneMetrics.scrollTop).toBe(0);

        for (let index = 0; index < (await classCards.count()); index += 1) {
          const classCard = classCards.nth(index);
          await expect(classCard).toBeVisible();
          await expect(classCard).toBeEnabled();
          const classCardBox = await rect(classCard);
          expectContained(classCardBox, classPaneBox);
          expectContained(classCardBox, classShellBox);
        }
        expect(classPaneMetrics.scrollHeight).toBeLessThanOrEqual(classPaneMetrics.clientHeight);
      }

      const interactiveControls = page.locator(
        `#guild-section-${section} :is(button,input,select,textarea,a)[data-testid]`,
      );
      for (let index = 0; index < (await interactiveControls.count()); index += 1) {
        const control = interactiveControls.nth(index);
        if (section !== "class") {
          await control.scrollIntoViewIfNeeded();
        }
        expectContained(await rect(control), await rect(shell));
      }

      for (const persistentControl of [
        page.getByTestId(`guild-tab-${section}`),
        page.getByTestId("battle-open"),
        page.getByTestId("coach-skip"),
        page.getByTestId("settings-open"),
      ]) {
        expectContained(await rect(persistentControl), await rect(shell));
      }
    }
  });
});
