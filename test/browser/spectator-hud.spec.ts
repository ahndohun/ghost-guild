import { expect, finishNameOnboarding, startSoloFromGuild, test } from "./helpers";

test("spectator telemetry is visible in a compact rail outside the arena canvas", async ({ page }) => {
  await page.goto("/?seed=7");
  await finishNameOnboarding(page);
  await startSoloFromGuild(page);

  await expect(page.locator("#screen-run")).toBeVisible();
  await expect(page.getByTestId("run-mode")).toHaveText("SOLO");
  await expect(page.getByTestId("run-class")).toHaveText("Knight");
  await expect(page.getByTestId("run-behavior")).not.toHaveText("");
  await expect(page.getByTestId("run-kills")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("run-gold")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("run-score")).toHaveText(/^\d+$/);

  const rail = page.getByTestId("spectator-hud");
  const canvas = page.locator("#run-canvas");
  await expect(rail).toBeVisible();
  const [railBox, canvasBox] = await Promise.all([rail.boundingBox(), canvas.boundingBox()]);
  expect(railBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  expect((railBox?.y ?? 0) + (railBox?.height ?? 0)).toBeLessThanOrEqual(canvasBox?.y ?? 0);
  expect(railBox?.height ?? 100).toBeLessThanOrEqual(52);
});
