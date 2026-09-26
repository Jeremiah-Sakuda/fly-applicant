"""Cut a recorded run into the 35-second reel, using the run's own event log.

Every clip is real footage from the run. Only the time-lapse is sped up.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from playwright.async_api import async_playwright

W, H, FPS = 1080, 1920, 30

CAPTION_HTML = """<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
html,body{margin:0;width:1080px;height:1920px;background:transparent}
.cap{position:absolute;left:70px;right:70px;bottom:%(bottom)dpx;display:flex;flex-direction:column;align-items:%(align)s;gap:18px}
.line{font-family:'Bricolage Grotesque','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:%(size)dpx;line-height:1.08;
 letter-spacing:-.02em;color:#e9e5d9;background:rgba(7,8,12,.84);padding:14px 26px 18px;border-radius:14px;text-wrap:balance;text-align:%(talign)s;max-width:100%%}
.line em{font-style:normal;color:%(accent)s}
.small{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:34px;color:#8f95a5;background:rgba(7,8,12,.84);padding:10px 18px;border-radius:10px}
</style></head><body><div class="cap">%(body)s</div></body></html>"""


@dataclass
class Clip:
    start: float          # seconds into the recording
    dur: float            # output duration
    speed: float = 1.0
    caption: str = ""
    small: str = ""
    accent: str = "#ffc44d"
    freeze: float = 0.0   # hold the last frame this long
    center: bool = False
    size: int = 76


def run(cmd):
    subprocess.run(cmd, check=True)


async def render_captions(clips: list[Clip], d: Path) -> list[Path | None]:
    out: list[Path | None] = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={"width": W, "height": H})
        for i, c in enumerate(clips):
            if not c.caption and not c.small:
                out.append(None); continue
            body = (f'<div class="line">{c.caption}</div>' if c.caption else "") + (f'<div class="small">{c.small}</div>' if c.small else "")
            await pg.set_content(CAPTION_HTML % dict(body=body, accent=c.accent, size=c.size,
                                                     bottom=820 if c.center else 150,
                                                     align="center" if c.center else "flex-start",
                                                     talign="center" if c.center else "left"))
            await pg.wait_for_timeout(400)
            p = d / f"cap_{i}.png"
            await pg.screenshot(path=str(p), omit_background=True)
            out.append(p)
        await b.close()
    return out


def plan(ev: dict) -> list[Clip]:
    t0 = ev["record_t0"]
    events = ev["events"]
    total = ev["frames"] / ev["fps"]

    def rt(e):  # recording time of an event
        return e["wall"] - t0

    def first(pred, after=0.0, default=None):
        for e in events:
            if pred(e) and rt(e) >= after:
                return e
        return default

    def shot_at(t):
        cur = None
        for e in events:
            if e["type"] == "shot" and rt(e) <= t:
                cur = e["shot"]
        return cur

    def window(shot, dur, after, before=None):
        """Start of the first stretch of at least `dur` seconds on one camera shot."""
        shots = [e for e in events if e["type"] == "shot"]
        for a, b in zip(shots, shots[1:] + [dict(wall=t0 + total, shot=None)]):
            s, e = max(rt(a), after), rt(b)
            if a["shot"] == shot and e - s >= dur + 0.8 and (before is None or s < before):
                return s + 0.8   # skip the camera move into the shot
        return after

    applied = [e for e in events if e["type"] == "applied"]
    start = rt(applied[0]) if applied else 3.0
    interview = first(lambda e: e["type"] == "interview")
    workdaze = first(lambda e: e["type"] == "workdaze", after=start + 60)
    inmail = first(lambda e: e["type"] == "inmail" and "vinegar" in e.get("text", "").lower())
    rejections = [e for e in events if e["type"] == "rejection"]
    slow = None
    if rejections:
        # the slowest "no" whose notification stays on screen: no other rejection within 2.5 s after it
        times = sorted(rt(e) for e in rejections)
        import bisect
        def isolated(e):
            i = bisect.bisect_right(times, rt(e))
            return i >= len(times) or times[i] - rt(e) > 2.5
        pool = [e for e in rejections if isolated(e)] or rejections
        slow = max(pool, key=lambda e: e.get("after", 0))
    wasp = first(lambda e: e["type"] == "rejection" and "other flies" in e.get("text", ""), after=start + 30)
    n1000 = first(lambda e: e["type"] == "done")

    clips = [
        # Hook: already mid-action, on the desk shot
        Clip(window("desk", 3.0, start), 3.0, caption="I gave a fruit fly's brain<br>a job board account."),
        # Setup: brain close-up, DNg100 pulses visible
        Clip(window("brain", 3.2, start), 3.2, caption="166,700 real neurons.<br><em>DNg100</em> walks it forward.", accent="#9bff6b",
             small="MaleCNS v1.0 connectome"),
        Clip(window("screen", 3.0, start), 3.0, caption="Now it clicks <em>Easy Apply</em>."),
    ]
    # Reward: time-lapse across most of the run
    tl_from = start + 40
    tl_to = (rt(n1000) if n1000 else total) - 2
    tl_out = 8.0
    clips.append(Clip(tl_from, tl_out, speed=max(1.0, (tl_to - tl_from) / tl_out),
                      caption="Rejection → <em style='color:#ff5c8a'>bitter neurons</em>.<br>Interview → <em>sugar neurons</em>."))
    # Montage
    if slow:
        m = slow["after"]
        when = f"{m * 60:.0f} seconds" if m < 1.5 else f"{m:.0f} minutes"
        clips.append(Clip(max(0, rt(slow) - 0.6), 3.0, caption="", small=f"rejected {when} after applying"))
    if workdaze:
        clips.append(Clip(max(0, rt(workdaze) + 4.5), 3.4, small="Workdaze wants the résumé retyped. with one leg."))
    if wasp:
        clips.append(Clip(max(0, rt(wasp) - 0.5), 2.2))
    if inmail:
        clips.append(Clip(max(0, rt(inmail) - 0.4), 2.0))
    # Closer: the callback
    if interview:
        clips.append(Clip(max(0, rt(interview) - 0.4), 2.6, caption="It got a callback.", freeze=0.2))
        clips.append(Clip(max(0, rt(interview) + 2.2), 0.1, caption="It got a callback.<br><em style='color:#8f95a5'>I didn't.</em>", freeze=2.2))
    clips.append(Clip(max(0, (rt(n1000) if n1000 else total) - 0.2), 2.5, caption="technically it's button mashing.<br><em style='color:#8f95a5'>so is my job search.</em>",
                      center=True, size=64))
    return clips


def cut(recording: Path, out: Path, captions: bool = True) -> Path:
    ev = json.loads(recording.with_suffix(".events.json").read_text())
    clips = plan(ev)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        caps = asyncio.run(render_captions(clips, d)) if captions else [None] * len(clips)
        parts = []
        for i, (c, cap) in enumerate(zip(clips, caps)):
            p = d / f"part_{i:02d}.mp4"
            src_dur = c.dur * c.speed
            vf = f"[0:v]trim=duration={src_dur:.3f},setpts=(PTS-STARTPTS)/{c.speed:.4f},fps={FPS}"
            if c.freeze:
                vf += f",tpad=stop_mode=clone:stop_duration={c.freeze:.2f}"
            vf += ",scale=1080:1920,setsar=1[v]"
            cmd = ["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{c.start:.3f}", "-i", str(recording)]
            if cap:
                cmd += ["-loop", "1", "-i", str(cap)]
                vf += ";[v][1:v]overlay=0:0:shortest=1[v2]"
                label = "[v2]"
            else:
                label = "[v]"
            cmd += ["-filter_complex", vf, "-map", label, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                    "-pix_fmt", "yuv420p", "-r", str(FPS), str(p)]
            run(cmd)
            parts.append(p)
        lst = d / "list.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in parts))
        run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)])
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)],
                               capture_output=True, text=True).stdout.strip())
    print(f"wrote {out} · {dur:.1f} s · {len(clips)} clips")
    for c in clips:
        print(f"  src {c.start:8.1f}s  {c.dur:4.1f}s  x{c.speed:5.1f}  {c.caption.replace('<br>', ' / ')[:60]}")
    return out
