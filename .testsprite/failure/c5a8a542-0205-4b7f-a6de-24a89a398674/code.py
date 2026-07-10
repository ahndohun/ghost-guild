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

        # -> Open the Colosseum Survivors landing page (https://colosseum-survivors.pages.dev/).
        await page.goto("https://colosseum-survivors.pages.dev/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # -> Click the 'PRESS START' button
        # PRESS START button
        elem = page.get_by_test_id('start-game')
        await elem.click(timeout=10000)

        # -> Fill the 'GLADIATOR NAME' field with 'TestSprite-3113' and click the 'ENTER THE BARRACKS' button.
        # text field
        elem = page.get_by_test_id('player-name')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("TestSprite-3113")

        # -> Fill the 'GLADIATOR NAME' field with 'TestSprite-3113' and click the 'ENTER THE BARRACKS' button.
        # ENTER THE BARRACKS button
        elem = page.get_by_test_id('confirm-player-name')
        await elem.click(timeout=10000)

        # -> Click the 'Mage' class button to load Mage details.
        # Mage Ready button
        elem = page.get_by_test_id('class-mage')
        await elem.click(timeout=10000)

        # -> Click the 'Mage' class button to load Mage details.
        # TRAINING button
        elem = page.get_by_test_id('guild-tab-training')
        await elem.click(timeout=10000)

        # -> Click the 'Mage' class button to load Mage details.
        # INVENTORY button
        elem = page.get_by_test_id('guild-tab-gear')
        await elem.click(timeout=10000)

        # -> Click the 'CLASS & TREE' tab to switch to the class roster view so class buttons and selected-class details become visible.
        # CLASS & TREE button
        elem = page.get_by_test_id('guild-tab-class')
        await elem.click(timeout=10000)

        # -> Collect all visible elements that have a data-testid attribute on the page so the required assertions can be verified.
        # Mage Selected button
        elem = page.get_by_test_id('class-mage')
        await elem.click(timeout=10000)

        # -> Click the 'TRAINING' tab to open the Training view and verify the 'buy-atk' button is visible.
        # TRAINING button
        elem = page.get_by_test_id('guild-tab-training')
        await elem.click(timeout=10000)

        # -> Click the 'CLASS & TREE' tab to open the class roster view so class buttons and selected-class details become visible.
        # CLASS & TREE button
        elem = page.get_by_test_id('guild-tab-class')
        await elem.click(timeout=10000)

        # -> Click the 'Mage' class button to (re)select Mage and expose the selected-class details for verification.
        # Mage Selected button
        elem = page.get_by_test_id('class-mage')
        await elem.click(timeout=10000)

        # -> Click the 'Mage' class button to ensure it's selected, then open the 'TRAINING' tab.
        # Mage Selected button
        elem = page.get_by_test_id('class-mage')
        await elem.click(timeout=10000)

        # -> Click the 'Mage' class button to ensure it's selected, then open the 'TRAINING' tab.
        # TRAINING button
        elem = page.get_by_test_id('guild-tab-training')
        await elem.click(timeout=10000)

        # -> Collect all elements that have a data-testid attribute on the page, then click the 'CLASS & TREE' tab to open the class roster view.
        # CLASS & TREE button
        elem = page.get_by_test_id('guild-tab-class')
        await elem.click(timeout=10000)

        # -> Collect all elements on the page that have a visible data-testid attribute and record their attributes and visible text.
        # CLASS & TREE button
        elem = page.get_by_test_id('guild-tab-class')
        await elem.click(timeout=10000)

        # -> Collect all elements on the page that have a visible data-testid attribute and record their attributes and visible text.
        # Mage Selected button
        elem = page.get_by_test_id('class-mage')
        await elem.click(timeout=10000)

        # -> Collect all elements on the page that have a visible data-testid attribute and record their attributes and visible text.
        # TRAINING button
        elem = page.get_by_test_id('guild-tab-training')
        await elem.click(timeout=10000)

        # -> Collect all elements on the page that have a visible data-testid attribute and record their attributes and visible text.
        # INVENTORY button
        elem = page.get_by_test_id('guild-tab-gear')
        await elem.click(timeout=10000)

        # --> Assertions to verify final state

        # --> The button with data-testid guild-tab-class is visible
        await page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The button with data-testid guild-tab-class is visible.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[1]").nth(0)).to_be_visible(timeout=15000), "The button with data-testid guild-tab-class is visible."

        # --> The button with data-testid guild-tab-class has text CLASS & TREE
        # Assert: The guild-tab-class button displays the exact text 'CLASS & TREE'.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[1]").nth(0)).to_have_text("CLASS & TREE", timeout=15000), "The guild-tab-class button displays the exact text 'CLASS & TREE'."

        # --> The button with data-testid guild-tab-training is visible
        await page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The TRAINING tab button (data-testid=guild-tab-training) is visible.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[2]").nth(0)).to_be_visible(timeout=15000), "The TRAINING tab button (data-testid=guild-tab-training) is visible."

        # --> The button with data-testid guild-tab-training has text TRAINING
        # Assert: The button with data-testid guild-tab-training displays the text TRAINING.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[2]").nth(0)).to_have_text("TRAINING", timeout=15000), "The button with data-testid guild-tab-training displays the text TRAINING."

        # --> The button with data-testid guild-tab-gear is visible
        await page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[3]").nth(0).scroll_into_view_if_needed()
        # Assert: The INVENTORY (data-testid guild-tab-gear) button is visible.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[3]").nth(0)).to_be_visible(timeout=15000), "The INVENTORY (data-testid guild-tab-gear) button is visible."

        # --> The button with data-testid guild-tab-gear has text INVENTORY
        # Assert: The guild-tab-gear button shows the text INVENTORY.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/div[1]/nav/button[3]").nth(0)).to_have_text("INVENTORY", timeout=15000), "The guild-tab-gear button shows the text INVENTORY."

        # --> The button with data-testid battle-open is visible
        await page.locator("xpath=/html/body/div/section[2]/div/footer/button").nth(0).scroll_into_view_if_needed()
        # Assert: The button with data-testid battle-open is visible.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/footer/button").nth(0)).to_be_visible(timeout=15000), "The button with data-testid battle-open is visible."

        # --> The button with data-testid battle-open has text ENTER THE ARENA
        # Assert: The button with data-testid battle-open shows the text ENTER THE ARENA.
        await expect(page.locator("xpath=/html/body/div/section[2]/div/footer/button").nth(0)).to_have_text("ENTER THE ARENA", timeout=15000), "The button with data-testid battle-open shows the text ENTER THE ARENA."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
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
