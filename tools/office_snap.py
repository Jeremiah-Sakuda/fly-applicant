"""Headless tour of the Fly Office page: python tools/office_snap.py [url] [out_prefix]"""
import asyncio, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8777/office/index.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "out/office"

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--use-angle=metal", "--ignore-gpu-blocklist"])
        p = await b.new_page(viewport={"width": 1440, "height": 900})
        logs = []
        p.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        p.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
        await p.goto(URL)
        await p.wait_for_function("window.__office && window.__office.B.ready", timeout=90_000)
        state = "({state: __office.job.state, clock: Math.round(__office.job.clock), apps: __office.job.apps, rej: __office.job.rejs, ghost: __office.job.ghosted, ai: __office.job.aiInts, mails: __office.FlyMail.mails.length, fps: Math.round(__office.fps)})"
        shots = [("night", 2.5, None), ("bed", 2, "[data-cam=bed]"), ("fast", 0.2, "[data-speed='4']"), ("morning", 9, "[data-cam=window]"),
                 ("desk", 8, "[data-cam=desk]"), ("follow", 8, "[data-cam=follow]"), ("ai", 3, "#bInt"), ("interview", 6, "[data-cam=desk]"),
                 ("interview2", 5, None), ("room_day", 4, "[data-cam=room]"), ("dusk", 18, "[data-cam=window]"), ("room_eve", 10, "[data-cam=room]")]
        for name, secs, action in shots:
            if action:
                await p.click(action)
            await p.wait_for_timeout(int(secs * 1000))
            await p.screenshot(path=f"{OUT}_{name}.png")
            print(name, await p.evaluate(state))
        await p.set_viewport_size({"width": 390, "height": 844})
        await p.wait_for_timeout(1200)
        await p.click("#bPhone")
        await p.wait_for_timeout(800)
        await p.screenshot(path=f"{OUT}_mobile.png")
        print("\n".join(logs[:20]) or "no console errors")
        await b.close()

asyncio.run(main())
