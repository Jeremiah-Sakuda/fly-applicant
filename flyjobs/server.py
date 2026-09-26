"""One process: the brain simulation thread, the job-market server, and the websocket hubs."""
from __future__ import annotations

import asyncio
import json
import struct
import threading
import time
from pathlib import Path

import numpy as np
from aiohttp import WSMsgType, web

from .model import Brain
from .outcomes import INMAILS, Market

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"

MSG_SPIKES, MSG_FRAME = 1, 2


def viewer_points(cache: Path) -> tuple[bytes, dict]:
    """Map real soma positions (8 nm voxels) into the hologram fly's body frame.

    MaleCNS axes: x = left-right, y = dorsal->ventral, z = anterior->posterior
    (the ventral nerve cord trails toward high z). The fly body model has the head
    at +x and dorsal at +y, so body x = -z, body y = -y, body z = x.
    """
    m = np.load(cache / "model.npz", allow_pickle=False)
    p = m["positions"].astype(np.float64)
    ok = m["measured"]
    s = 1.23e-5                      # 1 hologram unit ~ 0.65 mm, 1 voxel = 8 nm
    cx = np.nanmedian(p[ok & (m["kind"] != 2), 0])
    out = np.zeros((len(p), 3), np.float32)
    out[:, 0] = 1.78 - (p[:, 2] - 30000) * s
    out[:, 1] = 0.05 - (p[:, 1] - 33000) * s
    out[:, 2] = (p[:, 0] - cx) * s
    out[~ok] = 0
    kind = m["kind"].copy()
    kind[~ok] = 255                  # no soma coordinate: hidden in the viewer
    skel = json.loads((cache / "skeletons.json").read_text())
    ids = m["ids"]
    segs = []
    for gi, group in enumerate(("apply", "sugar", "bitter")):
        for body, branches in skel[group].items():
            idx = int(np.searchsorted(ids, int(body)))
            seg = skeleton_segments(branches, cx, s, out[idx] if ok[idx] else None)
            if kind[idx] == 255:
                # peripheral sensory cell: show its point at the centroid of its terminal arbor
                out[idx] = seg[:, :3].mean(0)
                kind[idx] = m["kind"][idx]
            segs.append(np.column_stack((seg, np.full(len(seg), gi))))
    seg = np.concatenate(segs).astype(np.float32)
    meta = dict(n=int(len(p)), measured=int(ok.sum()), apply=m["apply"].tolist(), sugar=m["sugar"].tolist(),
                bitter=m["bitter"].tolist(), scroll=np.concatenate((m["scroll_l"], m["scroll_r"])).tolist(),
                somas=[out[i].tolist() for i in m["apply"]], skeleton_vertices=int(len(seg)),
                skeleton_max=float(seg[seg[:, 4] == 0, 3].max()))
    return out.tobytes() + kind.tobytes() + seg.tobytes(), meta


