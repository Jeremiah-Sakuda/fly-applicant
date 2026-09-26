/* Fly Applicant Live: a MaleCNS brain in a Web Worker drives a cartoon fly
   that sleeps, commutes to its desk and applies to jobs, forever. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const nowS = () => performance.now() / 1000;

  // ------------------------------------------------------------------ renderer
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCF honors shadow.radius, which gives the soft edges
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080c);
  scene.fog = new THREE.Fog(0x07080c, 10, 20);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 60);
  camera.position.set(3.6, 3.0, 3.4);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(-0.2, 0.5, -1.0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.35;
  controls.maxDistance = 9;

  // ------------------------------------------------------------------ textures
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const planks = canvasTex(1024, 1024, (g, w, h) => {
    const rowH = 64;
    for (let y = 0; y < h; y += rowH) {
      let x = -rnd() * 300;
      while (x < w) {
        const len = 180 + rnd() * 260;
        g.fillStyle = `hsl(${22 + rnd() * 8} ${38 + rnd() * 10}% ${26 + rnd() * 10}%)`; g.fillRect(x, y, len, rowH);
        g.globalAlpha = 0.18;
        for (let k = 0; k < 7; k++) { g.fillStyle = rnd() > 0.5 ? '#2a1a10' : '#b98a62'; g.fillRect(x, y + rnd() * rowH, len, 1 + rnd() * 2); }
        g.globalAlpha = 1;
        g.fillStyle = '#1c120b'; g.fillRect(x, y, 3, rowH);
        x += len;
      }
      g.fillStyle = '#1c120b'; g.fillRect(0, y, w, 3);
    }
  }, [4, 4]);
  const deskWood = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#b8753f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = rnd() > 0.5 ? 'rgba(90,45,15,.25)' : 'rgba(235,180,120,.18)'; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const y = rnd() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rnd() * 16 - 8, w * 0.6, y + rnd() * 16 - 8, w, y + rnd() * 10 - 5); g.stroke(); }
  });
  const keysTex = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#16181f'; g.fillRect(0, 0, w, h);
    const cols = 15, rows = 5, kw = w / cols, kh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { g.fillStyle = (r + c) % 7 === 0 ? '#8fd6e6' : '#e8e6df'; g.fillRect(c * kw + 3, r * kh + 3, kw - 6, kh - 6); }
    g.fillStyle = '#e8e6df'; g.fillRect(kw * 4, 4 * kh + 3, kw * 6, kh - 6);
  });
  const stripes = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b8864b'; g.fillRect(0, 0, w, h);
    for (const [a, b, c] of [[0.0, 0.12, '#2a1d12'], [0.30, 0.40, '#2a1d12'], [0.52, 0.60, '#2a1d12'], [0.70, 0.78, '#2a1d12'], [0.86, 1.0, '#1c140d']]) { g.fillStyle = c; g.fillRect(0, a * h, w, (b - a) * h); }
  });
  const posterTex = canvasTex(256, 360, (g, w, h) => {
    g.fillStyle = '#10131a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9bff6b'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#9bff6b'; g.font = '700 44px "Bricolage Grotesque", Arial'; g.textAlign = 'center';
    g.fillText('#OPEN', w / 2, 150); g.fillText('TO', w / 2, 200); g.fillText('WORK', w / 2, 250);
    g.fillStyle = '#8f95a5'; g.font = '500 16px "IBM Plex Mono", monospace'; g.fillText('166,700 neurons', w / 2, 300);
  });
  const blobTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });

  // ------------------------------------------------------------------ room
  const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra));
  function box(w, h, d, mat, x, y, z, parent = scene, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  const ROOM = { x0: -3.2, x1: 3.2, z0: -2.4, z1: 2.4, h: 2.8 };
  const WIN = { x0: -0.8, x1: 0.4, y0: 1.15, y1: 2.15 };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0), std(0xffffff, 0.72, { map: planks }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallMat = std(0x1b2233, 0.95);
  // back wall built around a real opening, so daylight only enters through the window
  const WZ = ROOM.z0 - 0.05, WD = 0.1;
  box(WIN.x0 - ROOM.x0, ROOM.h, WD, wallMat, (ROOM.x0 + WIN.x0) / 2, ROOM.h / 2, WZ);
  box(ROOM.x1 - WIN.x1, ROOM.h, WD, wallMat, (WIN.x1 + ROOM.x1) / 2, ROOM.h / 2, WZ);
  box(WIN.x1 - WIN.x0, WIN.y0, WD, wallMat, (WIN.x0 + WIN.x1) / 2, WIN.y0 / 2, WZ);
  box(WIN.x1 - WIN.x0, ROOM.h - WIN.y1, WD, wallMat, (WIN.x0 + WIN.x1) / 2, (WIN.y1 + ROOM.h) / 2, WZ);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.z1 - ROOM.z0, ROOM.h), wallMat);
  left.rotation.y = Math.PI / 2; left.position.set(ROOM.x0, ROOM.h / 2, 0); left.receiveShadow = true; scene.add(left);
  // invisible ceiling: casts shadow, never drawn, so orbiting from above still works
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0 + 1, ROOM.z1 - ROOM.z0 + 1), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ROOM.h, 0); ceil.castShadow = true; scene.add(ceil);
  box(ROOM.x1 - ROOM.x0, 0.08, 0.02, std(0x121724), 0, 0.04, ROOM.z0 + 0.01, scene, false);
  box(0.02, 0.08, ROOM.z1 - ROOM.z0, std(0x121724), ROOM.x0 + 0.01, 0.04, 0, scene, false);
  // window frame and sill
  const frameMat = std(0x2a3040, 0.55);
  const fz = ROOM.z0 - 0.02;
  box(WIN.x1 - WIN.x0 + 0.08, 0.05, 0.14, frameMat, (WIN.x0 + WIN.x1) / 2, WIN.y1 + 0.02, fz);
  box(WIN.x1 - WIN.x0 + 0.14, 0.04, 0.2, frameMat, (WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.02, fz + 0.04);
  box(0.05, WIN.y1 - WIN.y0, 0.14, frameMat, WIN.x0 - 0.02, (WIN.y0 + WIN.y1) / 2, fz);
  box(0.05, WIN.y1 - WIN.y0, 0.14, frameMat, WIN.x1 + 0.02, (WIN.y0 + WIN.y1) / 2, fz);
  box(0.03, WIN.y1 - WIN.y0, 0.05, frameMat, (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, fz - 0.03);
  box(WIN.x1 - WIN.x0, 0.03, 0.05, frameMat, (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2 + 0.05, fz - 0.03);
  // the sky outside: redrawn from the sim clock
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 512; skyCanvas.height = 384;
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.encoding = THREE.sRGBEncoding;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.1), new THREE.MeshBasicMaterial({ map: skyTex, fog: false, toneMapped: false }));
  sky.position.set(-0.2, 1.6, ROOM.z0 - 1.2); scene.add(sky);
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.59), new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.6 }));
  poster.position.set(2.35, 1.65, ROOM.z0 + 0.012); scene.add(poster);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), std(0x2a3148, 0.95));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0.3, 0.004, -0.6); rug.receiveShadow = true; scene.add(rug);

  // bed
  const BED = { x: -1.9, z: -1.25 };
  const woodDark = std(0x3b2618, 0.7);
  box(1.18, 0.28, 2.1, woodDark, BED.x, 0.14, BED.z);
  box(1.18, 0.85, 0.08, woodDark, BED.x, 0.425, BED.z - 1.05);
  box(1.08, 0.2, 1.98, std(0xeeeeea, 0.9), BED.x, 0.38, BED.z + 0.02);
  box(1.12, 0.07, 1.25, std(0x2f6fc0, 0.85), BED.x, 0.505, BED.z + 0.38);
  box(1.13, 0.2, 0.06, std(0x2f6fc0, 0.85), BED.x, 0.43, BED.z + 1.0);
  box(0.72, 0.1, 0.34, std(0xffffff, 0.9), BED.x, 0.53, BED.z - 0.72);
  // nightstand, phone, clock
  box(0.46, 0.5, 0.4, woodDark, -1.02, 0.25, -2.12);
  const standPhone = box(0.075, 0.012, 0.15, std(0x111111, 0.3), -1.1, 0.506, -2.05);
  const lockCanvas = document.createElement('canvas'); lockCanvas.width = 128; lockCanvas.height = 256;
  const lockTex = new THREE.CanvasTexture(lockCanvas); lockTex.encoding = THREE.sRGBEncoding;
  const phoneGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.135), new THREE.MeshBasicMaterial({ map: lockTex, toneMapped: false }));
  phoneGlass.rotation.x = -Math.PI / 2; phoneGlass.position.set(-1.1, 0.5128, -2.05); scene.add(phoneGlass);
  const clockTex = canvasTex(160, 80, () => {});
  function drawClock(text) {
    const g = clockTex.image.getContext('2d');
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, 160, 80);
    g.fillStyle = '#ff3b3b'; g.font = '700 42px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 80, 42); clockTex.needsUpdate = true;
  }
  box(0.17, 0.09, 0.07, std(0x1a1a1a, 0.5), -0.9, 0.545, -2.12);
  const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false }));
  clockFace.position.set(-0.9, 0.545, -2.084); scene.add(clockFace);
  const phoneLight = new THREE.PointLight(0xffc44d, 0, 1.2);
  phoneLight.position.set(-1.1, 0.62, -2.05); scene.add(phoneLight);

  // desk
  const DESK = { x: 1.5, z: -1.85, top: 0.765 };
  box(1.5, 0.05, 0.72, std(0xffffff, 0.5, { map: deskWood }), DESK.x, 0.74, DESK.z);
  const metal = std(0x111318, 0.4, { metalness: 0.6 });
  for (const [dx, dz] of [[-0.7, -0.31], [0.7, -0.31], [-0.7, 0.31], [0.7, 0.31]]) box(0.04, 0.72, 0.04, metal, DESK.x + dx, 0.36, DESK.z + dz);
  const MON = { x: 1.45, z: -2.1, w: 0.64, h: 0.4, y: 1.07 };
  box(MON.w + 0.03, MON.h + 0.03, 0.03, std(0x0b0c10, 0.35), MON.x, MON.y, MON.z - 0.02);
  box(0.05, 0.2, 0.04, metal, MON.x, 0.86, MON.z - 0.05);
  box(0.24, 0.015, 0.16, metal, MON.x, 0.772, MON.z - 0.02);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 640;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.encoding = THREE.sRGBEncoding; screenTex.anisotropy = 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(MON.w, MON.h), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(MON.x, MON.y, MON.z + 0.001); scene.add(screen);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
  led.position.set(MON.x + MON.w / 2 - 0.02, MON.y - MON.h / 2 - 0.008, MON.z + 0.002); scene.add(led);
  const screenLight = new THREE.PointLight(0xcfe2ff, 0.9, 2.2);
  screenLight.position.set(MON.x, MON.y, MON.z + 0.35); scene.add(screenLight);
  const KB = { x: 1.42, z: -1.86 };
  box(0.44, 0.018, 0.14, std(0xffffff, 0.6, { map: keysTex }), KB.x, DESK.top + 0.009, KB.z);
  const MOUSE = { x: 1.72, z: -1.8 };
  const mouseMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), std(0xe8e6df, 0.4));
  mouseMesh.scale.set(0.032, 0.016, 0.05); mouseMesh.position.set(MOUSE.x, DESK.top + 0.01, MOUSE.z); mouseMesh.castShadow = true; scene.add(mouseMesh);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 24), std(0xf2f0ea, 0.35));
  mug.position.set(2.0, DESK.top + 0.05, -2.0); mug.castShadow = true; scene.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16), std(0xf2f0ea, 0.35));
  handle.position.set(2.047, DESK.top + 0.055, -2.0); handle.rotation.y = Math.PI / 2; scene.add(handle);
  const lampMat = std(0x1c1f27, 0.4, { metalness: 0.5 });
  box(0.14, 0.02, 0.14, lampMat, 0.9, DESK.top + 0.01, -2.02);
  const arm = box(0.02, 0.42, 0.02, lampMat, 0.9, DESK.top + 0.22, -2.02); arm.rotation.z = -0.35;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 20, 1, true), std(0x1c1f27, 0.4, { side: THREE.DoubleSide }));
  shade.position.set(0.98, DESK.top + 0.43, -1.98); shade.rotation.z = -0.9; shade.castShadow = true; scene.add(shade);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), bulbMat);
  bulb.position.set(1.0, DESK.top + 0.4, -1.97); scene.add(bulb);

  // ------------------------------------------------------------------ lights
  const hemi = new THREE.HemisphereLight(0x3a4a7a, 0x1a1410, 0.5); scene.add(hemi);
  const winLight = new THREE.DirectionalLight(0x7f9fe8, 0.35);  // sun by day, moon by night, always through the window
  winLight.castShadow = true; winLight.shadow.mapSize.set(2048, 2048); winLight.shadow.radius = 3; winLight.shadow.bias = -0.0005;
  Object.assign(winLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 16 });
  winLight.target.position.set(0, 0, 0); scene.add(winLight, winLight.target);
  const roomSpot = new THREE.SpotLight(0xffc98a, 1.8, 9, 0.9, 0.85, 1.2);
  roomSpot.position.set(0.6, ROOM.h - 0.08, 1.0); // just under the ceiling, or the ceiling would shadow it roomSpot.target.position.set(-0.2, 0, -1.0);
  roomSpot.castShadow = true; roomSpot.shadow.mapSize.set(2048, 2048); roomSpot.shadow.bias = -0.0004; roomSpot.shadow.radius = 7;
  scene.add(roomSpot, roomSpot.target);
  const lamp = new THREE.SpotLight(0xffb870, 1.6, 3.2, 0.85, 0.75, 1.5);
  lamp.position.set(1.0, DESK.top + 0.4, -1.97); lamp.target.position.set(1.55, DESK.top, -1.65);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0006; lamp.shadow.radius = 6;
  scene.add(lamp, lamp.target);
  const L = { lampOn: false, lampLevel: 0, ceilLevel: 0 };

  // ------------------------------------------------------------------ the fly
  const fly = new THREE.Group(); scene.add(fly);
  const body = new THREE.Group(); fly.add(body);
  const brown = std(0x6b4a2b, 0.55), gold = std(0xb8864b, 0.5), eyeMat = std(0xd8262c, 0.2, { emissive: new THREE.Color(0x3a0204) });
  const ball = new THREE.SphereGeometry(1, 28, 18);
  function part(mat, pos, scl, parent = body) { const m = new THREE.Mesh(ball, mat); m.position.set(...pos); m.scale.set(...scl); m.castShadow = true; parent.add(m); return m; }
  const headG = new THREE.Group(); headG.position.set(0.115, 0.02, 0); body.add(headG);
  part(gold, [0, 0, 0], [0.056, 0.054, 0.058], headG);
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  for (const s of [1, -1]) {
    part(eyeMat, [0.012, 0.014, 0.047 * s], [0.036, 0.045, 0.032], headG);
    const hl = new THREE.Mesh(ball, shine); hl.scale.setScalar(0.007); hl.position.set(0.036, 0.034, 0.05 * s); headG.add(hl);
  }
  part(brown, [0.048, -0.022, 0], [0.013, 0.022, 0.015], headG);
  const antMat = std(0x3a2616, 0.6);
  for (const s of [1, -1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.038, 6), antMat); a.position.set(0.052, 0.028, 0.012 * s); a.rotation.z = -0.9; a.rotation.x = 0.4 * s; headG.add(a); }
  part(brown, [0.03, 0, 0], [0.078, 0.07, 0.07]);
  const bristleGeo = new THREE.CylinderGeometry(0.0015, 0.003, 0.028, 4);
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(bristleGeo, antMat);
    const a = (i / 10) * Math.PI - Math.PI / 2, x = 0.0 + (i % 5) * 0.015;
    b.position.set(x, 0.066, Math.sin(a) * 0.035); b.rotation.z = 0.5; b.rotation.x = Math.sin(a) * 0.5; body.add(b);
  }
  const abd = part(std(0xffffff, 0.5, { map: stripes }), [-0.1, -0.006, 0], [0.066, 0.11, 0.072]);
  abd.rotation.z = Math.PI / 2;
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.bezierCurveTo(-0.04, 0.035, -0.17, 0.05, -0.22, 0.03); wingShape.bezierCurveTo(-0.24, 0.015, -0.2, -0.005, -0.15, -0.01); wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 16);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
  const wings = [1, -1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(0.04, 0.06, 0.02 * s); body.add(pivot);
    const w = new THREE.Mesh(wingGeo, wingMat); w.rotation.x = Math.PI / 2 * s; pivot.add(w); pivot.userData.side = s; return pivot;
  });
  const legMat = std(0x2a1c10, 0.6);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
  const LEGS = [];
  [[0.07, 0.1, 0.13], [0.03, 0.13, 0.03], [-0.01, 0.11, -0.07]].forEach(([hx, spread, fx], i) => {
    for (const s of [1, -1]) {
      const femur = new THREE.Mesh(cyl, legMat), tibia = new THREE.Mesh(cyl, legMat);
      const toe = new THREE.Mesh(ball, legMat); toe.scale.setScalar(0.009);
      femur.castShadow = tibia.castShadow = true; body.add(femur, tibia, toe);
      const tripod = (i === 1) === (s > 0) ? 0 : 1;
      LEGS.push({ hip: new THREE.Vector3(hx, -0.03, 0.035 * s), home: new THREE.Vector3(fx, -0.085, spread * s), femur, tibia, toe, tripod, side: s, idx: i });
    }
  });
  const up = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), knee = new THREE.Vector3();
  function segment(mesh, a, b, r) { tmpA.subVectors(b, a); const len = tmpA.length(); mesh.position.copy(a).addScaledVector(tmpA, 0.5); mesh.quaternion.setFromUnitVectors(up, tmpA.normalize()); mesh.scale.set(r, len, r); }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);
  const handCanvas = document.createElement('canvas'); handCanvas.width = 96; handCanvas.height = 192;
  const handTex = new THREE.CanvasTexture(handCanvas); handTex.encoding = THREE.sRGBEncoding;
  const handPhone = new THREE.Group(); fly.add(handPhone);
  const hpBody = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.12, 0.062), std(0x111111, 0.3)); hpBody.castShadow = true; handPhone.add(hpBody);
  const hpScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.056, 0.112), new THREE.MeshBasicMaterial({ map: handTex, toneMapped: false }));
  hpScreen.rotation.y = -Math.PI / 2; hpScreen.position.x = -0.0035; handPhone.add(hpScreen);
  const faceLight = new THREE.PointLight(0x9fb8ff, 0, 0.9, 2); faceLight.position.set(-0.05, 0, 0); handPhone.add(faceLight);
  handPhone.position.set(0.25, 0.2, 0); handPhone.rotation.z = 0.55; handPhone.visible = false; // screen tilted down toward the face
  // the phone in the fly's hands shows the same video that is playing in the Buzz overlay
  function drawHandPhone() {
    const g = handCanvas.getContext('2d');
    if (Buzz.canvas && Buzz.canvas.width) g.drawImage(Buzz.canvas, 0, 0, 96, 192);
    handTex.needsUpdate = true;
  }
  const zTex = canvasTex(64, 64, (g) => { g.fillStyle = '#b58cff'; g.font = '700 50px "Bricolage Grotesque", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 32, 34); });
  const smokeTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(150,150,150,.9)'); r.addColorStop(1, 'rgba(150,150,150,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const smoke = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); return s; });
  const eyeFresh = new THREE.Color(0xd8262c), eyeFried = new THREE.Color(0x5e4a48), glowFresh = new THREE.Color(0x3a0204);
  const zs = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false })); s.scale.set(0.07, 0.07, 1); scene.add(s); return s; });

  // ------------------------------------------------------------------ places and routes
  const P = {
    bed: new THREE.Vector3(BED.x + 0.05, 0.545, BED.z - 0.25),
    bedEdge: new THREE.Vector3(-1.15, 0, -0.85),
    mid: new THREE.Vector3(0.2, 0, -0.55),
    deskFloor: new THREE.Vector3(1.45, 0, -1.0),
    desk: new THREE.Vector3(1.47, DESK.top, -1.58),
  };
  const FLY_H = 0.085;
  const flyState = { pos: P.bed.clone(), ground: P.bed.y, heading: -Math.PI / 2, plan: [], act: null, walkPhase: 0, sleeping: true, speed: 0, happyUntil: -1, talkUntil: -1 };
  fly.position.copy(P.bed);
  const planCommute = () => { flyState.plan = [{ hop: P.bedEdge }, { walk: P.mid }, { walk: P.deskFloor }, { hop: P.desk }, { face: Math.PI / 2 }]; };
  const planBurnout = () => { flyState.plan = [{ face: -Math.PI / 2 }, { hop: P.deskFloor }, { walk: P.mid }, { walk: P.bedEdge }, { hop: P.bed }, { face: -Math.PI / 2 }]; };
  const headingTo = (from, to) => Math.atan2(-(to.z - from.z), to.x - from.x);
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

  // ------------------------------------------------------------------ brain state (from the worker)
  const B = { ready: false, t: 0, groups: [], sizes: [], ema: [], dnRate: 0.72, lRate: 0, rRate: 0, spikesPerSec: 0, mean: 0, spikeHist: [] };
  const G = {};
  const emaUpdate = (prev, value, dt, tau) => prev + (value - prev) * (1 - Math.exp(-dt / tau));

  // ------------------------------------------------------------------ the job market (scripted)
  const COMPANIES = ['Drosophila Dynamics', 'Mushroom Body Capital', 'Optic Lobe Labs', 'Vinegar & Sons', 'Banana Peel Ventures', 'Compost Heap Logistics', 'Ommatidia Analytics', 'Larval Stage', 'Ripe Fruit Partners', 'Petri Dish Systems', 'Fermentation Co.', 'Proboscis Health', 'Haltere Aerospace', 'Pupa Pay', 'Sticky Trap Security', 'Windowsill Holdings'];
  const ROLES = ['Junior Forward Locomotion Analyst', 'Associate Wing Beat Engineer', 'Growth Hacker (Fruit)', 'Staff Grooming Specialist', 'Head of Vinegar Detection', 'Product Manager, Rotting', 'Senior Hovering Consultant', 'Founding Engineer (equity in banana)', 'Backend Engineer, Nerve Cord', 'Customer Success, Windowsill', 'Entry-Level Chief of Staff'];
  const BADGES = [['Entry level · 5+ yrs required', '#5d6475'], ['Referral preferred', '#c21f53'], ['Reposted 3×', '#5d6475'], ['Unpaid trial week', '#c21f53'], ['Competitive salary', '#5d6475'], ['Fast-paced (rotting) environment', '#5d6475'], ['We are a family', '#c21f53'], ['Must love kombucha', '#5d6475']];
  const REJECT = [
    ["We've decided to move forward with other flies.", false],
    ['The position has been filled internally (by a wasp).', false],
    ['Your profile is impressive, but it is not a fit for this larva.', false],
    ['We are looking for someone with more legs of experience.', false],
    ['We have decided to pursue candidates who are mammals.', false],
    ["We've gone with a candidate referred by our CEO. It is his nephew.", true],
    ['The role went to the founder\'s cousin, who is a maggot but a family maggot.', true],
  ];
  const NEPO = [['Brayden Maggot', 'VP of Fruit', 'Vinegar & Sons', "his dad's company"], ['Kayleigh Larva', 'Head of Strategy', 'Mushroom Body Capital', 'her uncle is on the board'], ['Tripp Pupa III', 'Chief Vibes Officer', 'Pupa Pay', 'third generation'], ['Madison Wasp', 'Senior Engineer', 'Haltere Aerospace', 'the CTO\'s roommate']];
  const job = {
    apps: 0, today: 0, rejs: 0, ghosted: 0, aiInts: 0, nepo: 0, pending: [], posting: null, lastClick: -9, lastClickReal: -9, stampReal: -9,
    state: 'SLEEP', stateSince: 0, flash: null, clock: 3 * 60 + 47, wakeAt: 7 * 60, portal: null, interview: null, aiQueued: null,
    nextRecruiter: 30, nextNepo: 55, battery: 64, charging: true, gen: 1, screen: {}, lastSwipe: -9, scrollPhase: null, scrollUntil: 0,
    da: 1, daSent: 1, daAtWake: 1, vidsAtWake: 0, screenAtWake: 0,
  };
  function newPosting() {
    const bs = [...BADGES].sort(() => Math.random() - 0.5).slice(0, 2);
    job.posting = { company: pick(COMPANIES), role: pick(ROLES), pay: pick(['$0.00–$1,000,000', '$1.50/hr + fruit', 'Competitive (it is not)', '$2.99/hr + exposure']), applicants: pick([340, 1204, 2981, 10000]), badges: bs, workdaze: Math.random() < 0.1 };
  }
  newPosting();

  // ------------------------------------------------------------------ the clock
  const LIFESPAN = 50; // days, roughly an adult fruit fly's life
  const RATE = { SLEEP: 28, SCROLLING: 4, COMMUTE: 9, APPLYING: 6.5, INTERVIEW: 6.5, BURNOUT: 12 }; // sim minutes per sim second
  const hourOf = () => (job.clock % 1440) / 60;
  const fmtClock = (min) => { const m = Math.floor(min % 1440), h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`; };
  const shortClock = (min) => fmtClock(min).replace(/ (AM|PM)/, '');

  // ------------------------------------------------------------------ sky and daylight
  const SKY = [[0, '#060b1f', '#0d1a3d'], [5, '#0a1433', '#1c2c5c'], [6.3, '#2b3f7a', '#f08a5d'], [7.6, '#4a86d8', '#ffd3a8'], [9, '#3f82dc', '#b9dcf7'], [15.5, '#3a7cd8', '#c7e2f7'], [17.6, '#3a5fb8', '#f7c08a'], [19, '#3b2e6e', '#f07a4a'], [20.4, '#141c48', '#43376e'], [22, '#060b1f', '#0d1a3d'], [24, '#060b1f', '#0d1a3d']];
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixHex = (a, b, t) => { const A = hex2rgb(a), Bc = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, Bc[i], t))).join(',')})`; };
  function skyAt(h) { for (let i = 0; i < SKY.length - 1; i++) if (h >= SKY[i][0] && h <= SKY[i + 1][0]) { const t = smooth((h - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0])); return [mixHex(SKY[i][1], SKY[i + 1][1], t), mixHex(SKY[i][2], SKY[i + 1][2], t)]; } return [SKY[0][1], SKY[0][2]]; }
  const dayAmount = (h) => clamp(Math.sin(Math.PI * (h - 6.2) / 13.3) * 1.5 + 0.1, 0, 1);
  const stars = Array.from({ length: 60 }, () => [rnd() * 512, rnd() * 200, 0.6 + rnd() * 1.2]);
  const skyline = []; for (let x = 0; x < 512;) { const w = 24 + rnd() * 50, hgt = 50 + rnd() * 130; const lights = []; for (let k = 0; k < 10; k++) if (rnd() > 0.45) lights.push([x + 5 + rnd() * (w - 10), 384 - hgt + 8 + rnd() * (hgt - 16)]); skyline.push([x, w, hgt, lights]); x += w + 3; }
  const clouds = Array.from({ length: 5 }, () => [rnd() * 600 - 50, 40 + rnd() * 110, 50 + rnd() * 70]);
  function drawSky(h, now) {
    const g = skyCanvas.getContext('2d');
    const [top, bot] = skyAt(h), day = dayAmount(h);
    const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, 512, 384);
    const starA = clamp(1 - day * 2.2, 0, 1);
    if (starA > 0) for (const [x, y, r] of stars) { g.fillStyle = `rgba(255,255,255,${starA * (0.5 + 0.5 * Math.sin(now * 2 + x))})`; g.fillRect(x, y, r, r); }
    const arc = (h - 6) / 13.5;
    if (arc > -0.05 && arc < 1.05) { // sun
      const sx = 40 + arc * 430, sy = 250 - Math.sin(Math.PI * clamp(arc, 0, 1)) * 190;
      const sg = g.createRadialGradient(sx, sy, 4, sx, sy, 60); sg.addColorStop(0, 'rgba(255,244,214,1)'); sg.addColorStop(0.25, 'rgba(255,220,150,.8)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = sg; g.fillRect(sx - 60, sy - 60, 120, 120);
    } else { // moon
      const ma = ((h + 24 - 19.5) % 24) / 10.5, mx = 60 + ma * 390, my = 220 - Math.sin(Math.PI * clamp(ma, 0, 1)) * 150;
      g.fillStyle = '#f1efe6'; g.beginPath(); g.arc(mx, my, 14, 0, TAU); g.fill();
      g.fillStyle = top; g.beginPath(); g.arc(mx + 6, my - 4, 12, 0, TAU); g.fill();
    }
    if (day > 0.2) for (const c of clouds) { const x = ((c[0] + now * 4) % 640) - 60; g.fillStyle = `rgba(255,255,255,${0.55 * day})`; g.beginPath(); g.ellipse(x, c[1], c[2], c[2] * 0.3, 0, 0, TAU); g.ellipse(x + c[2] * 0.5, c[1] - 8, c[2] * 0.6, c[2] * 0.3, 0, 0, TAU); g.fill(); }
    const bld = mixHex('#0a1330', '#6f7f9e', day), lit = clamp(1 - day * 1.6, 0, 1);
    for (const [x, w, hgt, lights] of skyline) {
      g.fillStyle = bld; g.fillRect(x, 384 - hgt, w, hgt);
      if (lit > 0) { g.fillStyle = `rgba(255,196,77,${0.75 * lit})`; for (const [lx, ly] of lights) g.fillRect(lx, ly, 3, 4); }
    }
    skyTex.needsUpdate = true;
  }
  const cWarm = new THREE.Color(0xffa860), cNoon = new THREE.Color(0xfff1d8), cMoon = new THREE.Color(0x7f9fe8);
  const skyNight = new THREE.Color(0x34426e), skyDay = new THREE.Color(0xbcd3ff), gNight = new THREE.Color(0x1a1410), gDay = new THREE.Color(0x5a4636);
  function updateLighting(dt) {
    const h = hourOf(), day = dayAmount(h), arc = (h - 6) / 13.5;
    if (day > 0.02) {
      const ax = Math.cos(Math.PI * clamp(arc, 0, 1)), alt = 0.35 + Math.sin(Math.PI * clamp(arc, 0, 1)) * 0.55;
      winLight.position.set(-0.2 - ax * 3.2, 1.6 + alt * 5, ROOM.z0 - 6);
      winLight.target.position.set(0.2, 0, 0.6);
      winLight.color.copy(cWarm).lerp(cNoon, clamp(Math.sin(Math.PI * clamp(arc, 0, 1)) * 1.6, 0, 1));
      winLight.intensity = 2.4 * day;
    } else {
      winLight.position.set(-1.2, 5, ROOM.z0 - 6); winLight.target.position.set(0.2, 0, 0.4);
      winLight.color.copy(cMoon); winLight.intensity = 0.7;
    }
    hemi.intensity = 0.45 + 0.4 * day;
    hemi.color.copy(skyNight).lerp(skyDay, day); hemi.groundColor.copy(gNight).lerp(gDay, day);
    const awake = job.state !== 'SLEEP' && job.state !== 'SCROLLING';
    const ceilWant = awake ? clamp(1.8 * (1 - day * 1.3), 0.15, 1.8) : 0;
    L.ceilLevel = emaUpdate(L.ceilLevel, ceilWant, dt, 0.25);
    roomSpot.intensity = L.ceilLevel;
    L.lampLevel = L.lampOn ? 1 : 0; // a real switch: no fade
    lamp.intensity = 1.6 * L.lampLevel;
    bulbMat.color.setHex(L.lampOn ? 0xffd9a0 : 0x2a2622);
  }
  function setLamp(on) { if (L.lampOn === on) return; L.lampOn = on; sfx.lamp(); }

  // ------------------------------------------------------------------ monitor
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, x, y, maxW, lh) { const words = text.split(' '); let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = test; } g.fillText(line, x, y); return y; }
  function drawCursor(g, x, y) { g.fillStyle = '#ffb020'; g.strokeStyle = '#10131a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 44); g.lineTo(x + 11, y + 33); g.lineTo(x + 20, y + 52); g.lineTo(x + 27, y + 48); g.lineTo(x + 18, y + 30); g.lineTo(x + 33, y + 30); g.closePath(); g.fill(); g.stroke(); }
  const cursor = { x: 520, y: 470 };
  function topBar(g, W) {
    g.fillStyle = '#10131a'; g.fillRect(0, 0, W, 70);
    g.fillStyle = '#ffb020'; g.beginPath(); g.arc(36, 35, 10, 0, TAU); g.fill();
    g.fillStyle = '#e9e5d9'; g.font = '700 32px "Bricolage Grotesque", Arial'; g.textAlign = 'left'; g.fillText('Hatchery', 56, 46);
    g.font = '500 20px "IBM Plex Mono", monospace'; g.fillStyle = '#aab0bf'; g.textAlign = 'right';
    g.fillText(`applied ${job.apps.toLocaleString()} · rejected ${job.rejs.toLocaleString()} · ghosted ${job.ghosted}`, W - 28, 44);
  }
  function drawBoard(g, W, H, now) {
    g.fillStyle = '#eef1f6'; g.fillRect(0, 0, W, H); topBar(g, W);
    const p = job.posting;
    g.fillStyle = '#fff'; roundRect(g, 40, 96, W - 80, 450, 18); g.fill(); g.strokeStyle = '#dde2eb'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'left'; g.fillStyle = '#5d6475'; g.font = '600 26px "IBM Plex Sans", Arial'; g.fillText(p.company, 80, 150);
    g.fillStyle = '#10131a'; g.font = '700 48px "Bricolage Grotesque", Arial'; const yEnd = wrap(g, p.role, 80, 212, W - 170, 52);
    let bx = 80; const by = Math.max(yEnd + 26, 290);
    g.font = '600 20px "IBM Plex Sans", Arial';
    for (const [label, color] of p.badges.concat(p.workdaze ? [['Apply on company site', '#2b4a8b']] : [])) {
      const w = g.measureText(label).width + 26; g.strokeStyle = color; g.lineWidth = 2; roundRect(g, bx, by, w, 36, 18); g.stroke();
      g.fillStyle = color; g.fillText(label, bx + 13, by + 25); bx += w + 10; if (bx > W - 200) break;
    }
    g.fillStyle = '#5d6475'; g.font = '400 24px "IBM Plex Sans", Arial'; g.fillText(`${p.pay} · ${p.applicants.toLocaleString()} applicants`, 80, by + 72);
    const pressed = now - job.lastClickReal < 0.15;
    g.fillStyle = pressed ? '#c98200' : '#ffb020'; roundRect(g, 80, 420 + (pressed ? 5 : 0), 330, 92, 16); g.fill();
    if (!pressed) { g.fillStyle = '#c98200'; g.fillRect(96, 512, 298, 6); }
    g.fillStyle = '#2a1800'; g.font = '700 40px "Bricolage Grotesque", Arial'; g.textAlign = 'center'; g.fillText(p.workdaze ? 'Apply' : 'Easy Apply', 245, 480 + (pressed ? 5 : 0));
    if (now - job.stampReal < 0.6) { g.save(); g.translate(790, 180); g.rotate(-0.14); g.strokeStyle = '#1f9d55'; g.lineWidth = 6; g.strokeRect(-120, -40, 240, 70); g.fillStyle = '#1f9d55'; g.font = '700 44px "Bricolage Grotesque", Arial'; g.fillText('APPLIED', 0, 12); g.restore(); }
    cursor.x = lerp(cursor.x, 250, 0.08); cursor.y = lerp(cursor.y, 470, 0.08); drawCursor(g, cursor.x, cursor.y);
  }
  function drawPortal(g, W, H, now) {
    const pt = job.portal;
    g.fillStyle = '#e9edf5'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b4a8b'; g.fillRect(0, 0, W, 76);
    g.fillStyle = '#fff'; g.font = '700 34px "Bricolage Grotesque", Arial'; g.textAlign = 'left'; g.fillText('Workdaze', 36, 50);
    g.font = '500 20px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText(`${pt.company} · Careers`, W - 30, 48);
    for (let i = 0; i < 11; i++) { g.fillStyle = i < 3 ? '#2b4a8b' : '#c9d0de'; g.fillRect(40 + i * 86, 100, 78, 8); }
    g.textAlign = 'left'; g.fillStyle = '#10131a'; g.font = '600 30px "IBM Plex Sans", Arial'; g.fillText('Step 3 of 11 · Work experience', 40, 160);
    g.fillStyle = '#5d6475'; g.font = '400 24px "IBM Plex Sans", Arial'; wrap(g, 'Please re-enter your résumé exactly as it appears in the résumé you just uploaded.', 40, 200, W - 80, 30);
    g.fillStyle = '#fff'; g.fillRect(40, 250, W - 80, 170); g.strokeStyle = '#2b4a8b'; g.lineWidth = 3; g.strokeRect(40, 250, W - 80, 170);
    g.fillStyle = '#10131a'; g.font = '500 36px "IBM Plex Mono", monospace';
    g.fillText(pt.typed + (Math.floor(now * 2) % 2 ? '|' : ''), 60, 305);
    const ready = pt.typed.length >= 14;
    g.fillStyle = ready ? '#2b4a8b' : '#9aa6c0'; roundRect(g, W - 250, 450, 210, 70, 8); g.fill();
    g.fillStyle = '#fff'; g.font = '600 30px "IBM Plex Sans", Arial'; g.textAlign = 'center'; g.fillText('Submit', W - 145, 496);
    g.textAlign = 'left'; g.fillStyle = '#5d6475'; g.font = '400 20px "IBM Plex Mono", monospace'; g.fillText(`typed with the left front leg · ${pt.typed.length}/14`, 40, 490);
    if (pt.expiredAt) { g.fillStyle = 'rgba(16,19,26,.8)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; roundRect(g, 150, 200, W - 300, 220, 12); g.fill(); g.fillStyle = '#c21f53'; g.font = '700 34px "Bricolage Grotesque", Arial'; g.textAlign = 'center'; g.fillText('Your session has expired.', W / 2, 290); g.fillStyle = '#10131a'; g.font = '400 24px "IBM Plex Sans", Arial'; g.fillText('Please create a new account to continue.', W / 2, 340); }
  }
  const QUESTIONS = ['Tell me about a time you failed.', 'Where do you see yourself in five years? (Your lifespan is 50 days.)', 'Why do you want to work at {c}?', 'What is your greatest weakness?', 'Describe a conflict with a coworker. Do not mention the swatter.'];
  function drawInterview(g, W, H, now) {
    const iv = job.interview;
    g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b58cff'; g.font = '700 30px "Bricolage Grotesque", Arial'; g.textAlign = 'left'; g.fillText('HireBot 9000', 36, 50);
    g.fillStyle = '#8f95a5'; g.font = '500 20px "IBM Plex Mono", monospace'; g.fillText(`one-way AI video interview · ${iv.company}`, 250, 48);
    if (Math.floor(now * 1.5) % 2) { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(W - 90, 40, 9, 0, TAU); g.fill(); }
    g.fillStyle = '#ff6b6b'; g.textAlign = 'right'; g.fillText('REC', W - 30, 48);
    if (iv.phase === 'q' || iv.phase === 'analyzing') {
      const talk = iv.phase === 'q' ? 1 : 0.3, r = 70 + Math.sin(now * 6) * 6 * talk;
      const og = g.createRadialGradient(200, 250, 10, 200, 250, r + 40); og.addColorStop(0, '#e6d9ff'); og.addColorStop(0.35, '#b58cff'); og.addColorStop(1, 'rgba(122,90,245,0)');
      g.fillStyle = og; g.beginPath(); g.arc(200, 250, r + 40, 0, TAU); g.fill();
      g.strokeStyle = '#b58cff'; g.lineWidth = 3; g.beginPath();
      for (let x = 0; x < 260; x += 4) { const y = 400 + Math.sin(x * 0.08 + now * 10) * 18 * talk * Math.sin(x / 260 * Math.PI); x ? g.lineTo(70 + x, y) : g.moveTo(70 + x, y); } g.stroke();
      g.fillStyle = '#ece8dc'; g.textAlign = 'left'; g.font = '700 38px "Bricolage Grotesque", Arial';
      if (iv.phase === 'q') {
        wrap(g, iv.questions[iv.q], 380, 150, W - 420, 44);
        const left = Math.max(0, iv.qLen - (T - iv.qStart));
        g.fillStyle = '#262c3a'; g.fillRect(380, 330, W - 420, 10); g.fillStyle = '#b58cff'; g.fillRect(380, 330, (W - 420) * (left / iv.qLen), 10);
        g.fillStyle = '#8f95a5'; g.font = '500 20px "IBM Plex Mono", monospace'; g.fillText(`question ${iv.q + 1} of ${iv.questions.length} · 0:${String(Math.ceil(left)).padStart(2, '0')} left`, 380, 372);
        g.fillStyle = '#ece8dc'; g.font = '500 26px "IBM Plex Mono", monospace'; wrap(g, `“${iv.words.join(' ') || '…'}”`, 380, 430, W - 560, 32);
      } else {
        wrap(g, 'Analyzing your answer…', 380, 170, W - 420, 44);
        g.fillStyle = '#8f95a5'; g.font = '500 22px "IBM Plex Mono", monospace';
        ['Detecting facial expressions', `Eyes detected: ${(3400 + Math.floor(now * 37) % 900).toLocaleString()}`, 'Measuring enthusiasm from DNg100'].forEach((l, i) => g.fillText(l + '.'.repeat(1 + (Math.floor(now * 3) + i) % 3), 380, 250 + i * 40));
      }
      // candidate webcam
      g.fillStyle = '#151923'; roundRect(g, W - 230, H - 190, 200, 160, 10); g.fill();
      g.fillStyle = '#b8864b'; g.beginPath(); g.arc(W - 130, H - 110, 44, 0, TAU); g.fill();
      g.fillStyle = '#d8262c'; g.beginPath(); g.ellipse(W - 160, H - 118, 22, 28, 0, 0, TAU); g.ellipse(W - 100, H - 118, 22, 28, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(W - 152, H - 130, 5, 0, TAU); g.arc(W - 92, H - 130, 5, 0, TAU); g.fill();
      g.fillStyle = '#8f95a5'; g.font = '500 16px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.fillText('candidate', W - 130, H - 40);
    } else {
      const sc = iv.scores;
      g.fillStyle = '#ece8dc'; g.textAlign = 'left'; g.font = '700 40px "Bricolage Grotesque", Arial'; g.fillText('Your results', 60, 140);
      const rows = [['Enthusiasm', `${sc.enth}%`, sc.enth / 100, `DNg100 at ${sc.dn.toFixed(2)} Hz`], ['Eye contact', 'too much', 1, `${sc.eyes.toLocaleString()} eyes detected`], ['Communication', `"bzz" ×${sc.bzz}`, 0.12, 'transcript unclear'], ['Culture fit', 'insect', 0.03, 'we are a mammal-first company']];
      rows.forEach(([k, v, f, note], i) => {
        const y = 200 + i * 78;
        g.fillStyle = '#8f95a5'; g.font = '500 22px "IBM Plex Mono", monospace'; g.fillText(k.toUpperCase(), 60, y);
        g.fillStyle = '#ece8dc'; g.font = '700 30px "Bricolage Grotesque", Arial'; g.fillText(v, 330, y + 2);
        g.fillStyle = '#262c3a'; g.fillRect(60, y + 16, 560, 10); g.fillStyle = f > 0.5 ? '#ff5c8a' : '#b58cff'; g.fillRect(60, y + 16, 560 * f, 10);
        g.fillStyle = '#5c6273'; g.font = '400 18px "IBM Plex Mono", monospace'; g.fillText(note, 640, y + 26);
      });
      g.fillStyle = '#ff5c8a'; roundRect(g, 60, H - 110, W - 120, 70, 12); g.fill();
      g.fillStyle = '#fff'; g.font = '700 34px "Bricolage Grotesque", Arial'; g.textAlign = 'center'; g.fillText('Recommendation: do not move forward', W / 2, H - 64);
    }
  }
  function drawScreen(now) {
    const g = screenCanvas.getContext('2d'); const W = 1024, H = 640;
    const off = job.state === 'SLEEP' || job.state === 'SCROLLING';
    if (off) { g.fillStyle = '#030305'; g.fillRect(0, 0, W, H); }
    else if (job.state === 'INTERVIEW' && job.interview) drawInterview(g, W, H, now);
    else if (job.portal) drawPortal(g, W, H, now);
    else drawBoard(g, W, H, now);
    const f = job.flash;
    if (!off && f && now < f.until) {
      g.globalAlpha = Math.min(1, (f.until - now) * 2);
      const pink = f.kind === 'rej';
      g.fillStyle = pink ? '#e5356b' : '#7a5af5'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.textAlign = 'left';
      g.font = '700 30px "IBM Plex Mono", monospace'; g.fillText(pink ? 'APPLICATION UPDATE' : 'INTERVIEW INVITATION', 60, 110);
      g.font = '600 34px "IBM Plex Sans", Arial'; g.fillText(f.company, 60, 190);
      g.font = '700 52px "Bricolage Grotesque", Arial'; wrap(g, f.text, 60, 270, W - 120, 60);
      g.font = '500 24px "IBM Plex Mono", monospace'; g.fillText(f.meta, 60, 580);
      g.globalAlpha = 1;
    }
    screenTex.needsUpdate = true;
    const hot = !off && f && now < f.until;
    screenLight.color.setHex(hot ? (f.kind === 'rej' ? 0xff5c8a : 0xb58cff) : job.state === 'INTERVIEW' ? 0x9d86ff : 0xcfe2ff);
    screenLight.intensity = off ? 0 : hot ? 1.4 : 0.9;
    led.material.color.setHex(off ? 0xffb020 : 0x3ad17a);
  }
  // the phone on the nightstand: a lock screen that lights up on new mail
  let lockLitUntil = -1, lastLockDraw = -9;
  function drawLock(now) {
    const g = lockCanvas.getContext('2d'); const lit = now < lockLitUntil;
    g.fillStyle = lit ? '#1b1e2a' : '#050507'; g.fillRect(0, 0, 128, 256);
    if (lit) {
      g.fillStyle = '#ece8dc'; g.font = '700 30px "Bricolage Grotesque", Arial'; g.textAlign = 'center'; g.fillText(shortClock(job.clock), 64, 60);
      g.fillStyle = 'rgba(255,255,255,.92)'; roundRect(g, 8, 90, 112, 64, 10); g.fill();
      g.fillStyle = '#ffb020'; roundRect(g, 14, 96, 20, 20, 5); g.fill();
      g.fillStyle = '#10131a'; g.font = '700 12px "IBM Plex Sans", Arial'; g.textAlign = 'left'; g.fillText('FlyMail', 40, 111);
      g.font = '400 11px "IBM Plex Sans", Arial'; g.fillText(`${FlyMail.unread()} unread`, 14, 134); g.fillText('Update on your app…', 14, 148);
    }
    lockTex.needsUpdate = true;
    phoneLight.intensity = lit ? 0.7 : 0;
  }

  // ------------------------------------------------------------------ sound
  const S = { on: false, ctx: null, buzz: null };
  const audio = () => (S.ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slide = 0) {
    if (!S.on || skipping()) return;
    const ctx = audio(); const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    click() { tone(2200, 0.03, 'square', 0.05); tone(900, 0.04, 'square', 0.03, 0.01); },
    key() { tone(1500 + Math.random() * 400, 0.025, 'square', 0.03); },
    reject() { tone(440, 0.28, 'sine', 0.1, 0.05); tone(180, 0.35, 'triangle', 0.07, 0.05, 0.7); },
    mail() { tone(880, 0.09, 'sine', 0.08); tone(1320, 0.14, 'sine', 0.08, 0.08); },
    ai() { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, i * 0.07)); },
    robot() { tone(300 + Math.random() * 200, 0.08, 'sawtooth', 0.03); },
    ring() { for (let i = 0; i < 3; i++) { tone(1320, 0.08, 'square', 0.05, i * 0.16); tone(1760, 0.08, 'square', 0.05, i * 0.16 + 0.08); } },
    lamp() { tone(3000, 0.012, 'square', 0.08); tone(160, 0.05, 'triangle', 0.1, 0.005); },
    swipe() { tone(500, 0.09, 'sine', 0.03, 0, 2.2); },
  };
  function setBuzz(on) {
    if (skipping()) on = false;
    if (!S.ctx) return;
    if (!S.on) on = false;
    if (on && !S.buzz) {
      const ctx = S.ctx, o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 190; f.type = 'lowpass'; f.frequency.value = 900;
      gn.gain.value = 0.0001; gn.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.08);
      o.connect(f).connect(gn).connect(ctx.destination); o.start(); S.buzz = { o, gn };
    } else if (!on && S.buzz) { const b = S.buzz; S.buzz = null; b.gn.gain.exponentialRampToValueAtTime(0.0001, S.ctx.currentTime + 0.1); b.o.stop(S.ctx.currentTime + 0.15); }
  }

  // ------------------------------------------------------------------ toasts and mail
  function toast(cls, from, when, text, tag) {
    if (skipping()) return;
    const d = document.createElement('div'); d.className = 'toast ' + cls;
    d.innerHTML = '<div class="from"><span></span><span></span></div><div class="msg"></div><div class="tag"></div>';
    d.querySelector('.from span').textContent = from; d.querySelector('.from span:last-child').textContent = when;
    d.querySelector('.msg').textContent = text; d.querySelector('.tag').textContent = tag || '';
    $('toasts').prepend(d);
    while ($('toasts').children.length > 3) $('toasts').lastElementChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 520); }, 4500);
  }
  FlyMail.init($('flymail'));
  Buzz.init($('buzz'));
  FlyMail.onToast = (m) => toast(m.kind === 'ai' ? 'hear' : m.kind === 'rej' ? '' : 'hear', m.from, m.time, m.subject, m.tag);
  function mail(o) {
    const m = FlyMail.add(Object.assign({ time: fmtClock(job.clock) }, o));
    if (o.notify !== false && !skipping()) { lockLitUntil = nowS() + 4; sfx.mail(); }
    return m;
  }

  // ------------------------------------------------------------------ worker
  const worker = new Worker('worker.js');
  const post = (m) => worker.postMessage(m);
  let speed = 1, cloud = null;
  // Virtual sim time drives the behavior. The brain runs in real steps as fast as the device allows;
  // when the chosen speed outruns it, the missing DNg100 spikes are drawn from its live measured rate.
  let T = 0, pendingDn = 0, brainRate = 1, lastTickReal = 0;
  const skip = { real: 0, sampled: 0 };
  const skipping = () => speed >= 20;
  function gauss() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(TAU * Math.random()); }
  function poisson(l) { if (l <= 0) return 0; if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss())); let k = 0, p = Math.exp(-l), c = p; const u = Math.random(); while (u > c && k < 200) { k++; p *= l / k; c += p; } return k; }
  Promise.all([fetch('data/manifest.json').then((r) => r.json()), FlyBrain.loadPacked('data/positions.b64.txt', Uint16Array), FlyBrain.loadPacked('data/kind.b64.txt', Uint8Array)]).then(([man, q, kind]) => {
    const n = man.neurons, pinned = new Map(), tag = { pam: 8, apply: 5, sugar: 3, bitter: 4, scroll_l: 6, scroll_r: 6, hearing: 7 };
    for (const [k, v] of Object.entries(man.pins)) if (tag[k] !== undefined) for (const c of v) pinned.set(c, tag[k]);
    const sample = []; for (let i = 0; i < n; i++) if (kind[i] !== 255 && (i % 3 === 0 || pinned.has(i))) sample.push(i);
    buildCloud(man, q, kind, sample, pinned);
    $('shown').textContent = `${sample.length.toLocaleString()} of ${n.toLocaleString()} somas`;
    post({ type: 'init', sample });
  }).catch((err) => { $('progNum').textContent = `Could not load the brain: ${err}`; });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') { $('progBar').style.width = `${(100 * m.loaded / m.total).toFixed(1)}%`; $('progNum').textContent = `${(m.loaded / 1e6).toFixed(1)} of ${(m.total / 1e6).toFixed(1)} MB`; }
    else if (m.type === 'ready') {
      B.ready = true; B.groups = m.groups; B.sizes = m.sizes; B.ema = m.groups.map(() => 0);
      m.groups.forEach((g, i) => { G[g] = i; });
      $('edges').textContent = `${(m.edges / 1e6).toFixed(2)}M`;
      buildTypeRows(); $('loading').hidden = true;
      post({ type: 'tonic', factor: 0.94 });
      mail({ from: 'Hatchery', category: 'updates', subject: 'Welcome back! 1,204 new jobs match your profile', body: 'Hi D. melanogaster,\nJobs are waiting. Most of them were posted to collect résumés.\nGood luck out there.', notify: false });
    } else if (m.type === 'tick') onTick(m);
    else if (m.type === 'error') $('progNum').textContent = `Could not start the brain: ${m.message}`;
  };
  function onTick(m) {
    const dt = m.t - B.t; B.t = m.t;
    if (dt <= 0) return;
    const rate = (gi) => m.counts[gi] / B.sizes[gi] / dt;
    B.ema = B.ema.map((v, i) => emaUpdate(v, rate(i), dt, 0.8));
    B.dnRate = emaUpdate(B.dnRate, rate(G.apply), dt, 1.2);
    B.lRate = B.ema[G.scroll_l]; B.rRate = B.ema[G.scroll_r];
    B.spikesPerSec = emaUpdate(B.spikesPerSec, m.spikes / dt, dt, 0.5);
    B.mean = B.spikesPerSec / 166700;
    B.spikeHist.push(m.spikes / dt); if (B.spikeHist.length > 240) B.spikeHist.shift();
    if (cloud) { const now = nowS(), f = m.flags; for (let i = 0; i < f.length; i++) if (f[i]) cloud.last[i] = now; cloud.lastAttr.needsUpdate = true; }
    const nowR = nowS();
    if (lastTickReal) { const rdt = Math.max(0.01, nowR - lastTickReal); brainRate = emaUpdate(brainRate, dt / rdt, rdt, 1.0); }
    lastTickReal = nowR;
    pendingDn += m.dn.length;
  }

  // ------------------------------------------------------------------ behavior (scripted schedule, neural motor output)
  function setState(s) {
    job.state = s; job.stateSince = T;
    $('state').textContent = s === 'INTERVIEW' ? 'AI INTERVIEW' : s === 'SCROLLING' ? 'DOOMSCROLL' : s; $('state').className = 'v state-' + s;
    if (s === 'SCROLLING') { setLamp(false); job.lastSwipe = T; Buzz.next(false, attention()); }
    setPhoneApp();
    post({ type: 'tonic', factor: s === 'SLEEP' ? 0.94 : 1 });
    if (s === 'SLEEP') {
      setLamp(false);
      // wake at the next 7:00 AM; a fly that scrolled too late gets 2.5 hours and wakes up late
      let cand = Math.floor(job.clock / 1440) * 1440 + 420; if (cand <= job.clock) cand += 1440;
      job.wakeAt = Math.max(cand, job.clock + 150); job.charging = true;
    }
    if (s === 'APPLYING') setLamp(true);
  }
  let ringUntil = -1;
  function wake(reason) {
    if (job.state !== 'SLEEP') return;
    post({ type: 'stim', group: 'hearing', seconds: 0.8 });
    ringUntil = nowS() + 1.6; lockLitUntil = nowS() + 3; sfx.ring();
    toast('hear', 'Alarm', fmtClock(job.clock), reason, `JO-B hearing neurons ×${B.sizes[G.hearing]} stimulated`);
    flyState.sleeping = false; job.today = 0; job.charging = false;
    job.scrollPhase = 'morning'; job.scrollUntil = job.clock + (35 + Math.random() * 30) * (1 + (1 - job.da)); // "just checking one thing"
    setState('SCROLLING');
    const yVids = Buzz.watched - job.vidsAtWake, drop = Math.round((job.daAtWake - job.da) * 100);
    if (job.day0 !== undefined) mail({ from: 'Screen Time', category: 'updates', notify: false, subject: `Daily report: ${yVids} videos, dopamine sensitivity ${Math.round(job.da * 100)}%`,
      body: `Videos watched since yesterday morning: ${yVids}.\nDopamine receptor sensitivity: ${Math.round(job.da * 100)}% (${drop >= 0 ? 'down' : 'up'} ${Math.abs(drop)} points since yesterday).\nAttention span: ${attention().toFixed(1)} seconds per video.\nConsider touching grass. There is grass outside the window.` });
    job.day0 = 1; job.daAtWake = job.da; job.vidsAtWake = Buzz.watched;
    mail({ from: 'Hatchery', category: 'updates', subject: 'Your profile appeared in 0 searches this week', body: 'Your profile appeared in 0 searches this week.\nTip: flies with a profile photo get 0% more views.\nUpgrade to Hatchery Premium to see who ignored you.', notify: false });
  }
  function reject(p, text) {
    p = p || { company: pick(COMPANIES), applied: T, role: pick(ROLES) };
    const [msg, nepo] = text ? [text, false] : pick(REJECT);
    job.rejs++; $('rejs').textContent = job.rejs.toLocaleString();
    if (nepo) { job.nepo++; $('nepo').textContent = job.nepo; }
    post({ type: 'stim', group: 'bitter', seconds: 0.5 });
    const after = T - p.applied, when = after > 1 ? `${Math.round(after * RATE.APPLYING)} min after applying` : 'just now';
    job.flash = { kind: 'rej', company: p.company, text: msg, meta: when, until: nowS() + 2.2 };
    sfx.reject();
    mail({ from: p.company, kind: 'rej', subject: nepo ? 'We went with family' : 'Application update', tag: `bitter taste neurons ×${B.sizes[G.bitter]} stimulated · 500 ms`,
      body: `${msg}\nRole: ${p.role || 'the role'}.\nThank you for your interest in ${p.company}. We will keep your résumé on file (we will not).\nBest,\nThe ${p.company} Talent Team` });
    if (job.state === 'SLEEP') ringUntil = nowS() + 1.0;
    if (Math.random() < 0.15) job.pending.push({ kind: 'repost', due: T + 8, company: p.company, role: p.role || 'the role' });
  }
  function inviteAI(p) {
    p = p || { company: pick(COMPANIES) };
    post({ type: 'stim', group: 'sugar', seconds: 0.5 }); // hope
    post({ type: 'stim', group: 'pam', seconds: 0.4 });
    job.flash = { kind: 'ai', company: p.company, text: 'You are invited to a one-way AI interview.', meta: 'HireBot 9000 · no humans will attend', until: nowS() + 2.5 };
    sfx.ai(); flyState.happyUntil = nowS() + 1.2;
    mail({ from: 'HireBot 9000', kind: 'ai', address: 'noreply@hirebot9000.ai', subject: `${p.company}: complete your AI interview`, tag: `sugar taste neurons ×${B.sizes[G.sugar]} stimulated · hope`,
      body: `Congratulations! ${p.company} has invited you to a one-way video interview.\nYou will answer questions for our AI. No human will watch it.\nPlease look into the camera with all of your eyes.` });
    job.aiQueued = p;
  }
  function startInterview() {
    const p = job.aiQueued; job.aiQueued = null;
    const qs = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3).map((q) => q.replace('{c}', p.company));
    job.interview = { company: p.company, questions: qs, q: 0, qStart: T, qLen: 7, words: [], allWords: 0, phase: 'q', lastUm: -9 };
    setState('INTERVIEW');
  }
  function schedule(p) {
    const r = Math.random(), t = T;
    if (job.apps === 9 || r < 1 / 70) job.pending.push({ ...p, kind: 'ai', due: t + 5 + Math.random() * 4 });
    // most companies never answer: about 58% are ghosted, about 40% bother to reject
    else if (r < 0.58) job.pending.push({ ...p, kind: 'ghost', due: t + 40 });
    else if (r < 0.592) job.pending.push({ ...p, kind: 'takehome', due: t + 8 + Math.random() * 10 });
    else if (r < 0.60) job.pending.push({ ...p, kind: 'personality', due: t + 6 + Math.random() * 8 });
    else job.pending.push({ ...p, kind: 'rej', due: t + Math.min(60, Math.max(2, Math.exp(2.3 + Math.random() * 1.5))) });
    if (Math.random() < 0.05) mail({ from: p.company, category: 'updates', subject: 'We received your application!', body: `Thank you for applying to ${p.company}!\nYour application is important to us.\nThis mailbox is not monitored.`, notify: false });
  }
  function resolve(p) {
    if (p.kind === 'rej') reject(p);
    else if (p.kind === 'ai') inviteAI(p);
    else if (p.kind === 'ghost') { job.ghosted++; $('ghost').textContent = job.ghosted; }
    else if (p.kind === 'takehome') { mail({ from: p.company, subject: 'Next step: a short take-home assignment', body: `Great news! Please complete a 6-hour take-home assignment (unpaid).\nBuild a full-stack fruit-ripeness tracker. Deadline: tonight.\nWe may or may not look at it.` }); job.pending.push({ ...p, kind: 'ghost', due: T + 30 }); }
    else if (p.kind === 'personality') { mail({ from: p.company, subject: 'Before we continue: personality assessment', body: 'Please complete our 212-question personality assessment.\nQuestion 1: Which fruit are you?\nQuestion 2: Rate your passion for synergy from 1 to 10 (answer 10).' }); job.pending.push({ ...p, kind: Math.random() < 0.7 ? 'ghost' : 'rej', due: T + 15 }); }
    else if (p.kind === 'repost') mail({ from: 'Hatchery', category: 'updates', subject: `${p.company} reposted a job you applied to`, body: `${p.role} at ${p.company} was reposted 2 minutes after rejecting you.\nApply again?`, notify: false });
  }
  function behave(dn, dt) {
    const t = T;
    job.clock += dt * RATE[job.state];
    job.battery = clamp(job.battery + dt * (job.charging ? 4 : job.state === 'SCROLLING' ? -1.6 : -0.7), 1, 100);
    if (job.state === 'SLEEP') setDopamine(job.da + (1 - job.da) * (1 - Math.exp(-RECOVERY * dt)));
    for (let i = job.pending.length - 1; i >= 0; i--) { const p = job.pending[i]; if (t >= p.due) { job.pending.splice(i, 1); resolve(p); } }
    if (job.state !== 'SLEEP' && t > job.nextRecruiter) {
      job.nextRecruiter = t + 45 + Math.random() * 30;
      const [who, body] = pick([['Recruiter at Vinegar & Sons', 'Exciting opportunity in vinegar! Are you open to a quick chat? The role is in a sealed jar.'], ['Talent Partner, Pupa Pay', 'Loved your profile! We have a 9-stage interview loop. Stage 1 is a 4-hour "vibe check".'], ['Headhunter (unsolicited)', 'I have a perfect role for you. It requires 10 years of Rust. You are 9 days old.']]);
      mail({ from: who, category: 'recruiters', subject: 'Quick question', body });
    }
    if (t > job.nextNepo) {
      job.nextNepo = t + 60 + Math.random() * 40;
      const [who, title, co, why] = pick(NEPO);
      job.nepo++; $('nepo').textContent = job.nepo;
      mail({ from: 'Hatchery', category: 'updates', subject: `${who} started a new position`, body: `${who} started a new position as ${title} at ${co} (${why}).\nNo prior experience listed.\nSend congratulations?`, notify: false });
    }
    if (job.state === 'SLEEP' && job.clock >= job.wakeAt) wake('7:00 AM. Time to apply.');
    if (job.state === 'COMMUTE' && flyState.plan.length === 0 && !flyState.act) setState('APPLYING');
    if (job.state === 'APPLYING') {
      if (job.aiQueued && !job.portal) { startInterview(); return; }
      if (job.portal && job.portal.expiredAt && t - job.portal.expiredAt > 1.6) {
        const p = job.portal; job.portal = null; job.apps++; job.today++; $('apps').textContent = job.apps.toLocaleString();
        schedule({ company: p.company, role: p.role, applied: t }); newPosting();
      }
      if (dn && t - job.lastClick > 0.4) {
        job.lastClick = t;
        const n = skipping() ? Math.min(dn, Math.max(1, Math.floor(dt / 0.4))) : 1;
        for (let k = 0; k < n && job.state === 'APPLYING'; k++) clickOnce(t);
      }
      if (!job.portal && (job.today >= 30 || hourOf() >= 18.5)) { planBurnout(); setState('BURNOUT'); }
    }
    if (job.state === 'INTERVIEW') {
      const iv = job.interview;
      if (iv.phase === 'q') {
        for (let k = 0; k < Math.min(dn, 3); k++) { iv.words.push('bzz'); iv.allWords++; flyState.talkUntil = nowS() + 0.35; sfx.robot(); }
        if (B.rRate + B.lRate > 7 && t - iv.lastUm > 1.8) { iv.words.push('um'); iv.lastUm = t; }
        if (iv.words.length > 14) iv.words.shift();
        if (t - iv.qStart > iv.qLen) {
          iv.q++; iv.words = []; iv.qStart = t;
          if (iv.q >= iv.questions.length) { iv.phase = 'analyzing'; iv.until = t + 3; }
        }
      } else if (iv.phase === 'analyzing' && t > iv.until) {
        iv.phase = 'result'; iv.until = t + 5;
        iv.scores = { enth: clamp(Math.round(B.dnRate * 9), 1, 34), dn: B.dnRate, eyes: 3400 + Math.floor(Math.random() * 900), bzz: iv.allWords };
      } else if (iv.phase === 'result' && t > iv.until) {
        job.aiInts++; $('aiInts').textContent = job.aiInts;
        job.interview = null; setState('APPLYING');
        reject({ company: 'HireBot 9000', applied: t, role: `${iv.company} (AI interview)` }, `Our AI has reviewed your interview. Enthusiasm ${iv.scores.enth}%. Culture fit: insect. We will not be moving forward.`);
      }
    }
    if (job.state === 'BURNOUT' && flyState.plan.length === 0 && !flyState.act) {
      job.scrollPhase = 'night'; job.scrollUntil = job.clock + (70 + Math.random() * 80) * (1 + (1 - job.da) * 1.5); // one more video
      setState('SCROLLING');
    }
    if (job.state === 'SCROLLING') {
      const day = Math.floor(job.clock / 1440);
      job.screen[day] = (job.screen[day] || 0) + dt * RATE.SCROLLING;
      // swipe to the next video on a DNg100 spike, after a moment to take it in
      if (dn && t - job.lastSwipe > attention()) {
        job.lastSwipe = t; tapMouse = nowS();
        Buzz.next(false, attention());
        post({ type: 'stim', group: 'LC10a · visual', seconds: 0.3 });
        post({ type: 'stim', group: 'pam', seconds: 0.25 }); // the hit
        setDopamine(job.da * (1 - TOLERANCE));
        sfx.swipe();
      }
      if (job.clock >= job.scrollUntil) {
        if (job.scrollPhase === 'night') { flyState.sleeping = true; setState('SLEEP'); }
        else { planCommute(); setState('COMMUTE'); }
      }
    }
  }
  let tapMouse = -9, tapKey = -9;
  // Dopamine receptor sensitivity (our model): each video is a hit on the PAM reward neurons and costs 4% sensitivity;
  // sleep restores part of it. The brain scales every dopamine neuron's synapses by it.
  const TOLERANCE = 0.04, RECOVERY = 0.025; // tuned so a fly fries over about four days of this
  const attention = () => 2.6 * (0.35 + 0.65 * job.da);
  function setDopamine(v) {
    job.da = clamp(v, 0.03, 1);
    if (Math.abs(job.da - job.daSent) > 0.005) { job.daSent = job.da; post({ type: 'dopamine', gain: job.da }); }
  }
  function clickOnce(t) {
    if (job.portal && !job.portal.expiredAt) {
      if (job.portal.typed.length < 14) { job.portal.typed += pick('asdfjkl qwertyuiop zxcvbnm'.split('')); tapKey = nowS(); sfx.key(); }
      else { job.portal.expiredAt = t; tapMouse = nowS(); sfx.click(); }
    } else if (!job.portal) {
      tapMouse = nowS(); sfx.click(); job.lastClickReal = nowS();
      const p = job.posting;
      if (p.workdaze) job.portal = { company: p.company, role: p.role, typed: '', expiredAt: null };
      else {
        job.stampReal = nowS(); job.apps++; job.today++; $('apps').textContent = job.apps.toLocaleString();
        schedule({ company: p.company, role: p.role, applied: t });
        if (skipping()) newPosting(); else setTimeout(newPosting, 350);
      }
    }
  }

  // ------------------------------------------------------------------ fly motion
  function updateFly(dt, now) {
    const st = flyState, simDt = dt * speed;
    const drive = clamp(B.dnRate / 0.72, 0.25, 2.5);
    let walking = false, flying = false;
    if (!st.act && st.plan.length) {
      const nx = st.plan.shift();
      if (nx.hop) st.act = { kind: 'hop', from: st.pos.clone(), to: nx.hop.clone(), g0: st.ground, t: 0, dur: 0.9 + st.pos.distanceTo(nx.hop) * 0.6, h0: st.heading, h1: headingTo(st.pos, nx.hop) };
      else if (nx.walk) st.act = { kind: 'walk', to: nx.walk.clone() };
      else if (nx.face !== undefined) st.act = { kind: 'face', h: nx.face };
    }
    const a = st.act;
    if (a) {
      if (a.kind === 'walk') {
        walking = true;
        const want = headingTo(st.pos, a.to) + (B.rRate - B.lRate) * 0.12;
        st.heading += clamp(angDiff(st.heading, want), -2.5 * simDt, 2.5 * simDt);
        st.speed = 0.26 * drive;
        const step = Math.min(st.speed * simDt, Math.hypot(a.to.x - st.pos.x, a.to.z - st.pos.z));
        st.pos.x += Math.cos(st.heading) * step; st.pos.z -= Math.sin(st.heading) * step;
        st.walkPhase += TAU * (st.speed / 0.055) * simDt * 0.5;
        if (Math.hypot(a.to.x - st.pos.x, a.to.z - st.pos.z) < 0.06) st.act = null;
      } else if (a.kind === 'hop') {
        flying = true;
        a.t += simDt / a.dur; const u = ease(Math.min(1, a.t));
        st.pos.lerpVectors(a.from, a.to, u); st.ground = lerp(a.from.y, a.to.y, u);
        st.pos.y += Math.sin(Math.PI * Math.min(1, a.t)) * (0.28 + Math.abs(a.to.y - a.from.y) * 0.4);
        st.heading = a.h0 + angDiff(a.h0, a.h1) * Math.min(1, a.t * 2.5);
        if (a.t >= 1) { st.pos.copy(a.to); st.ground = a.to.y; st.act = null; }
      } else if (a.kind === 'face') {
        const d = angDiff(st.heading, a.h);
        st.heading += clamp(d, -3 * simDt, 3 * simDt); st.walkPhase += TAU * 2 * simDt;
        walking = Math.abs(d) > 0.05; if (Math.abs(d) < 0.02) st.act = null;
      }
    } else st.speed = 0;
    const happy = now < st.happyUntil, talking = now < st.talkUntil;
    setBuzz(flying || happy || talking);
    fly.position.copy(st.pos); fly.rotation.y = st.heading;
    const sleep = st.sleeping && job.state === 'SLEEP' && !a;
    const scrolling = job.state === 'SCROLLING' && !a;
    handPhone.visible = scrolling; standPhone.visible = phoneGlass.visible = !scrolling;
    faceLight.intensity = scrolling ? 0.9 : 0;
    const breathe = Math.sin(now * (sleep ? 1.6 : 3)) * 0.004;
    body.position.y = (sleep ? 0.03 : scrolling ? 0.045 : FLY_H) + breathe + (happy ? Math.abs(Math.sin(now * 14)) * 0.03 : 0);
    body.rotation.x = sleep ? 0.35 : 0;
    headG.rotation.z = scrolling ? 0.35 : 0;
    headG.rotation.y = sleep || scrolling ? 0 : talking ? Math.sin(now * 20) * 0.08 : Math.sin(now * 0.7) * 0.15;
    const flap = flying || happy || talking;
    for (const w of wings) { const s = w.userData.side; w.rotation.set(flap ? s * (0.3 + Math.sin(now * 70) * (talking ? 0.4 : 0.9)) : s * 0.08, flap ? 0 : -s * 0.12, flap ? 0.2 : -0.05); }
    const stride = 0.06, lift = 0.035, atDesk = (job.state === 'APPLYING' || job.state === 'INTERVIEW') && !a;
    const tapAge = now - tapMouse, keyAge = now - tapKey;
    for (const Lg of LEGS) {
      const foot = tmpB.copy(Lg.home);
      if (sleep) foot.set(Lg.hip.x + 0.02, -0.045, Lg.hip.z + 0.05 * Lg.side);
      else if (scrolling && Lg.idx === 0) {
        // front legs hold the phone; the right one flicks up on every swipe
        const flick = Lg.side > 0 && tapAge < 0.3 ? Math.sin(tapAge / 0.3 * Math.PI) * 0.03 : 0;
        foot.set(handPhone.position.x - 0.01, handPhone.position.y - body.position.y - 0.03 + flick, 0.035 * Lg.side);
      } else if (scrolling) foot.set(Lg.hip.x + 0.02, -0.04, Lg.hip.z + 0.05 * Lg.side);
      else if (atDesk && Lg.idx === 0) {
        const target = Lg.side > 0 ? MOUSE : KB;
        const dx = target.x - st.pos.x, dz = target.z - st.pos.z, c = Math.cos(st.heading), s = Math.sin(st.heading);
        foot.set(dx * c - dz * s, -FLY_H + 0.03, dx * s + dz * c);
        const age = Lg.side > 0 ? tapAge : keyAge, dur = Lg.side > 0 ? 0.25 : 0.18;
        const tap = age < dur ? Math.sin(age / dur * Math.PI) : 0;
        foot.y += (1 - tap) * 0.03 + 0.005; foot.clampLength(0, 0.26);
      } else if (walking) { const p = st.walkPhase + (Lg.tripod ? Math.PI : 0); foot.x += -stride / 2 * Math.cos(p); foot.y += Math.max(0, Math.sin(p)) * lift; }
      else if (flying) foot.set(Lg.home.x * 0.6, -0.06, Lg.home.z * 0.5);
      knee.copy(Lg.hip).lerp(foot, 0.45); knee.y += sleep || (scrolling && Lg.idx > 0) ? 0.02 : 0.06; knee.z += 0.02 * Lg.side;
      segment(Lg.femur, Lg.hip, knee, 0.008); segment(Lg.tibia, knee, foot, 0.006); Lg.toe.position.copy(foot);
    }
    const hAbove = st.pos.y - st.ground;
    blob.position.set(st.pos.x - Math.cos(st.heading) * 0.02, st.ground + 0.004, st.pos.z + Math.sin(st.heading) * 0.02);
    blob.rotation.z = st.heading; blob.material.opacity = clamp(0.55 - hAbove * 1.4, 0.08, 0.55) * (sleep ? 0.6 : 1);
    const fried = clamp((0.75 - job.da) / 0.55, 0, 1);
    eyeMat.color.copy(eyeFresh).lerp(eyeFried, fried); eyeMat.emissive.copy(glowFresh).multiplyScalar(1 - fried);
    shine.opacity = 1 - fried * 0.9;
    headG.getWorldPosition(tmpA);
    smoke.forEach((sm, i) => {
      const ph = (now * 0.5 + i / 4) % 1;
      sm.visible = job.da < 0.4;
      sm.position.set(tmpA.x + Math.sin(now * 2 + i) * 0.03, tmpA.y + 0.07 + ph * 0.3, tmpA.z + Math.cos(now * 1.7 + i) * 0.03);
      sm.material.opacity = Math.sin(ph * Math.PI) * 0.6 * clamp((0.4 - job.da) / 0.2, 0.3, 1);
      sm.scale.setScalar(0.05 + ph * 0.12);
    });
    zs.forEach((z, i) => { const ph = (now * 0.35 + i / 3) % 1; z.visible = sleep; z.position.set(st.pos.x + 0.1 + ph * 0.12, st.pos.y + 0.12 + ph * 0.35, st.pos.z - 0.05); z.material.opacity = Math.sin(ph * Math.PI) * 0.9; z.scale.setScalar(0.05 + ph * 0.06); });
    $('gait').textContent = walking ? (st.speed / 0.055).toFixed(1) : '0.0';
  }

  // ------------------------------------------------------------------ panel: connectome cloud, sparkline, rows
  function buildCloud(man, q, kind, sample, pinned) {
    const c = $('cloud');
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setClearColor(0x05060a, 1);
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const [lo, hi] = man.bounds, N = sample.length, pos = new Float32Array(N * 3), kd = new Float32Array(N), last = new Float32Array(N).fill(-99);
    const ctr = [0, 1, 2].map((a) => (lo[a] + hi[a]) / 2);
    for (let i = 0; i < N; i++) { const j = sample[i]; for (let a = 0; a < 3; a++) pos[i * 3 + a] = lo[a] + (q[j * 3 + a] / 65535) * (hi[a] - lo[a]) - ctr[a]; kd[i] = pinned.has(j) ? pinned.get(j) : kind[j] === 1 ? 1 : kind[j] === 2 ? 2 : 0; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aKind', new THREE.BufferAttribute(kd, 1));
    const lastAttr = new THREE.BufferAttribute(last, 1); lastAttr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aLast', lastAttr);
    const U = { uNow: { value: 0 }, uPx: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aKind; attribute float aLast; uniform float uNow, uPx; varying vec3 vC; varying float vA;
        void main(){
          float s = exp(-max(uNow - aLast, 0.0) * 30.0);
          vec3 base = vec3(0.30, 0.62, 0.95); float size = 0.012; float b = 0.34;
          if (aKind > 0.5 && aKind < 1.5) { base = vec3(0.28, 0.48, 0.95); b = 0.24; }
          if (aKind > 1.5 && aKind < 2.5) base = vec3(0.30, 0.85, 0.78);
          vec3 hot = vec3(1.0, 0.62, 0.18);
          if (aKind > 2.5) { size = 0.028; b = 0.5; }
          if (aKind > 2.5 && aKind < 3.5) { base = vec3(1.0, 0.77, 0.30); hot = base; }
          if (aKind > 3.5 && aKind < 4.5) { base = vec3(1.0, 0.36, 0.54); hot = base; }
          if (aKind > 4.5 && aKind < 5.5) { base = vec3(0.61, 1.0, 0.42); hot = base; size = 0.05; b = 0.9; }
          if (aKind > 5.5) { base = vec3(0.72, 0.55, 1.0); hot = base; }
          if (aKind > 7.5) { base = vec3(1.0, 0.62, 0.26); hot = base; }
          vC = base * b + hot * s * 0.4; vA = b + s * 0.4;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.2, size * (1.0 + s) * uPx / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; float a = smoothstep(0.5, 0.05, r); gl_FragColor = vec4(vC * a, a * min(1.0, vA)); }`,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    const holder = new THREE.Group(); holder.add(pts); sc.add(holder);
    cloud = { r, sc, cam, U, last, lastAttr, holder, span: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) };
  }
  function drawCloud(now) {
    if (!cloud) return;
    const c = $('cloud'), w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    if (c.width !== Math.round(w * cloud.r.getPixelRatio())) { cloud.r.setSize(w, h, false); cloud.cam.aspect = w / h; cloud.cam.updateProjectionMatrix(); }
    const d = cloud.span * 1.45; cloud.cam.position.set(0, d * 0.25, d); cloud.cam.lookAt(0, 0, 0);
    cloud.holder.rotation.y = reduced ? 0.6 : now * 0.12;
    cloud.U.uNow.value = now; cloud.U.uPx.value = cloud.cam.projectionMatrix.elements[5] * h * cloud.r.getPixelRatio() * 0.5;
    cloud.r.render(cloud.sc, cloud.cam);
  }
  function drawSpark() {
    const c = $('spark'), w = c.clientWidth, h = c.clientHeight, pr = Math.min(devicePixelRatio || 1, 2); if (!w) return;
    if (c.width !== Math.round(w * pr)) { c.width = Math.round(w * pr); c.height = Math.round(h * pr); }
    const g = c.getContext('2d'); g.setTransform(pr, 0, 0, pr, 0, 0); g.clearRect(0, 0, w, h);
    const hs = B.spikeHist; if (hs.length < 2) return;
    const max = Math.max(...hs) * 1.15, min = Math.min(...hs) * 0.85;
    g.strokeStyle = '#262c3a'; g.lineWidth = 1; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, h * i / 3); g.lineTo(w, h * i / 3); g.stroke(); }
    const X = (i) => (i / 239) * w, Y = (v) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8), off = 240 - hs.length;
    g.beginPath(); hs.forEach((v, i) => (i ? g.lineTo(X(i + off), Y(v)) : g.moveTo(X(i + off), Y(v)))); g.lineTo(X(239), h); g.lineTo(X(off), h); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,196,77,.35)'); gr.addColorStop(1, 'rgba(255,196,77,0)'); g.fillStyle = gr; g.fill();
    g.beginPath(); hs.forEach((v, i) => (i ? g.lineTo(X(i + off), Y(v)) : g.moveTo(X(i + off), Y(v)))); g.strokeStyle = '#ffc44d'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#ffc44d'; g.beginPath(); g.arc(X(239), Y(hs[hs.length - 1]), 2.6, 0, TAU); g.fill();
  }
  const rowEls = [];
  function buildTypeRows() {
    const host = $('types'); host.innerHTML = '';
    const colors = { 'DNg100 · walk forward': '#9bff6b', 'LB1a–d · bitter taste': '#ff5c8a', 'LB3c · sugar taste': '#ffc44d', 'JO-B · hearing': '#b58cff', 'PAM · reward dopamine': '#ff9f43', 'MBONs · mushroom body output': '#7fd4ff' };
    B.groups.forEach((g, i) => {
      if (['apply', 'scroll_l', 'scroll_r', 'sugar', 'bitter', 'hearing', 'dopamine', 'pam'].includes(g)) return;
      const row = document.createElement('div'); row.className = 'trow';
      row.innerHTML = '<span class="nm"></span><span class="meter"><i></i></span><span class="hz">0.0</span>';
      row.querySelector('.nm').textContent = g; row.querySelector('.nm').title = `${g} · ${B.sizes[i]} cells`;
      row.querySelector('i').style.background = colors[g] || '#5cc8e6';
      host.appendChild(row); rowEls.push({ i, bar: row.querySelector('i'), hz: row.querySelector('.hz') });
    });
  }
  function updatePanel() {
    if (!B.ready) return;
    $('mean').textContent = B.mean.toFixed(2);
    $('sps').textContent = `${Math.round(B.spikesPerSec).toLocaleString()} /s`;
    $('dlr').textContent = `${B.lRate.toFixed(1)} / ${B.rRate.toFixed(1)}`;
    for (const r of rowEls) { const hz = B.ema[r.i]; r.hz.textContent = hz.toFixed(1); r.bar.style.width = `${clamp(Math.log10(1 + hz) / Math.log10(61), 0, 1) * 100}%`; }
    $('clock').textContent = fmtClock(job.clock);
    const day = Math.floor(job.clock / 1440) + 1, gen = Math.floor((day - 1) / LIFESPAN) + 1;
    $('day').textContent = day.toLocaleString(); $('gen').textContent = gen;
    if (gen > job.gen) {
      job.gen = gen; setDopamine(1); job.daAtWake = 1;
      mail({ from: 'Hatchery', subject: `Account transferred to generation ${gen}`, notify: !skipping(),
        body: `The previous account holder has reached the end of a fruit fly's natural lifespan (about ${LIFESPAN} days).\nTheir job search has been transferred to generation ${gen}, along with ${job.apps.toLocaleString()} applications and ${job.rejs.toLocaleString()} rejections.\nNo action is needed. The search continues.` });
      toast('hear', 'Hatchery', `day ${day}`, `Generation ${gen} inherits the job search.`, `${LIFESPAN}-day lifespan reached`);
    }
    if (skipping()) {
      $('skDay').textContent = `Day ${day.toLocaleString()}`;
      $('skApps').textContent = job.apps.toLocaleString(); $('skRej').textContent = job.rejs.toLocaleString();
      $('skGen').textContent = gen; $('skGhost').textContent = job.ghosted.toLocaleString(); $('skDa').textContent = `${Math.round(job.da * 100)}%`;
      const tot = skip.real + skip.sampled, pct = tot ? Math.round(100 * skip.sampled / tot) : 0;
      $('skNote').textContent = `The brain keeps pace at ${brainRate.toFixed(1)}× real time on this device. ${pct}% of clicks in this skip are drawn from DNg100's live firing rate (${B.dnRate.toFixed(2)} Hz per cell).`;
    }
    drawClock(shortClock(job.clock));
    FlyMail.setStatus(shortClock(job.clock), job.battery, job.charging);
    Buzz.setTime(shortClock(job.clock));
    const mins = Math.round(job.screen[Math.floor(job.clock / 1440)] || 0);
    $('screen').textContent = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    $('vids').textContent = Buzz.watched.toLocaleString();
    const pct = Math.round(job.da * 100);
    $('dopa').textContent = `${pct}%${pct < 40 ? ' · fried' : ''}`;
    $('dopa').style.color = pct >= 70 ? 'var(--dn)' : pct >= 40 ? 'var(--sugar)' : 'var(--bitter)';
    $('attn').textContent = attention().toFixed(1);
  }

  // ------------------------------------------------------------------ camera
  const CAMS = { room: { pos: [3.7, 3.1, 3.3], tgt: [-0.2, 0.6, -1.0] }, bed: { pos: [-1.3, 1.28, -2.12], tgt: [-1.9, 0.62, -1.1] }, desk: { pos: [1.95, 1.2, -0.75], tgt: [1.45, 0.95, -1.95] }, window: { pos: [0.9, 1.3, 0.9], tgt: [-0.2, 1.3, -2.4] } };
  let camMode = 'follow', camAnim = null;
  const lastFly = new THREE.Vector3().copy(flyState.pos);
  function setCam(mode) {
    camMode = mode;
    document.querySelectorAll('[data-cam]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === mode)));
    const to = mode === 'follow' ? { pos: flyState.pos.clone().add(new THREE.Vector3(0.9, 0.65, 1.1)), tgt: flyState.pos.clone().add(new THREE.Vector3(0, 0.1, 0)) } : { pos: new THREE.Vector3(...CAMS[mode].pos), tgt: new THREE.Vector3(...CAMS[mode].tgt) };
    camAnim = { from: { pos: camera.position.clone(), tgt: controls.target.clone() }, to, t: 0 };
    lastFly.copy(flyState.pos);
  }
  function updateCam(dt) {
    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / 1.1); const u = ease(camAnim.t);
      camera.position.lerpVectors(camAnim.from.pos, camAnim.to.pos, u); controls.target.lerpVectors(camAnim.from.tgt, camAnim.to.tgt, u);
      if (camMode === 'follow') { const d = tmpA.subVectors(flyState.pos, lastFly); camAnim.to.pos.add(d); camAnim.to.tgt.add(d); lastFly.copy(flyState.pos); }
      if (camAnim.t >= 1) camAnim = null;
    } else if (camMode === 'follow') { const d = tmpA.subVectors(flyState.pos, lastFly); camera.position.add(d); controls.target.add(d); lastFly.copy(flyState.pos); }
    controls.update();
  }
  document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));

  // ------------------------------------------------------------------ controls
  $('bRej').addEventListener('click', () => { if (B.ready) reject(); });
  $('bInt').addEventListener('click', () => { if (B.ready && !job.aiQueued && job.state !== 'INTERVIEW') inviteAI(); });
  $('bRing').addEventListener('click', () => {
    if (!B.ready) return;
    if (job.state === 'SLEEP') wake('Ring ring. A recruiter, at dawn.');
    else if (job.state === 'SCROLLING') { post({ type: 'stim', group: 'hearing', seconds: 0.8 }); sfx.ring(); toast('hear', 'Phone', fmtClock(job.clock), 'Incoming call interrupts the video. It declines and keeps scrolling.', `JO-B hearing neurons ×${B.sizes[G.hearing]} stimulated`); }
    else { post({ type: 'stim', group: 'hearing', seconds: 0.8 }); sfx.ring(); ringUntil = nowS() + 1.2; lockLitUntil = nowS() + 2; toast('hear', 'Phone', fmtClock(job.clock), 'Spam call: "Your car\'s extended warranty." The fly has no car.', `JO-B hearing neurons ×${B.sizes[G.hearing]} stimulated`); }
  });
  $('bSound').addEventListener('click', () => {
    S.on = !S.on; if (S.on) audio().resume(); if (!S.on) setBuzz(false);
    $('bSound').setAttribute('aria-pressed', String(S.on)); $('bSound').textContent = `Sound: ${S.on ? 'on' : 'off'}`;
  });
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    speed = Number(b.dataset.speed); post({ type: 'speed', speed });
    FlyMail.batch = skipping(); if (!skipping()) FlyMail.render();
    Buzz.batch = skipping(); if (!skipping()) Buzz.flush();
    $('skip').hidden = !skipping(); skip.real = 0; skip.sampled = 0;
    document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  function setPhoneApp() {
    const bz = job.state === 'SCROLLING';
    $('buzz').hidden = !bz; $('flymail').style.visibility = bz ? 'hidden' : '';
    FlyMail.visible = !$('phone').classList.contains('closed') && !bz;
  }
  const narrow = () => innerWidth <= 760;
  function showPhone(open) {
    $('phone').classList.toggle('closed', !open); setPhoneApp();
    $('bPhone').setAttribute('aria-pressed', String(open));
    if (open && narrow()) showPanel(false);
  }
  function showPanel(open) {
    $('panel').classList.toggle('closed', !open); $('bBrain').setAttribute('aria-pressed', String(open));
    if (open && narrow()) showPhone(false);
  }
  $('bPhone').addEventListener('click', () => showPhone($('phone').classList.contains('closed')));
  $('bBrain').addEventListener('click', () => showPanel($('panel').classList.contains('closed')));
  showPhone(innerWidth >= 1180);

  // ------------------------------------------------------------------ loop
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 60 : 45; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  setCam('room'); setTimeout(() => setCam('follow'), 2500);
  let prev = nowS(), frame = 0, fpsT = prev, frames = 0;
  window.__office = { fps: 0, job, B, flyState, FlyMail, setCam };
  drawSky(hourOf(), 0);
  function loop() {
    const now = nowS(), dt = Math.min(0.05, now - prev); prev = now;
    if (B.ready) {
      const vdt = dt * speed; T += vdt;
      const share = brainRate >= 0.9 * speed ? 1 : clamp(brainRate / speed, 0, 1);
      const synth = share < 1 ? poisson(B.dnRate * B.sizes[G.apply] * vdt * (1 - share)) : 0;
      if (skipping()) { skip.real += pendingDn; skip.sampled += synth; }
      behave(pendingDn + synth, vdt); pendingDn = 0;
      updateFly(dt, now);
    }
    if (frame % 15 === 0 && FlyMail.dirty) FlyMail.render();
    if (frame % 15 === 0 && Buzz.dirty) Buzz.flush();
    if (job.state === 'SCROLLING' || !$('buzz').hidden) { Buzz.tick(now); if (frame % 3 === 0 && job.state === 'SCROLLING') drawHandPhone(); }
    updateCam(dt); updateLighting(dt);
    if (frame % 2 === 0) drawScreen(now);
    if (frame % 3 === 0) { drawCloud(now); drawSpark(); }
    if (frame % 10 === 0) { updatePanel(); drawSky(hourOf(), now); }
    if (frame % 6 === 0 && (now < lockLitUntil || now - lastLockDraw > 1)) { drawLock(now); lastLockDraw = now; }
    renderer.render(scene, camera);
    frame++; frames++;
    if (now - fpsT > 1) { window.__office.fps = frames / (now - fpsT); frames = 0; fpsT = now; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
