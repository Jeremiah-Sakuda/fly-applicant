"""Playwright glue: DNg100 spikes become real clicks and keystrokes in a real browser."""
from __future__ import annotations

import asyncio
import base64
import json
import string
import subprocess
import time
from pathlib import Path

from playwright.async_api import async_playwright

from .server import FlyServer

BOARD_VIEWPORT = {"width": 900, "height": 1200}
STUDIO_VIEWPORT = {"width": 540, "height": 960}   # x2 device scale = 1080x1920
LETTERS = string.ascii_lowercase + "     "
DEBUG = bool(__import__("os").environ.get("FLYJOBS_DEBUG"))


class Recorder:
    """Constant-frame-rate H.264 writer fed from CDP screencast frames."""

    def __init__(self, path: Path, fps: int = 30):
        self.path = path; self.fps = fps
        self.latest: bytes | None = None
        self.frames = 0
        path.parent.mkdir(parents=True, exist_ok=True)
        self.proc = subprocess.Popen(
            ["ffmpeg", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
             "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
             "-movflags", "+faststart", str(path)],
            stdin=subprocess.PIPE,
        )
        self.task: asyncio.Task | None = None
        self.t0 = 0.0

    async def tick(self):
        self.t0 = time.perf_counter()
        while True:
            due = self.t0 + self.frames / self.fps
            await asyncio.sleep(max(0.0, due - time.perf_counter()))
            if self.latest is not None:
                try:
                    self.proc.stdin.write(self.latest)
                except BrokenPipeError:
                    return
                self.frames += 1

    def close(self):
        if self.task:
            self.task.cancel()
        if self.proc.stdin:
            self.proc.stdin.close()
        self.proc.wait()


async def screencast(page, on_frame, *, quality: int, max_w: int, max_h: int):
    cdp = await page.context.new_cdp_session(page)

    async def handle(p):
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception:
            pass
        on_frame(base64.b64decode(p["data"]))

    cdp.on("Page.screencastFrame", lambda p: asyncio.ensure_future(handle(p)))
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": quality, "maxWidth": max_w, "maxHeight": max_h, "everyNthFrame": 1})
    return cdp


async def run(a) -> None:
    srv = FlyServer(a.cache, interview_at=a.interview_at, target=a.target)
    await srv.start(a.port)
    base = f"http://127.0.0.1:{a.port}"
    print(f"studio: {base}/studio.html   board: {base}/board.html")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=a.headless,
            args=["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=metal",
                  "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
                  "--disable-backgrounding-occluded-windows"],
        )
        board_ctx = await browser.new_context(viewport=BOARD_VIEWPORT)
        board = await board_ctx.new_page()
        await board.goto(f"{base}/board.html")
        await board.wait_for_selector("#easy")

        studio_ctx = await browser.new_context(viewport=STUDIO_VIEWPORT, device_scale_factor=2)
        studio = await studio_ctx.new_page()
        await studio.goto(f"{base}/studio.html?rec=1")
        await studio.wait_for_function("window.__studio && window.__studio.ready", timeout=60_000)

        # board pixels -> the 3D monitor
        def board_frame(jpg: bytes):
            srv.frames.push(jpg)
        await screencast(board, board_frame, quality=82, max_w=900, max_h=1200)

        rec = None
        if a.record:
            rec = Recorder(a.record)

            def studio_frame(jpg: bytes):
                rec.latest = jpg
            await screencast(studio, studio_frame, quality=92, max_w=1080, max_h=1920)
            rec.task = asyncio.create_task(rec.tick())
            print(f"recording -> {a.record}")

        if a.autostart:
            await asyncio.sleep(2.0)
            await srv.command({"cmd": "start"})

        async def act(kind: str, value: float):
            if kind == "scroll":
                await board.mouse.move(450, 1000)
                await board.mouse.wheel(0, 120 if value > 0 else -120)
                await srv.emit(dict(type="action", kind="scroll"))
                return
            target = board.locator('[data-fly="primary"]')
            if await target.count() == 0:
                return
            tag = await target.evaluate("el => el.tagName")
            if tag == "TEXTAREA":
                # typing mode: each DNg100 spike is one keystroke, the letter picked by the spike count
                letter = LETTERS[srv.brain.steps % len(LETTERS)]
                await target.focus()
                await board.keyboard.type(letter)
                await srv.emit(dict(type="action", kind="key", letter=letter))
            else:
                box = await target.bounding_box()
                if not box:
                    return
                x = box["x"] + box["width"] * 0.5; y = box["y"] + box["height"] * 0.55
                await board.mouse.move(x, y, steps=4)
                await board.mouse.click(x, y)
                await srv.emit(dict(type="action", kind="click"))

        try:
            while True:
                kind, value = await srv.actions.get()
                # coalesce stale scrolls so the queue never lags the brain
                if kind == "scroll" and srv.actions.qsize() > 2:
                    continue
                try:
                    t_act = time.perf_counter()
                    await act(kind, value)
                    if DEBUG:
                        print(f"{kind:6s} {1000 * (time.perf_counter() - t_act):6.0f} ms  queue {srv.actions.qsize()}")
                except Exception as err:  # the board moved under the cursor; the next spike tries again
                    print("action failed:", type(err).__name__)
                if srv.state["apps"] >= a.target and not srv.running.is_set():
                    await asyncio.sleep(12)  # let the last rejections land on camera
                    break
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            if rec:
                rec.close()
                events = a.record.with_suffix(".events.json")
                events.write_text(json.dumps(dict(record_t0=rec.t0 - time.perf_counter() + srv.now(), fps=rec.fps,
                                                  frames=rec.frames, events=srv.log), indent=1))
                print(f"wrote {a.record} ({rec.frames} frames) and {events}")
            srv.stop_flag.set()
            await browser.close()
