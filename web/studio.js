(async () => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const REC = params.has('rec');
  if (REC) document.body.classList.add('rec');
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !REC;

  const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x07080c, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07080c, 14, 30);
  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.05, 100);

  const COL = { neuron: 0x5cc8e6, dn: 0x9bff6b, sugar: 0xffc44d, bitter: 0xff5c8a, eye: 0xff6a5c, body: 0x7d8ba6, prop: 0x55607a };
  const clock = { t0: performance.now() };
  const now = () => (performance.now() - clock.t0) / 1000;

  // ---------------------------------------------------------------- helpers
  const fly = new THREE.Group();
  scene.add(fly);
  function holo(parent, geo, pos, scale, rot, color, fillOp, lineOp) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fillOp, depthWrite: false, side: THREE.DoubleSide })));
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color, transparent: true, opacity: lineOp }));
    g.add(e);
    g.position.set(...pos);
    if (scale) g.scale.set(...scale);
    if (rot) g.rotation.set(...rot);
    parent.add(g);
    return g;
  }
  function polyline(parent, pts, color, op) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
    parent.add(l);
    return l;
  }

  // ---------------------------------------------------------------- the fly
  const sphere = new THREE.SphereGeometry(1, 22, 14);
  holo(fly, sphere, [1.78, 0.05, 0], [0.55, 0.6, 0.62], null, COL.body, 0.02, 0.16);
  holo(fly, sphere, [1.92, 0.1, -0.42], [0.3, 0.36, 0.26], [0, 0, 0.1], COL.eye, 0.015, 0.22);
  holo(fly, sphere, [1.92, 0.1, 0.42], [0.3, 0.36, 0.26], [0, 0, 0.1], COL.eye, 0.015, 0.22);
  holo(fly, sphere, [0.55, 0.15, 0], [0.95, 0.8, 0.78], null, COL.body, 0.04, 0.24);
  holo(fly, sphere, [-1.15, -0.02, 0], [1.2, 0.7, 0.74], [0, 0, 0.05], COL.body, 0.04, 0.24);
  holo(fly, sphere, [-0.42, 0.34, -0.72], [0.07, 0.07, 0.07], null, COL.body, 0.2, 0.5);
  holo(fly, sphere, [-0.42, 0.34, 0.72], [0.07, 0.07, 0.07], null, COL.body, 0.2, 0.5);
  function wingGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(-0.3, 0.4, -1.5, 0.95, -2.7, 0.8);
    s.bezierCurveTo(-3.15, 0.72, -3.15, 0.4, -2.7, 0.34);
    s.bezierCurveTo(-1.5, 0.12, -0.6, -0.05, 0, 0);
    const g = new THREE.ShapeGeometry(s, 14);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  const wg = wingGeo();
  const wingR = holo(fly, wg, [0.5, 0.62, 0.18], null, [0.16, 0, 0], COL.body, 0.04, 0.28);
  const wingL = holo(fly, wg, [0.5, 0.62, -0.18], [1, 1, -1], [-0.16, 0, 0], COL.body, 0.04, 0.28);
  function legPts(ax, az, side, kind) {
    const f = kind === 0 ? 0.6 : kind === 1 ? 0.05 : -0.65;
    return [[ax, -0.32, az * side], [ax + f * 0.45, 0.3, (az + 0.5) * side], [ax + f * 0.95, -0.5, (az + 0.95) * side],
      [ax + f * 1.25, -0.98, (az + 1.18) * side], [ax + f * 1.35 + 0.18, -1.0, (az + 1.3) * side]];
  }
  [[0.55, 0.55, 1], [0.05, 0.5, 2]].forEach((a) => { polyline(fly, legPts(a[0], a[1], 1, a[2]), COL.body, 0.6); polyline(fly, legPts(a[0], a[1], -1, a[2]), COL.body, 0.6); });
  // front legs are animated: right one works the mouse, left one works the keyboard
  const legR = polyline(fly, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], COL.body, 0.8);
  const legL = polyline(fly, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], COL.body, 0.8);
  polyline(fly, [[2.28, 0.18, -0.1], [2.5, 0.36, -0.22], [2.58, 0.34, -0.3]], COL.body, 0.5);
  polyline(fly, [[2.28, 0.18, 0.1], [2.5, 0.36, 0.22], [2.58, 0.34, 0.3]], COL.body, 0.5);
  const proboscis = polyline(fly, [[2.1, -0.28, 0], [2.14, -0.5, 0], [2.1, -0.68, 0]], COL.body, 0.5);

  // ---------------------------------------------------------------- the desk
  const DESK_Y = -1.0;
  const props = new THREE.Group();
  scene.add(props);
  const deskGeo = new THREE.BoxGeometry(11, 0.3, 8);
  holo(props, deskGeo, [2.6, DESK_Y - 0.15, 0], null, null, COL.prop, 0.05, 0.25);
  const grid = new THREE.GridHelper(11, 22, 0x2a3244, 0x1a2030);
  grid.position.set(2.6, DESK_Y + 0.002, 0);
  grid.scale.z = 8 / 11;
  props.add(grid);
  // vertical monitor: screen 3.0 wide x 4.0 tall, matching the 900x1200 board
  const MON = { x: 5.4, y: 2.0, w: 3.0, h: 4.0 };
  holo(props, new THREE.BoxGeometry(0.18, MON.h + 0.24, MON.w + 0.24), [MON.x + 0.1, MON.y, 0], null, null, COL.prop, 0.25, 0.5);
  holo(props, new THREE.BoxGeometry(0.2, MON.y - MON.h / 2 - DESK_Y, 0.35), [MON.x + 0.3, (MON.y - MON.h / 2 + DESK_Y) / 2, 0], null, null, COL.prop, 0.1, 0.35);
  holo(props, new THREE.BoxGeometry(1.1, 0.06, 1.3), [MON.x + 0.3, DESK_Y + 0.03, 0], null, null, COL.prop, 0.1, 0.35);
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 450; screenCanvas.height = 600;
  (() => {
    const x = screenCanvas.getContext('2d');
    x.fillStyle = '#eef1f6'; x.fillRect(0, 0, 450, 600);
    x.fillStyle = '#10131a'; x.font = '600 22px IBM Plex Mono, monospace'; x.textAlign = 'center';
    x.fillText('connecting to Hatchery…', 225, 300);
  })();
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(MON.w, MON.h), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(MON.x, MON.y, 0);
  props.add(screen);
  // soft glow the screen throws on the desk
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 128;
  { const g = glowC.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(190,215,255,0.5)'); r.addColorStop(1, 'rgba(190,215,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(4.2, DESK_Y + 0.01, 0); props.add(glow);
  // keyboard
  const KB = { x: 3.35, z: -0.55, w: 2.7, d: 0.95 };
  holo(props, new THREE.BoxGeometry(KB.d, 0.12, KB.w), [KB.x, DESK_Y + 0.06, KB.z], null, null, COL.prop, 0.12, 0.45);
  const keys = new THREE.Group(); props.add(keys);
  const keyGeo = new THREE.BoxGeometry(0.16, 0.05, 0.17);
  const keyMats = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x9aa6c0, transparent: true, opacity: 0.18 });
    keyMats.push(m);
    const k = new THREE.Mesh(keyGeo, m);
    k.position.set(KB.x - 0.33 + r * 0.22, DESK_Y + 0.145, KB.z - 1.21 + c * 0.22);
    keys.add(k);
  }
  // mouse
  const MOUSE = { x: 2.95, z: 1.25 };
  const mouse = holo(props, new THREE.SphereGeometry(1, 16, 10), [MOUSE.x, DESK_Y + 0.07, MOUSE.z], [0.32, 0.12, 0.2], null, COL.prop, 0.15, 0.55);
  const mouseBtn = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: COL.dn, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  mouseBtn.scale.set(0.16, 0.1, 0.1); mouseBtn.position.set(MOUSE.x + 0.12, DESK_Y + 0.12, MOUSE.z); props.add(mouseBtn);
  // a mug, because every desk has one
  holo(props, new THREE.CylinderGeometry(0.28, 0.25, 0.6, 18, 1, true), [4.3, DESK_Y + 0.3, 2.3], null, null, COL.prop, 0.08, 0.35);
  holo(props, new THREE.TorusGeometry(0.15, 0.03, 6, 14, Math.PI), [4.3, DESK_Y + 0.33, 2.58], null, [0, 0, -Math.PI / 2], COL.prop, 0.1, 0.35);

  // ---------------------------------------------------------------- the brain (real data)
  const [meta, buf] = await Promise.all([
    fetch('/data/meta.json').then((r) => r.json()),
    fetch('/data/points.bin').then((r) => r.arrayBuffer()),
  ]);
  const N = meta.n;
  const pos = new Float32Array(buf, 0, N * 3);
  const kindU8 = new Uint8Array(buf, N * 12, N);
  const segOff = N * 13;
  const seg = new Float32Array(buf.slice(segOff));
  const kind = new Float32Array(N);
  for (let i = 0; i < N; i++) kind[i] = kindU8[i];
  const applySet = new Set(meta.apply);
  const last = new Float32Array(N).fill(-99);

  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cloud.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const lastAttr = new THREE.BufferAttribute(last, 1);
  lastAttr.setUsage(THREE.DynamicDrawUsage);
  cloud.setAttribute('aLast', lastAttr);
  const U = {
    uNow: { value: 0 }, uSugarT: { value: -99 }, uBitterT: { value: -99 }, uPx: { value: 1 }, uGain: { value: 0.7 },
  };
  const brainMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aKind; attribute float aLast;
      uniform float uNow, uSugarT, uBitterT, uPx, uGain;
      varying vec3 vCol; varying float vA;
      void main(){
        if (aKind > 254.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        float spike = exp(-max(uNow - aLast, 0.0) * 12.0);
        vec3 c = vec3(0.36, 0.78, 0.90);
        float size = 0.010; float base = 0.05;
        float sg = 0.6;
        if (aKind > 0.5 && aKind < 1.5) { c = vec3(0.35, 0.62, 1.0); base = 0.035; sg = 0.5; }
        if (aKind > 1.5 && aKind < 2.5) c = vec3(0.30, 0.88, 0.76);
        if (aKind > 6.5) { c = vec3(0.55, 0.9, 1.0); size = 0.014; base = 0.12; }
        float taste = 0.0;
        if (aKind > 2.5 && aKind < 3.5) { c = vec3(1.0, 0.77, 0.30); taste = exp(-max(uNow - uSugarT, 0.0) * 1.6); size = 0.03; base = 0.35; }
        if (aKind > 3.5 && aKind < 4.5) { c = vec3(1.0, 0.36, 0.54); taste = exp(-max(uNow - uBitterT, 0.0) * 1.6); size = 0.03; base = 0.35; }
        if (aKind > 4.5 && aKind < 5.5) { c = vec3(0.61, 1.0, 0.42); size = 0.07; base = 0.9; }
        if (aKind > 5.5 && aKind < 6.5) { c = vec3(0.72, 0.55, 1.0); size = 0.035; base = 0.5; }
        float b = base + spike * sg + taste * 2.5;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float ps = size * (1.0 + spike * 0.8 + taste * 2.0) * uPx / -mv.z;
        // sub-pixel points pile up under additive blending; fade them by their true size
        float fade = aKind > 2.5 && aKind < 6.5 ? 1.0 : clamp(ps * ps / 70.0, 0.3, 1.0);
        vCol = c * b * uGain * fade; vA = min(1.0, b) * fade;
        gl_PointSize = max(1.5, ps);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vA;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.05, r);
        gl_FragColor = vec4(vCol * a, a * vA);
      }`,
  });
  const brain = new THREE.Points(cloud, brainMat);
  brain.frustumCulled = false;
  fly.add(brain);

  // skeletons: DNg100 (group 0), sugar GRNs (1), bitter GRNs (2), with path distance for traveling spikes
  const nv = seg.length / 5;
  const sp = new Float32Array(nv * 3), sd = new Float32Array(nv), sg = new Float32Array(nv);
  for (let i = 0; i < nv; i++) { sp[i * 3] = seg[i * 5]; sp[i * 3 + 1] = seg[i * 5 + 1]; sp[i * 3 + 2] = seg[i * 5 + 2]; sd[i] = seg[i * 5 + 3]; sg[i] = seg[i * 5 + 4]; }
  const skelGeo = new THREE.BufferGeometry();
  skelGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  skelGeo.setAttribute('aDist', new THREE.BufferAttribute(sd, 1));
  skelGeo.setAttribute('aGroup', new THREE.BufferAttribute(sg, 1));
  const PULSES = 6;
  const SU = { uNow: U.uNow, uSugarT: U.uSugarT, uBitterT: U.uBitterT, uPulse: { value: new Array(PULSES).fill(-99) }, uSpeed: { value: 4.2 } };
  const skelMat = new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aDist; attribute float aGroup;
      uniform float uNow, uSugarT, uBitterT, uSpeed; uniform float uPulse[${PULSES}];
      varying vec3 vCol;
      void main(){
        float b; vec3 c;
        if (aGroup < 0.5) {
          c = vec3(0.61, 1.0, 0.42); b = 0.13;
          for (int i = 0; i < ${PULSES}; i++) {
            float front = (uNow - uPulse[i]) * uSpeed;
            if (front > 0.0 && front < 2.2) b += exp(-abs(aDist - front) * 18.0) * 2.2 + step(aDist, front) * 0.25 * exp(-(front - aDist) * 3.0);
          }
        } else {
          float t0 = aGroup < 1.5 ? uSugarT : uBitterT;
          c = aGroup < 1.5 ? vec3(1.0, 0.77, 0.30) : vec3(1.0, 0.36, 0.54);
          float age = max(uNow - t0, 0.0);
          float front = age * 0.9;
          b = 0.12 + exp(-age * 1.2) * (0.8 + exp(-abs(aDist - front) * 20.0) * 2.0);
        }
        vCol = c * b;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }`,
  });
  const skel = new THREE.LineSegments(skelGeo, skelMat);
  skel.frustumCulled = false;
  fly.add(skel);
  let pulseI = 0;
  let lastPulse = -1;
  function pulse(t) {
    if (t - lastPulse < 0.05) return;
    lastPulse = t;
    SU.uPulse.value[pulseI] = t; pulseI = (pulseI + 1) % PULSES;
  }

  // ---------------------------------------------------------------- limbs
  const tap = { mouse: -99, key: -99, keyIdx: 0, scroll: -99 };
  function setLeg(line, pts) {
    const a = line.geometry.attributes.position;
    pts.forEach((p, i) => a.setXYZ(i, p[0], p[1], p[2]));
    a.needsUpdate = true;
  }
  function env(t0, dur) { const a = (now() - t0) / dur; return a < 0 || a > 1 ? 0 : Math.sin(a * Math.PI); }
  function animateLimbs(t) {
    const lift = 0.22 * (1 - env(tap.mouse, 0.22)) + 0.02 * Math.sin(t * 2.1);
    const sc = env(tap.scroll, 0.3) * 0.05;
    setLeg(legR, [[1.05, -0.32, 0.45], [1.7, 0.25, 0.8], [2.35, -0.25, 1.05], [MOUSE.x - 0.05 + sc, DESK_Y + 0.2 + lift, MOUSE.z - 0.05], [MOUSE.x + 0.12, DESK_Y + 0.12 + lift * 0.9, MOUSE.z]]);
    const k = tap.keyIdx;
    const kx = KB.x - 0.33 + (k % 4) * 0.22, kz = KB.z - 1.21 + ((k * 5) % 12) * 0.22;
    const kl = 0.25 * (1 - env(tap.key, 0.18)) + 0.03 * Math.sin(t * 1.7 + 1);
    setLeg(legL, [[1.05, -0.32, -0.45], [1.75, 0.3, -0.75], [2.45, -0.2, -0.95], [kx - 0.25, DESK_Y + 0.35 + kl, kz + 0.05], [kx, DESK_Y + 0.2 + kl, kz]]);
    mouseBtn.material.opacity = env(tap.mouse, 0.35) * 0.9;
    mouse.position.x = MOUSE.x + sc;
    keyMats.forEach((m, i) => { m.opacity = i === ((k % 4) * 12 + (k * 5) % 12) ? 0.18 + env(tap.key, 0.25) * 0.8 : 0.18; m.color.setHex(i === ((k % 4) * 12 + (k * 5) % 12) && env(tap.key, 0.25) > 0 ? COL.dn : 0x9aa6c0); });
    // wings twitch, halteres hum
    const flick = 0.04 * Math.sin(t * 1.3);
    wingR.rotation.x = 0.16 + flick; wingL.rotation.x = -0.16 - flick;
    const tb = Math.max(env(uTaste.t, 1.2), 0);
    proboscis.material.color.setHex(uTaste.kind === 'sugar' && tb > 0 ? COL.sugar : uTaste.kind === 'bitter' && tb > 0 ? COL.bitter : COL.body);
    proboscis.material.opacity = 0.5 + tb * 0.5;
  }
  const uTaste = { t: -99, kind: '' };

  // ---------------------------------------------------------------- camera director
  const SHOTS = {
    desk: { pos: [-6.5, 4.4, -3.4], look: [3.0, 1.1, 0.3], fov: 50 },
    screen: { pos: [-0.9, 1.45, -1.25], look: [5.4, 1.45, 0.1], fov: 45 },
    brain: { pos: [3.6, 0.8, 1.8], look: [1.4, -0.08, 0.0], fov: 42 },
  };
  let mode = params.get('shot') || 'auto';
  queueMicrotask(() => { const b = document.querySelector(`[data-shot="${mode}"]`); if (b) b.click(); });
  let shot = 'desk', shotSince = 0, forced = null, forcedUntil = 0;
  const camPos = new THREE.Vector3(...SHOTS.desk.pos), camLook = new THREE.Vector3(...SHOTS.desk.look);
  let camFov = SHOTS.desk.fov;
  const CYCLE = [['desk', 7], ['screen', 9], ['brain', 5], ['screen', 7]];
  let cycleI = 0;
  function force(name, secs) {
    // the callback owns the camera: nothing interrupts a forced brain shot
    if (forced === 'brain' && now() < forcedUntil && name !== 'brain') return;
    forced = name; forcedUntil = now() + secs;
  }
  function direct(t, dt) {
    let want = shot;
    if (mode !== 'auto') want = mode;
    else if (forced && t < forcedUntil) want = forced;
    else {
      forced = null;
      if (t - shotSince > CYCLE[cycleI][1]) { cycleI = (cycleI + 1) % CYCLE.length; want = CYCLE[cycleI][0]; }
      else want = CYCLE[cycleI][0];
    }
    if (want !== shot) { shot = want; shotSince = t; $('shotLabel').textContent = (mode === 'auto' ? 'auto · ' : '') + shot; logShot(); }
    const s = SHOTS[shot];
    const drift = reduced ? 0 : Math.sin(t * 0.12) * 0.35;
    const k = 1 - Math.exp(-dt * 3.2);
    camPos.lerp(new THREE.Vector3(s.pos[0], s.pos[1] + drift * 0.3, s.pos[2] + drift), k);
    camLook.lerp(new THREE.Vector3(...s.look), k);
    camFov += (s.fov - camFov) * k;
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (Math.abs(camera.fov - camFov) > 0.01) { camera.fov = camFov; camera.updateProjectionMatrix(); }
  }

  // ---------------------------------------------------------------- HUD
  function toast(cls, from, when, text, tag) {
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.innerHTML = '<div class="from"><span></span><span></span></div><p></p><div class="tag"></div>';
    d.querySelector('.from span').textContent = from;
    d.querySelector('.from span:last-child').textContent = when;
    d.querySelector('p').textContent = text;
    d.querySelector('.tag').textContent = tag;
    $('toasts').prepend(d);
    const kids = $('toasts').children;
    while (kids.length > 2) kids[kids.length - 1].remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 520); }, cls === 'int' ? 9000 : 5200);
  }
  function fmtAfter(m) { return m < 1 ? `${Math.round(m * 60)} s after applying` : `${m.toFixed(0)} min after applying`; }
  function setState(s) {
    if (!s) return;
    $('apps').textContent = (s.apps || 0).toLocaleString();
    $('ints').textContent = s.interviews || 0;
    $('rejs').textContent = (s.rejections || 0).toLocaleString();
    const b = $('bRun'); b.setAttribute('aria-pressed', String(!!s.running)); b.textContent = s.running ? 'Pause' : 'Start applying';
  }
  function onEvent(e) {
    setState(e.state);
    const t = now();
    switch (e.type) {
      case 'rejection':
        U.uBitterT.value = t; uTaste.t = t; uTaste.kind = 'bitter';
        toast('rej', e.company, fmtAfter(e.after), e.text, `bitter GRNs ×${e.neurons} stimulated · 500 ms`);
        break;
      case 'interview':
        U.uSugarT.value = t; uTaste.t = t; uTaste.kind = 'sugar';
        toast('int', e.company, fmtAfter(e.after), e.text, `sugar GRNs ×${e.neurons} stimulated · 500 ms`);
        force('brain', 5);
        break;
      case 'manual_sugar': U.uSugarT.value = t; uTaste.t = t; uTaste.kind = 'sugar'; break;
      case 'manual_bitter': U.uBitterT.value = t; uTaste.t = t; uTaste.kind = 'bitter'; break;
      case 'inmail': toast('inm', e.sender, 'InMail', e.text, 'recruiter'); break;
      case 'workdaze': toast('wd', `Workdaze · ${e.company}`, 'step 3 of 11', 'Please re-enter your résumé exactly as it appears in the résumé you just uploaded.', 'now typing with its front leg'); force('screen', 8); break;
      case 'action':
        if (e.kind === 'click') tap.mouse = t;
        if (e.kind === 'key') { tap.key = t; tap.keyIdx = (tap.keyIdx + 7) % 48; }
        if (e.kind === 'scroll') tap.scroll = t;
        break;
      case 'done': toast('done', 'Hatchery', 'today', e.text, `${e.state.apps.toLocaleString()} applications`); break;
    }
  }

  // ---------------------------------------------------------------- socket
  let ws, spikesThisStep = 0, spkShown = 0;
  const frameQueue = [];
  function connect() {
    ws = new WebSocket(`ws://${location.host}/ws/studio`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (m) => {
      if (typeof m.data === 'string') return onEvent(JSON.parse(m.data));
      const dv = new DataView(m.data);
      const type = dv.getUint8(0);
      if (type === 1) {
        const n = (m.data.byteLength - 5) / 4;
        const idx = new Uint32Array(m.data.slice(5));
        const t = now();
        for (let i = 0; i < n; i++) { const j = idx[i]; last[j] = t; if (applySet.has(j)) pulse(t); }
        spikesThisStep = n;
      } else if (type === 2) {
        frameQueue.push(new Blob([new Uint8Array(m.data, 1)], { type: 'image/jpeg' }));
        if (frameQueue.length > 2) frameQueue.shift();
      }
    };
    ws.onopen = () => logShot();
    ws.onclose = () => setTimeout(connect, 800);
  }
  let decoding = false;
  async function pumpFrames() {
    if (decoding || !frameQueue.length) return;
    decoding = true;
    try {
      const bmp = await createImageBitmap(frameQueue.pop(), { imageOrientation: 'flipY' });
      frameQueue.length = 0;
      if (screenTex.image && screenTex.image.close) screenTex.image.close();
      screenTex.image = bmp; screenTex.needsUpdate = true;
    } catch (err) { /* dropped frame */ }
    decoding = false;
  }
  function cmd(c, extra) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ cmd: c }, extra || {}))); }
  function logShot() { cmd('shot', { shot }); }
  $('bRun').addEventListener('click', () => cmd($('bRun').getAttribute('aria-pressed') === 'true' ? 'pause' : 'start'));
  $('bSugar').addEventListener('click', () => cmd('sugar'));
  $('bBitter').addEventListener('click', () => cmd('bitter'));
  document.querySelectorAll('[data-shot]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.shot;
    document.querySelectorAll('[data-shot]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('shotLabel').textContent = mode;
  }));
  document.addEventListener('keydown', (e) => {
    const map = { 1: 'desk', 2: 'screen', 3: 'brain', a: 'auto' };
    if (map[e.key]) document.querySelector(`[data-shot="${map[e.key]}"]`).click();
    if (e.key === ' ') { e.preventDefault(); $('bRun').click(); }
  });
  connect();

  // ---------------------------------------------------------------- loop
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  $('boot').hidden = true;
  let prev = now(), frames = 0, fpsT = now();
  window.__studio = { ready: false, fps: 0, shots: SHOTS, camera, scene };
  function frame() {
    const t = now(), dt = Math.min(0.05, t - prev); prev = t;
    U.uNow.value = t;
    const h = renderer.domElement.height;
    U.uPx.value = camera.projectionMatrix.elements[5] * h * 0.5;
    lastAttr.needsUpdate = true;
    animateLimbs(t);
    direct(t, dt);
    pumpFrames();
    spkShown += (spikesThisStep - spkShown) * 0.15;
    if (frames % 6 === 0) $('spk').textContent = Math.round(spkShown).toLocaleString();
    renderer.render(scene, camera);
    frames++;
    if (t - fpsT > 1) { window.__studio.fps = frames / (t - fpsT); frames = 0; fpsT = t; }
    window.__studio.ready = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