def skeleton_segments(branches, cx, s, root) -> np.ndarray:
    """Line-segment pairs (x, y, z, path distance from soma) in body coordinates."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra
    key = {}
    pts = []
    edges = []
    for br in branches:
        b = np.asarray(br, np.float64)
        q = np.column_stack((1.78 - (b[:, 2] - 30000) * s, 0.05 - (b[:, 1] - 33000) * s, (b[:, 0] - cx) * s))
        prev = None
        for v, raw in zip(q, map(tuple, b)):
            if raw not in key:
                key[raw] = len(pts); pts.append(v)
            i = key[raw]
            if prev is not None and prev != i:
                edges.append((prev, i))
            prev = i
    pts = np.asarray(pts); e = np.asarray(edges)
    w = np.linalg.norm(pts[e[:, 0]] - pts[e[:, 1]], axis=1) + 1e-9
    g = coo_matrix((w, (e[:, 0], e[:, 1])), shape=(len(pts), len(pts))).tocsr()
    if root is None:  # sensory axon: distance from its most anterior-ventral point (nerve entry)
        start = int(np.argmin(-pts[:, 0] * 1.0 + pts[:, 1]))
    else:
        start = int(np.argmin(((pts - root) ** 2).sum(1)))
    d = dijkstra(g, directed=False, indices=start)
    d[~np.isfinite(d)] = d[np.isfinite(d)].max()
    a, b = e[:, 0], e[:, 1]
    seg = np.empty((len(e) * 2, 4))
    seg[0::2, :3] = pts[a]; seg[0::2, 3] = d[a]
    seg[1::2, :3] = pts[b]; seg[1::2, 3] = d[b]
    return seg
    return out.tobytes() + kind.tobytes(), meta


class Hub:
    def __init__(self):
        self.clients: set[web.WebSocketResponse] = set()

    async def send(self, data):
        dead = []
        for ws in list(self.clients):
            try:
                if isinstance(data, (bytes, bytearray)):
                    await ws.send_bytes(data)
                else:
                    await ws.send_str(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)


class Stream:
    """Coalescing sender: pushes between sends are merged, so a slow client never builds a backlog."""

    def __init__(self, hub: Hub, merge):
        self.hub, self.merge = hub, merge
        self.buf: list = []
        self.ready = asyncio.Event()

    def push(self, item):
        self.buf.append(item)
        self.ready.set()

    async def run(self):
        while True:
            await self.ready.wait()
            self.ready.clear()
            items, self.buf = self.buf, []
            if items and self.hub.clients:
                await self.hub.send(self.merge(items))


def merge_spikes(items: list[tuple[float, np.ndarray]]) -> bytes:
    t = items[-1][0]
    idx = np.concatenate([i for _, i in items]) if len(items) > 1 else items[0][1]
    return struct.pack("<Bf", MSG_SPIKES, t) + idx.astype(np.uint32).tobytes()


def latest_frame(items: list[bytes]) -> bytes:
    return bytes([MSG_FRAME]) + items[-1]


class FlyServer:
    def __init__(self, cache: Path, seed: int = 7, market_seed: int = 1000, interview_at: int = 612, target: int = 1000):
        self.cache = cache
        self.brain = Brain(cache, seed=seed)
        self.market = Market(seed=market_seed, interview_at=interview_at)
        self.target = target
        self.points_bin, self.meta = viewer_points(cache)
        self.studio = Hub()
        self.board = Hub()
        self.actions: asyncio.Queue | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self.running = threading.Event()
        self.stop_flag = threading.Event()
        self.state = dict(apps=0, rejections=0, interviews=0, t=0.0, running=False, target=target, started=None)
        self.log: list[dict] = []
        self.pending: dict[int, dict] = {}
        self.t0 = time.time()

    # ---------- brain thread ----------
    def brain_thread(self):
        dt = self.brain.dt
        nxt = time.perf_counter()
        last_scroll = 0.0
        while not self.stop_flag.is_set():
            r = self.brain.step()
            self.loop.call_soon_threadsafe(self.spikes.push, (r.t, r.fired))
            if self.running.is_set():
                if r.apply:
                    self.loop.call_soon_threadsafe(self.actions.put_nowait, ("apply", r.t))
                elif r.scroll != 0 and r.t - last_scroll > 1.5:
                    last_scroll = r.t
                    self.loop.call_soon_threadsafe(self.actions.put_nowait, ("scroll", r.scroll))
            nxt += dt
            sleep = nxt - time.perf_counter()
            if sleep > 0:
                time.sleep(sleep)
            else:
                nxt = time.perf_counter()  # fell behind; don't try to catch up

    # ---------- events ----------
    def realtime_factor(self) -> float:
        wall = time.time() - self.t0
        return round(self.brain.t / wall, 3) if wall > 0 else 0.0

    def now(self) -> float:
        return round(time.time() - self.t0, 3)

    async def emit(self, ev: dict):
        ev.setdefault("wall", self.now())
        self.state["sim_t"] = round(self.brain.t, 2)
        ev["state"] = self.state
        self.log.append({**{k: v for k, v in ev.items() if k != "state"}, "sim_t": self.state["sim_t"]})
        msg = json.dumps(ev)
        await self.studio.send(msg)
        await self.board.send(msg)

    async def on_applied(self, posting: dict):
        self.state["apps"] += 1
        n = self.state["apps"]
        kind, delay, text = self.market.outcome(n)
        rec = dict(n=n, company=posting.get("company"), role=posting.get("role"), applied=self.now())
        await self.emit(dict(type="applied", **rec))
        asyncio.get_running_loop().call_later(delay, lambda: asyncio.ensure_future(self.resolve(rec, kind, text)))
        if n % self.market.inmail_every == 0:
            who, body = INMAILS[(n // self.market.inmail_every - 1) % len(INMAILS)]
            await self.emit(dict(type="inmail", sender=who, text=body))
        if n >= self.target:
            self.running.clear()
            self.state["running"] = False
            await self.emit(dict(type="done", text=f"{n:,} applications. It can rest now."))

    async def resolve(self, rec: dict, kind: str, text: str):
        mins = (self.now() - rec["applied"]) / 60
        if kind == "interview":
            self.state["interviews"] += 1
            self.brain.taste("sugar", 0.5)
        else:
            self.state["rejections"] += 1
            self.brain.taste("bitter", 0.5)
        await self.emit(dict(type=kind, n=rec["n"], company=rec["company"], role=rec["role"], text=text,
                             after=round(mins, 2), neurons=len(self.meta["sugar" if kind == "interview" else "bitter"])))

    # ---------- http ----------
    async def ws_studio(self, request):
        ws = web.WebSocketResponse(max_msg_size=0, compress=False)
        await ws.prepare(request)
        self.studio.clients.add(ws)
        await ws.send_str(json.dumps(dict(type="hello", state=self.state)))
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                await self.command(json.loads(msg.data))
        self.studio.clients.discard(ws)
        return ws

    async def ws_board(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.board.clients.add(ws)
        await ws.send_str(json.dumps(dict(type="hello", state=self.state)))
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                d = json.loads(msg.data)
                if d.get("type") == "applied":
                    await self.on_applied(d.get("posting", {}))
                elif d.get("type") == "workdaze":
                    await self.emit(dict(type="workdaze", company=d.get("company")))
        self.board.clients.discard(ws)
        return ws

    async def command(self, d: dict):
        c = d.get("cmd")
        if c == "start":
            self.running.set(); self.state["running"] = True
            self.state["started"] = self.state["started"] or self.now()
            await self.emit(dict(type="start"))
        elif c == "pause":
            self.running.clear(); self.state["running"] = False
            await self.emit(dict(type="pause"))
        elif c == "shot":
            self.log.append(dict(type="shot", shot=d.get("shot"), wall=self.now()))
        elif c in ("sugar", "bitter"):
            self.brain.taste(c, 0.5)
            await self.emit(dict(type="manual_" + c))

    async def posting(self, request):
        return web.json_response(self.market.posting().as_dict())

    async def points(self, request):
        return web.Response(body=self.points_bin, content_type="application/octet-stream")

    async def meta_json(self, request):
        return web.json_response(self.meta)

    async def events(self, request):
        return web.json_response(self.log)

    def app(self) -> web.Application:
        app = web.Application()
        app.router.add_get("/ws/studio", self.ws_studio)
        app.router.add_get("/ws/board", self.ws_board)
        app.router.add_get("/api/posting", self.posting)
        app.router.add_get("/api/events", self.events)
        app.router.add_get("/data/points.bin", self.points)
        app.router.add_get("/data/meta.json", self.meta_json)
        app.router.add_get("/", lambda r: web.HTTPFound("/studio.html"))
        app.router.add_static("/", WEB)
        return app

    async def start(self, port: int = 8765):
        self.loop = asyncio.get_running_loop()
        self.actions = asyncio.Queue()
        self.spikes = Stream(self.studio, merge_spikes)
        self.frames = Stream(self.studio, latest_frame)
        self.tasks = [asyncio.create_task(self.spikes.run()), asyncio.create_task(self.frames.run())]
        runner = web.AppRunner(self.app())
        await runner.setup()
        await web.TCPSite(runner, "127.0.0.1", port).start()
        threading.Thread(target=self.brain_thread, daemon=True).start()
        return runner
