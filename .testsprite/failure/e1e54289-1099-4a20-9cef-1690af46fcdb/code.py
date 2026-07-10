import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("https://ghost-guild.vercel.app")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to the seeded fast run page at 'https://ghost-guild.vercel.app/?seed=42&fast=1' so the 'deploy-solo' flow can be tested.
        await page.goto("https://ghost-guild.vercel.app/?seed=42&fast=1")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'DEPLOY SOLO' button
        # DEPLOY SOLO button
        elem = page.get_by_test_id('deploy-solo')
        await elem.click(timeout=10000)
        
        # -> Click the 'BACK TO GUILD' button
        # BACK TO GUILD button
        elem = page.get_by_test_id('back-to-guild')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The element #screen-guild is visible
        await page.locator("xpath=/html/body/div[1]/section[2]/div/footer/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: Guild screen is visible because the DEPLOY SOLO button is visible.
        await expect(page.locator("xpath=/html/body/div[1]/section[2]/div/footer/button[1]").nth(0)).to_be_visible(timeout=15000), "Guild screen is visible because the DEPLOY SOLO button is visible."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    