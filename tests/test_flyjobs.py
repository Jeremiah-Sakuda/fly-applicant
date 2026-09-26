import struct
from pathlib import Path

import numpy as np
import pytest

from flyjobs.data import read_skeleton, skeleton_polylines
from flyjobs.outcomes import Market

DATA = Path(__file__).resolve().parent.parent / "data"
needs_data = pytest.mark.skipif(not (DATA / "manifest.json").exists(), reason="run `python -m flyjobs prepare` first")


def test_market_has_exactly_one_scripted_interview():
    m = Market(seed=3, interview_at=12)
    kinds = [m.outcome(n)[0] for n in range(1, 1001)]
    assert kinds.count("interview") == 1 and kinds[11] == "interview"
    assert all(4.0 <= m.outcome(n)[1] <= 240.0 for n in range(1, 200))


def test_market_postings_are_deterministic_and_route_some_through_workdaze():
    a, b = Market(seed=5), Market(seed=5)
    pa = [a.posting() for _ in range(80)]
    pb = [b.posting() for _ in range(80)]
    assert [p.role for p in pa] == [p.role for p in pb]
    assert sum(p.workdaze for p in pa) == 2


def test_read_skeleton_roundtrip():
    verts = np.array([[0, 0, 0], [8, 0, 0], [16, 0, 0], [16, 8, 0]], "<f4")
    edges = np.array([[0, 1], [1, 2], [2, 3]], "<u4")
    raw = struct.pack("<II", 4, 3) + verts.tobytes() + edges.tobytes()
    v, e = read_skeleton(raw)
    assert np.array_equal(v, verts) and np.array_equal(e, edges)
    lines = skeleton_polylines(v, e, v[0], min_len=2)
    assert sum(len(l) for l in lines) == 4


@needs_data
def test_pins_resolve_to_the_published_cell_types():
    m = np.load(DATA / "model.npz")
    ctype = m["ctype"]
    assert set(ctype[m["apply"]]) == {"DNg100"} and len(m["apply"]) == 2
    assert len(m["sugar"]) == 23 and len(m["bitter"]) == 38
    assert len(m["ids"]) == 166_700


@needs_data
def test_brain_spikes_and_taste_input_drives_grns():
    from flyjobs.model import Brain
    b = Brain(DATA, seed=1)
    for _ in range(50):
        r = b.step()
    assert 1_000 < len(r.fired) < 60_000
    b.taste("bitter", 0.5)
    fired_bitter = 0
    for _ in range(25):
        r = b.step()
        fired_bitter += np.isin(r.fired, b.pin_bitter).sum()
    # a 0.9/step current pushes every bitter GRN over threshold every other step or so
    assert fired_bitter > len(b.pin_bitter) * 5


@needs_data
def test_dng100_fires_without_any_task_input():
    from flyjobs.model import Brain
    b = Brain(DATA, seed=2)
    applies = sum(b.step().apply for _ in range(1500))  # 30 s of simulated time
    assert applies >= 10


@needs_data
def test_viewer_points_layout():
    from flyjobs.server import viewer_points
    buf, meta = viewer_points(DATA)
    n = meta["n"]
    seg = np.frombuffer(buf[n * 13:], np.float32).reshape(-1, 5)
    assert len(seg) == meta["skeleton_vertices"] and set(np.unique(seg[:, 4])) == {0.0, 1.0, 2.0}
    pos = np.frombuffer(buf[:n * 12], np.float32).reshape(n, 3)
    kind = np.frombuffer(buf[n * 12:n * 13], np.uint8)
    head = pos[(kind != 255) & (kind != 2)]
    assert np.median(head[:, 0]) > 1.3  # brain sits in the hologram's head
