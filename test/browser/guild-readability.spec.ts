import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers";

const interactiveTargets = [
  "guild-tab-overview",
  "guild-tab-class",
  "guild-tab-training",
  "guild-tab-gear",
  "class-knight",
  "class-mage",
  "toggle-all-classes",
  "buy-atk",
  "perk-t1-a",
  "deploy-solo",
  "deploy-arena",
  "coach-skip",
  "coach-replay",
  "toggle-autorun",
] as const;

const decisionBodySamples: readonly { selector: string; openTab?: "class" | "training" | "gear" | "overview" }[] = [
  { selector: ".class-card[data-testid='class-knight'] .class-strength", openTab: "class" },
  { selector: "[data-testid='perk-t1-a'] small", openTab: "training" },
  { selector: "#lobby-nameplate-rule", openTab: "overview" },
  { selector: ".item-compare-placeholder", openTab: "gear" },
  { selector: "#coach-message" },
];

async function shellScale(page: Page): Promise<number> {
  return page.locator(".guild-shell").evaluate((shell) => {
    return Number.parseFloat(getComputedStyle(shell).getPropertyValue("--shell-scale"));
  });
}

async function logicalSize(locator: Locator, scale: number): Promise<{ width: number; height: number }> {
  const box = await locator.boundingBox();
  const label = await locator.evaluate((el) => el.getAttribute("data-testid") ?? el.className);
  expect(box, `expected bounding box for ${label}`).not.toBeNull();
  return {
    width: (box as { width: number }).width / scale,
    height: (box as { height: number }).height / scale,
  };
}

async function openGuildTab(page: Page, section: "overview" | "class" | "training" | "gear"): Promise<void> {
  await page.getByTestId(`guild-tab-${section}`).click();
  await expect(page.locator(`#guild-section-${section}`)).toBeVisible();
}

async function ensureTargetVisible(page: Page, testId: string): Promise<void> {
  if (testId === "class-knight" || testId === "class-mage" || testId === "toggle-all-classes") {
    await openGuildTab(page, "class");
  } else if (testId === "buy-atk" || testId === "perk-t1-a") {
    await openGuildTab(page, "training");
  }
  const target = page.getByTestId(testId);
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeVisible();
}

test.describe("Guild hierarchy and readability", () => {
  test("decision body ≥12px, interactive targets ≥44 logical px, gold stays one unclipped line", async ({
    page,
  }) => {
    await page.goto("/?seed=7&fast=1");
    await expect(page.locator(".guild-shell")).toBeVisible();

    const scale = await shellScale(page);
    expect(scale).toBeGreaterThan(0);

    for (const sample of decisionBodySamples) {
      if (sample.openTab !== undefined) {
        await openGuildTab(page, sample.openTab);
      }
      const el = page.locator(sample.selector).first();
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
      const fontSizePx = await el.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      expect(fontSizePx, `${sample.selector} font-size`).toBeGreaterThanOrEqual(12);
    }

    // Sub-pixel tolerance: rect÷scale can land at 43.999… for exact 44 CSS px.
    const sizeEpsilon = 0.05;
    for (const testId of interactiveTargets) {
      await ensureTargetVisible(page, testId);
      const size = await logicalSize(page.getByTestId(testId), scale);
      expect(size.width + sizeEpsilon, `${testId} logical width`).toBeGreaterThanOrEqual(44);
      expect(size.height + sizeEpsilon, `${testId} logical height`).toBeGreaterThanOrEqual(44);
    }

    // Gold chip: label + amount on one line, no clipping. Critical number ≥14px.
    const goldAmount = page.getByTestId("gold-amount");
    await expect(goldAmount).toBeVisible();

    const goldMetrics = await goldAmount.evaluate((node) => {
      const style = getComputedStyle(node);
      const fontSize = Number.parseFloat(style.fontSize);
      const parsedLineHeight = Number.parseFloat(style.lineHeight);
      const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.2;
      return {
        fontSize,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        lineHeight,
      };
    });

    expect(goldMetrics.fontSize, "gold-amount font-size").toBeGreaterThanOrEqual(14);
    // Single-line: height stays near one line (allow subpixel / font metrics).
    expect(goldMetrics.clientHeight).toBeLessThanOrEqual(goldMetrics.lineHeight * 1.75 + 4);
    expect(goldMetrics.scrollHeight).toBeLessThanOrEqual(goldMetrics.clientHeight + 2);
    expect(goldMetrics.scrollWidth).toBeLessThanOrEqual(goldMetrics.clientWidth + 2);

    const goldChip = page.locator(".guild-topstrip .gold");
    const chipMetrics = await goldChip.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        whiteSpace: style.whiteSpace,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
      };
    });
    expect(chipMetrics.whiteSpace).toBe("nowrap");
    expect(chipMetrics.scrollHeight).toBeLessThanOrEqual(chipMetrics.clientHeight + 2);
    expect(chipMetrics.scrollWidth).toBeLessThanOrEqual(chipMetrics.clientWidth + 2);
  });
});
