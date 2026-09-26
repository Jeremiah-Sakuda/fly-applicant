"""Close-ups of the monitor's special screens: AI interview and the Workdaze portal."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-angle=metal"])
        p = await b.new_page(viewport={"width": 1440, "height": 900})
        await p.goto("http://127.0.0.1:8777/office/index.html")
        await p.wait_for_function("window.__office && window.__office.B.ready", timeout=90_000)
        await p.click("[data-speed='4']")
        await p.wait_for_function("__office.job.state === 'APPLYING'", timeout=60_000)
        await p.click("[data-speed='1']")
        await p.evaluate("__office.job.posting.workdaze = true")
        await p.evaluate("__office.setCam('desk')")
        await p.wait_for_function("__office.job.portal && __office.job.portal.typed.length > 6", timeout=60_000)
        await p.screenshot(path="out/scr_portal.png")
        await p.wait_for_function("!__office.job.portal", timeout=60_000)
        await p.click("#bInt")
        await p.wait_for_function("__office.job.state === 'INTERVIEW' && __office.job.interview.words.length > 2", timeout=60_000)
        await p.screenshot(path="out/scr_ai_q.png")
        await p.wait_for_function("__office.job.interview && __office.job.interview.phase === 'result'", timeout=60_000)
        await p.wait_for_timeout(800)
        await p.screenshot(path="out/scr_ai_result.png")
        await p.click("#bPhone") if await p.locator("#phone.closed").count() else None
        await p.locator(".fm-row").first.click()
        await p.wait_for_timeout(500)
        await p.locator("#phone").screenshot(path="out/scr_mail.png")
        await b.close()

asyncio.run(main())
