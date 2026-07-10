import asyncio
import re

from playwright import async_api
from playwright.async_api import expect


async def run_test():
    playwright = await async_api.async_playwright().start()
    browser = await playwright.chromium.launch(
        headless=True,
        args=["--window-size=1280,720", "--disable-dev-shm-usage"],
    )
    context = await browser.new_context()
    context.set_default_timeout(15000)
    page = await context.new_page()

    try:
        await page.goto("https://ghost-guild.vercel.app/")
        await page.get_by_test_id("start-game").click()
        await page.get_by_test_id("class-monk").click()
        await page.get_by_test_id("deploy-solo").click()

        await expect(page.locator("#screen-run")).not_to_have_class(re.compile(r"\bhidden\b"))
        mirror = page.locator("#game-state")
        await expect(mirror).to_have_attribute("data-class", "monk")
        await expect(mirror).to_have_attribute("data-temperament", "berserker")
        await expect(mirror).to_have_attribute("data-phase", re.compile(r"running|levelup"))
    finally:
        await context.close()
        await browser.close()
        await playwright.stop()


asyncio.run(run_test())
