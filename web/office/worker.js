/* Runs the connectome in the background and reports what the page needs every 50 ms. */
importScripts('brain.js');
let brain = null, man = null, speed = 1, paused = false, acc = 0;
let sample = null, sampleOf = null, sampleFlags = null;
let groupOf = null, groupNames = [], groupCounts = null;
const PIN_KEYS = ['apply', 'scroll_l', 'scroll_r', 'sugar', 'bitter', 'hearing'];

async function init(msg) {
  man = await (await fetch('data/manifest.json')).json();
  const total = man.packed.indptr + man.packed.indices + man.packed.weights; let loaded = 0;
  const prog = (b) => { loaded += b; postMessage({ type: 'progress', loaded, total }); };
  const [indptr, indices, weights] = await Promise.all([
    FlyBrain.loadPacked('data/indptr.b64.txt', Uint32Array, prog), FlyBrain.loadPacked('data/indices.b64.txt', Uint32Array, prog), FlyBrain.loadPacked('data/weights.b64.txt', Int16Array, prog)]);
  brain = new FlyBrain(indptr, indices, weights, man.neurons, { seed: (Math.random() * 2 ** 31) | 0 });
  for (const c of man.pins.dopamine || []) brain.daMask[c] = 1;
  // panel sample: the page shows a subset of somas; the worker flags which of them spiked
  sample = new Int32Array(msg.sample); sampleOf = new Int32Array(man.neurons).fill(-1);
  for (let i = 0; i < sample.length; i++) sampleOf[sample[i]] = i;
  sampleFlags = new Uint8Array(sample.length);
  // group membership: pins first, then the panel's cell-type rows
  groupNames = PIN_KEYS.concat(Object.keys(man.groups));
  groupOf = Array.from({ length: man.neurons }, () => null);
  groupNames.forEach((g, gi) => { (man.pins[g] || man.groups[g] || []).forEach((c) => { (groupOf[c] ||= []).push(gi); }); });
  groupCounts = new Uint32Array(groupNames.length);
  for (let i = 0; i < 100; i++) brain.step(); // settle
  postMessage({ type: 'ready', neurons: man.neurons, edges: man.edges, minSyn: man.min_synapses, groups: groupNames,
    sizes: groupNames.map((g) => (man.pins[g] || man.groups[g]).length) });
  setInterval(tick, 50);
}

function tick() {
  if (!brain || paused) return;
  acc += 2.5 * speed;          // 50 ms of wall time = 2.5 steps of 20 ms at 1x
  let steps = Math.floor(acc); acc -= steps;
  groupCounts.fill(0); sampleFlags.fill(0);
  let spikes = 0; const dnSteps = [];
  const t0 = performance.now();
  while (steps-- > 0) {
    const nf = brain.step(); spikes += nf;
    let dn = false;
    for (let k = 0; k < nf; k++) {
      const j = brain.fired[k];
      const s = sampleOf[j]; if (s >= 0) sampleFlags[s] = 1;
      const g = groupOf[j]; if (g) for (const gi of g) { groupCounts[gi]++; if (gi === 0) dn = true; }
    }
    if (dn) dnSteps.push(brain.t);
    if (performance.now() - t0 > 40) { acc = 0; break; } // never fall into a backlog on a slow device
  }
  const flags = sampleFlags.slice();
  postMessage({ type: 'tick', t: brain.t, spikes, counts: Array.from(groupCounts), dn: dnSteps, flags }, [flags.buffer]);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') init(m).catch((err) => postMessage({ type: 'error', message: String(err) }));
  else if (m.type === 'speed') speed = m.speed;
  else if (m.type === 'pause') paused = m.paused;
  else if (m.type === 'tonic' && brain) brain.tonic = brain.tonicBase * m.factor;
  else if (m.type === 'dopamine' && brain) brain.daGain = m.gain;
  else if (m.type === 'stim' && brain) brain.stimulate(man.pins[m.group] || man.groups[m.group] || [], m.seconds);
};
