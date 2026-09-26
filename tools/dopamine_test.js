// node tools/dopamine_test.js : what does "frying" dopamine sensitivity do in the browser brain?
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const FlyBrain = require('../web/office/brain.js');
const d = path.join(__dirname, '../web/office/data');
const rd = (f, T) => { const b = zlib.gunzipSync(Buffer.from(fs.readFileSync(path.join(d, f + '.b64.txt'), 'utf8'), 'base64')); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const man = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')));
const groups = { PAM: man.pins.pam, MBONs: man.groups['MBONs · mushroom body output'], DNg100: man.pins.apply, all: null };
function trial(gain, seed) {
  const b = new FlyBrain(rd('indptr', Uint32Array), rd('indices', Uint32Array), rd('weights', Int16Array), man.neurons, { seed });
  for (const c of man.pins.dopamine) b.daMask[c] = 1;
  b.daGain = gain;
  const sets = Object.fromEntries(Object.entries(groups).filter(([, v]) => v).map(([k, v]) => [k, new Set(v)]));
  for (let i = 0; i < 250; i++) b.step();
  const c = { PAM: 0, MBONs: 0, DNg100: 0 }; let tot = 0; const secs = 30;
  for (let s = 0; s < secs / 0.02; s++) {
    if (s % 130 === 0) b.stimulate(man.pins.pam, 0.25); // a video every 2.6 s
    const nf = b.step(); tot += nf;
    for (let k = 0; k < nf; k++) { const j = b.fired[k]; for (const g in sets) if (sets[g].has(j)) c[g]++; }
  }
  const hz = (g) => (c[g] / secs / groups[g].length).toFixed(2);
  return `gain ${gain.toFixed(2)}  PAM ${hz('PAM')} Hz  MBONs ${hz('MBONs')} Hz  DNg100 ${hz('DNg100')} Hz  all ${(tot / (secs / 0.02)).toFixed(0)} spikes/step`;
}
for (const seed of [3, 4]) for (const gain of [1, 0.6, 0.3, 0.1]) console.log(`seed ${seed}  ` + trial(gain, seed));
