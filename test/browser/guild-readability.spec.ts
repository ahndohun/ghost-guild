import type { Locator, Page } from "@playwright/test";
import { expect, finishNameOnboarding, test } from "./helpers";

const classTargets = [
  "class-fighter",
  "class-knight",
  "class-berserker",
  "class-dwarf",
  "class-paladin",
  "class-mage",
  "class-priest",
  "class-warlock",
  "class-elf",
  "class-thief",
  "class-monk",
] as const;

const interactiveTargets = [
  "guild-tab-class",
  "guild-tab-training",
  "guild-tab-gear",
  "buy-atk",
  "perk-t1-a",
  "battle-open",
  "coach-skip",
  "settings-open",
] as const;

const decisionBodySamples: readonly { selector: string; openTab?: "class" | "training" | "gear" }[] = [
  { selector: "[data-testid='perk-t1-a'] small", openTab: "class" },
  { selector: "#lobby-nameplate-rule" },
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

async function openGuildTab(page: Page, section: "class" | "training" | "gear"): Promise<void> {
  await page.getByTestId(`guild-tab-${section}`).click();
  await expect(page.locator(`#guild-section-${section}`)).toBeVisible();
}

async function ensureTargetVisible(page: Page, testId: string): Promise<void> {
  if (testId === "buy-atk") {
    await openGuildTab(page, "training");
  } else if (testId === "perk-t1-a") {
    await openGuildTab(page, "class");
  }
  const target = page.getByTestId(testId);
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeVisible();
}

test.describe("Guild hierarchy and readability", () => {
  test("selected specialization node keeps its full name, reason, and effect inside the pane", async ({
    page,
  }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);

    await page.mouse.move(0, 0);
    await page.reload();

    const detail = page.getByTestId("specialization-detail");
    await expect(detail).toBeVisible();
    await expect(page.getByTestId("specialization-detail-name")).toHaveText("Bulwark");
    await expect(page.getByTestId("specialization-detail-effect")).toHaveText(
      "Contact damage taken −12.5%.",
    );

    const expectDetail = async (expected: {
      readonly name: string;
      readonly reason: string;
      readonly effect: string;
    }): Promise<void> => {
      await expect(page.getByTestId("specialization-detail-name")).toHaveText(expected.name);
      await expect(page.getByTestId("specialization-detail-reason")).toHaveText(expected.reason);
      await expect(page.getByTestId("specialization-detail-effect")).toHaveText(expected.effect);
      for (const testId of [
        "specialization-detail-name",
        "specialization-detail-reason",
        "specialization-detail-effect",
      ] as const) {
        const metrics = await page.getByTestId(testId).evaluate((node) => ({
          clientWidth: node.clientWidth,
          clientHeight: node.clientHeight,
          scrollWidth: node.scrollWidth,
          scrollHeight: node.scrollHeight,
        }));
        expect(metrics.scrollWidth, `${testId} horizontal clipping`).toBeLessThanOrEqual(
          metrics.clientWidth + 1,
        );
        expect(metrics.scrollHeight, `${testId} vertical clipping`).toBeLessThanOrEqual(
          metrics.clientHeight + 1,
        );
      }
    };

    const unaffordable = page.getByTestId("perk-t1-b");
    await expect(unaffordable).toHaveAttribute("aria-disabled", "true");
    expect(await unaffordable.evaluate((button) => (button as HTMLButtonElement).disabled)).toBe(false);
    await unaffordable.focus();
    await expectDetail({
      name: "Weapon Drill",
      reason: "Needs 150g; 0g held.",
      effect: "All weapons +4% with soft combat focus (small low-ATK round).",
    });
    await unaffordable.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(unaffordable).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("gold-amount")).toHaveText("0");

    const locked = page.getByTestId("perk-t5-b");
    await expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(await locked.evaluate((button) => (button as HTMLButtonElement).disabled)).toBe(false);
    await locked.focus();
    await expectDetail({
      name: "Counterweight",
      reason: "Choose a Tier 4 node first.",
      effect: "ATK +10% (round of lowest-ATK, capped).",
    });

    const [detailBox, panelBox] = await Promise.all([
      detail.boundingBox(),
      page.locator(".class-tree-panel").boundingBox(),
    ]);
    expect(detailBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect((detailBox?.x ?? 0) + (detailBox?.width ?? 0)).toBeLessThanOrEqual(
      (panelBox?.x ?? 0) + (panelBox?.width ?? 0) + 1,
    );
    expect((detailBox?.y ?? 0) + (detailBox?.height ?? 0)).toBeLessThanOrEqual(
      (panelBox?.y ?? 0) + (panelBox?.height ?? 0) + 1,
    );
    const pane = page.locator(".guild-pane");
    expect(await pane.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  });

  test("decision body ≥12px, interactive targets ≥44 logical px, gold stays one unclipped line", async ({
    page,
  }) => {
    await page.goto("/?seed=7&fast=1");
    await finishNameOnboarding(page);
    await expect(page.locator(".guild-shell")).toBeVisible();

    const scale = await shellScale(page);
    expect(scale).toBeGreaterThan(0);

    await openGuildTab(page, "class");
    const classPane = page.locator(".guild-pane");
    const classPaneMetrics = await classPane.evaluate((pane) => ({
      clientHeight: pane.clientHeight,
      scrollHeight: pane.scrollHeight,
      scrollTop: pane.scrollTop,
    }));
    expect(classPaneMetrics.scrollTop).toBe(0);

    const classCards = page.getByTestId("class-roster").locator(".class-card");
    await expect(classCards).toHaveCount(classTargets.length);
    const sizeEpsilon = 0.05;
    for (const testId of classTargets) {
      const classCard = page.getByTestId(testId);
      await expect(classCard).toBeVisible();
      await expect(classCard).toBeEnabled();
      const size = await logicalSize(classCard, scale);
      expect(size.width + sizeEpsilon, `${testId} logical width`).toBeGreaterThanOrEqual(44);
      expect(size.height + sizeEpsilon, `${testId} logical height`).toBeGreaterThanOrEqual(44);
    }

    const selectedDetailBody = page.getByTestId("selected-class-detail").locator("p > strong");
    await expect(selectedDetailBody).toHaveCount(4);
    for (let index = 0; index < (await selectedDetailBody.count()); index += 1) {
      const detailLine = selectedDetailBody.nth(index);
      await expect(detailLine).toBeVisible();
      const fontSizePx = await detailLine.evaluate((node) => {
        return Number.parseFloat(getComputedStyle(node).fontSize);
      });
      expect(fontSizePx, `selected class detail line ${index + 1} font-size`).toBeGreaterThanOrEqual(12);
    }
    expect(classPaneMetrics.scrollHeight).toBeLessThanOrEqual(classPaneMetrics.clientHeight);

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
