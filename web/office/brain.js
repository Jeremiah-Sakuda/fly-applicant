/* Leaky integrate-and-fire over the MaleCNS wiring, sized for a browser.
   Same model as flyjobs/model.py: dt 20 ms, tau 100 ms, tonic drive just under
   threshold, sparse random kicks. Runs in a Web Worker or in Node for tests. */
(function (root) {
  'use strict';
  class FlyBrain {
    constructor(indptr, indices, weights, n, opts = {}) {
      this.n = n; this.indptr = indptr; this.indices = indices;
      this.w = new Float32Array(weights.length);
      const g = (opts.gain ?? 1.5) / 32767;
      for (let i = 0; i < weights.length; i++) this.w[i] = weights[i] * g;
      this.dt = 0.02; this.decay = Math.exp(-this.dt / 0.1);
      this.threshold = 1; this.tonicBase = opts.tonic ?? 0.18; this.tonic = this.tonicBase;
      this.kickRate = 1.2; this.kick = 0.22; this.taste = 0.9;
      this.v = new Float32Array(n); this.cur = new Float32Array(n);
      this.seed = (opts.seed ?? 7) >>> 0 || 1;
      for (let i = 0; i < n; i++) this.v[i] = this.rand();
      this.fired = new Uint32Array(n); this.nf = 0;
      this.stims = [];   // {cells: Uint32Array, until: t}
      // Dopamine receptor sensitivity: a model knob, not part of the connectome. It scales every
      // synapse made by a dopaminergic neuron, so tolerance weakens dopamine's effect downstream.
      this.daMask = new Uint8Array(n); this.daGain = 1;
      this.steps = 0;
    }
    rand() { // xorshift32
      let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0; return this.seed / 4294967296;
    }
    get t() { return this.steps * this.dt; }
    stimulate(cells, seconds) { this.stims.push({ cells, until: this.t + seconds }); }
    step() {
      const { n, v, cur, indptr, indices, w, fired } = this;
      cur.fill(0);
      const da = this.daMask, gain = this.daGain;
      for (let k = 0; k < this.nf; k++) {
        const j = fired[k];
        if (da[j]) { for (let e = indptr[j], end = indptr[j + 1]; e < end; e++) cur[indices[e]] += w[e] * gain; }
        else for (let e = indptr[j], end = indptr[j + 1]; e < end; e++) cur[indices[e]] += w[e];
      }
      const d = this.decay, tonic = this.tonic;
      for (let i = 0; i < n; i++) v[i] = v[i] * d + cur[i] + tonic;
      // random kicks: expected n*rate*dt cells, drawn directly instead of one coin per cell
      const lam = n * this.kickRate * this.dt;
      const kicks = Math.round(lam + Math.sqrt(lam) * (this.rand() + this.rand() + this.rand() - 1.5) * 2);
      for (let k = 0; k < kicks; k++) v[(this.rand() * n) | 0] += this.kick;
      const t = this.t;
      this.stims = this.stims.filter((s) => s.until > t);
      for (const s of this.stims) for (const c of s.cells) v[c] += this.taste;
      let nf = 0;
      const thr = this.threshold;
      for (let i = 0; i < n; i++) if (v[i] >= thr) { v[i] = 0; fired[nf++] = i; }
      this.nf = nf;
      this.steps++;
      return nf;
    }
  }
  // Data ships as gzip inside base64 text (artifact hosts only serve web file types).
  FlyBrain.loadPacked = async function (url, T, onBytes) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const reader = res.body.getReader(); const parts = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (onBytes) onBytes(value.length); }
    let text = ''; const dec = new TextDecoder();
    for (const p of parts) text += dec.decode(p, { stream: true });
    text += dec.decode();
    const bin = atob(text.trim()); const gz = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) gz[i] = bin.charCodeAt(i);
    const buf = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return new T(buf);
  };
  root.FlyBrain = FlyBrain;
  if (typeof module !== 'undefined') module.exports = FlyBrain;
})(typeof self !== 'undefined' ? self : this);
