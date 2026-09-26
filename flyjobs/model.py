"""Leaky integrate-and-fire dynamics over the MaleCNS wiring.

Measured wiring, modeled dynamics. Parameters follow Fly64 (dt 20 ms, tau 100 ms,
tonic drive just under threshold, sparse Poisson kicks). There is no visual input:
the only stimulus is the taste-neuron current the job board sends back.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy import sparse


@dataclass
class Readout:
    t: float
    apply_rate: float     # mean DNg100 spikes per step over the ~260 ms window
    scroll: float         # +1 right steering DN spiked, -1 left, 0 neither
    apply: bool           # DNg100 crossed threshold this step
    fired: np.ndarray     # indices of every neuron that spiked this step


class Brain:
    dt = 0.020
    tau = 0.100
    threshold = 1.0
    tonic = 0.180
    kick_rate = 1.2       # Hz of random 0.22 kicks per neuron
    kick = 0.22
    gain = 1.50
    taste_current = 0.9   # added per step to stimulated GRNs
    window = 13           # ~260 ms readout window

    def __init__(self, cache: Path = Path("data"), seed: int = 7):
        m = np.load(cache / "model.npz", allow_pickle=False)
        self.ids = m["ids"]; self.n = len(self.ids)
        self.pin_apply = m["apply"]; self.pin_sl = m["scroll_l"]; self.pin_sr = m["scroll_r"]
        self.pin_sugar = m["sugar"]; self.pin_bitter = m["bitter"]
        w = sparse.load_npz(cache / "weights.npz")
        self.w = w.tocsc() if w.format != "csc" else w
        self.rng = np.random.default_rng(seed)
        self.v = self.rng.uniform(0, 1, self.n).astype(np.float32)
        self.fired = np.zeros(0, np.int64)
        self.decay = np.float32(np.exp(-self.dt / self.tau))
        self.hist = deque(maxlen=self.window)
        self.steps = 0
        self.sugar_until = -1.0
        self.bitter_until = -1.0
        self.refractory_until = 0.0
        self.min_gap = 0.5  # seconds between clicks, keeps the browser sane

    @property
    def t(self) -> float:
        return self.steps * self.dt

    def taste(self, which: str, seconds: float = 0.5) -> None:
        if which == "sugar":
            self.sugar_until = self.t + seconds
        else:
            self.bitter_until = self.t + seconds

    def step(self) -> Readout:
        if len(self.fired):
            w = self.w
            cols = self.fired
            # sum columns of spiking cells without building a submatrix
            starts = w.indptr[cols]; ends = w.indptr[cols + 1]
            lens = ends - starts
            idx = np.repeat(starts - np.concatenate(([0], np.cumsum(lens)[:-1])), lens) + np.arange(lens.sum())
            current = np.bincount(w.indices[idx], weights=w.data[idx], minlength=self.n).astype(np.float32)
            current *= self.gain
        else:
            current = 0.0
        self.v *= self.decay
        self.v += current + self.tonic
        kicks = self.rng.random(self.n) < self.kick_rate * self.dt
        self.v[kicks] += self.kick
        t = self.t
        if t < self.sugar_until:
            self.v[self.pin_sugar] += self.taste_current
        if t < self.bitter_until:
            self.v[self.pin_bitter] += self.taste_current
        fired_mask = self.v >= self.threshold
        self.v[fired_mask] = 0.0
        self.fired = np.flatnonzero(fired_mask)
        motor = np.concatenate((fired_mask[self.pin_apply], fired_mask[self.pin_sl], fired_mask[self.pin_sr])).astype(np.float32)
        self.hist.append(motor)
        self.steps += 1
        rec = np.mean(self.hist, axis=0)
        na, nl = len(self.pin_apply), len(self.pin_sl)
        apply_rate = float(rec[:na].mean())
        # One DNg100 spike = one click, with a short refractory so the browser can keep up.
        apply = bool(fired_mask[self.pin_apply].any()) and t >= self.refractory_until
        if apply:
            self.refractory_until = t + self.min_gap
        sl = bool(fired_mask[self.pin_sl].any()); sr = bool(fired_mask[self.pin_sr].any())
        scroll = float(sr) - float(sl)
        return Readout(t, apply_rate, scroll, apply, self.fired)
