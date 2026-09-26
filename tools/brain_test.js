// node tools/brain_test.js : firing rates of the browser brain under the page's conditions
const fs = require('fs'); const path = require('path');
const FlyBrain = require('../web/office/brain.js');
const d = path.join(__dirname, '../web/office/data');
const zlib = require('zlib');
const rd = (f, T) => { const b = zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(d, f.replace('.bin', '.b64.txt')), 'utf8'), 'base64')); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const man = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')));
const b = new FlyBrain(rd('indptr.bin', Uint32Array), rd('indices.bin', Uint32Array), rd('weights.bin', Int16Array), man.neurons);
const sets = Object.fromEntries(Object.entries(man.pins).map(([k, v]) => [k, new Set(v)]));
function run(secs, label, setup) {
  if (setup) setup();
  const steps = Math.round(secs / 0.02); const c = { apply: 0, scroll_l: 0, scroll_r: 0, bitter: 0, hearing: 0 }; let tot = 0; const t0 = Date.now();
  for (let s = 0; s < steps; s++) {
    const nf = b.step(); tot += nf;
    for (let k = 0; k < nf; k++) { const j = b.fired[k]; for (const key in c) if (sets[key].has(j)) c[key]++; }
  }
  const hz = (key) => (c[key] / secs / sets[key].size).toFixed(2);
  console.log(`${label.padEnd(20)} spikes/step ${(tot / steps).toFixed(0).padStart(6)}  DNg100 ${hz('apply')} Hz  steerL ${hz('scroll_l')} steerR ${hz('scroll_r')}  bitter ${hz('bitter')}  JO-B ${hz('hearing')}  ${((Date.now() - t0) / steps).toFixed(2)} ms/step`);
}
run(5, 'warmup');
run(30, 'awake');
run(30, 'sleep tonic -3%', () => { b.tonic = b.tonicBase * 0.97; });
run(30, 'sleep tonic -6%', () => { b.tonic = b.tonicBase * 0.94; });
run(10, 'awake again', () => { b.tonic = b.tonicBase; });
run(10, 'bitter every 1 s', () => { for (let i = 0; i < 10; i++) b.stims.push({ cells: man.pins.bitter, until: b.t + i + 0.5 }); });
