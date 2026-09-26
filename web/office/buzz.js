/* Buzz: a short-video app for flies. Vertical feed of little animated videos, endless, bad for you. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  // handle, on-screen hook, sound, scene, spoken captions (auto-subtitled word by word)
  const VIDEOS = [
    ['@wasp_hr', 'POV: you applied at 8:59', 'original sound · Vinegar & Sons HR', 'pov', []],
    ['@maggot.ceo', 'Day in the life of a VP of Fruit', 'Brayden Maggot · original sound', 'yacht', ['my dad said', 'I earned this', 'no nepotism', 'here']],
    ['@careerfly', '3 Easy Apply hacks recruiters HATE', 'motivational piano', 'vlog', ['hack number one', 'apply at 3 AM', 'hack number two', 'cry', 'hack number three', 'see hack two']],
    ['@larva.vlogs', 'Day 214 of unemployment', 'lofi beats to get ghosted to', 'vlog', ['day 214', 'applied to 40 jobs', 'ghosted by 38', 'the other two', 'were scams']],
    ['@ai.hireflow', 'GRWM for my AI interview', 'HireBot 9000 · theme', 'grwm', ['getting ready', 'for my AI interview', 'tie on', 'no one will watch it', 'but the vibes']],
    ['@banana.asmr', 'ASMR: banana ripening (10 hrs)', 'banana sounds', 'banana', []],
    ['@jobmarket.explained', 'The job market, explained by a wasp', 'ominous synth', 'chart', ['so basically', 'line go down', 'and that', 'is the job market']],
    ['@hustle.pupa', 'I wake up at 4 AM to apply to 400 jobs', 'hustle phonk', 'hustle', []],
    ['@rejection.rater', 'Ranking my rejection emails', 'original sound', 'tier', []],
    ['@entry.level', '"Entry level" · 10 years required', 'original sound', 'vlog', ['entry level', 'ten years experience', 'I am', 'nine days old']],
    ['@fly.law', 'Lifespan: 50 days. Probation: 90. Legal?', 'courtroom drama', 'vlog', ['legally', 'I am not a lawyer', 'I am a fly', 'but no']],
    ['@ghosted.again', 'Storytime: "we\'ll be in touch"', 'sad violin', 'vlog', ['they said', 'we will be in touch', 'that was 40 days ago', 'I have 10 left']],
    ['@recruiter.ron', 'Stop applying. Start networking.', 'podcast clip', 'podcast', ['stop applying', 'start networking', 'with who', 'exactly']],
    ['@windowsill.cam', 'LIVE: the windowsill at 3 PM', 'ambient', 'window', []],
    ['@fruit.review', 'Rating fruit by ripeness, part 12', 'original sound', 'fruit', []],
    ['@humbled.to.announce', 'Reading "humbled to announce" posts', 'original sound', 'vlog', ['I am humbled', 'to announce', 'absolutely', 'nothing']],
    ['@swatter.news', 'BREAKING: layoffs at Drosophila Dynamics', 'news jingle', 'news', ['breaking news', 'another round', 'of layoffs', 'back to you']],
    ['@take.home', 'I did a 6-hour take-home and…', 'sad violin', 'vlog', ['six hour take-home', 'unpaid', 'they hired the nephew', 'anyway']],
    ['@workdaze.pain', 'Retyping my résumé, any% speedrun', 'speedrun timer', 'speedrun', []],
    ['@kombucha.bro', 'Free kombucha is not a benefit', 'original sound', 'vlog', ['free kombucha', 'is not', 'a benefit', 'it is a warning']],
    ['@compost.cooking', 'What I eat in a day (unemployed)', 'cozy acoustic', 'compost', ['breakfast', 'compost', 'lunch', 'also compost']],
    ['@one.more.video', 'You should be asleep.', 'original sound', 'clock', []],
  ];
  const ADS = [
    ['Sponsored · Hatchery Premium', 'See who ignored you. First month free.', 'Hatchery', 'ad', []],
    ['Sponsored · Résumé.ai', 'Our AI rewrites your résumé so their AI can reject it faster.', 'Résumé.ai', 'adbot', []],
  ];
  const BGS = [['#2b1055', '#e5356b'], ['#0f3a4a', '#1b8fb4'], ['#3a2a05', '#ffb020'], ['#1a2a12', '#1f9d55'], ['#2a1030', '#7a5af5'], ['#35120f', '#d9480f'], ['#0b1020', '#2b4a8b']];
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ------------------------------------------------------------------ drawing kit
  const DISPLAY = '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  function grad(g, W, H, a, b) { const gr = g.createLinearGradient(0, 0, W * 0.4, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function ell(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); g.fill(); }
  function rrect(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); }
  function text(g, s, x, y, size, c, align = 'center', font = DISPLAY, weight = 700) { g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.fillStyle = c; g.fillText(s, x, y); }
  // the star of every video: a cartoon fruit fly, facing the camera
  function fly(g, x, y, s, t, o = {}) {
    const bob = Math.sin(t * (o.talk ? 7 : 2)) * s * 0.04;
    y += bob;
    ell(g, x, y + s * 1.55, s * 1.05, s * 0.85, '#6b4a2b');                        // thorax
    if (o.tie) { g.fillStyle = '#e5356b'; g.beginPath(); g.moveTo(x - s * 0.14, y + s * 0.95); g.lineTo(x + s * 0.14, y + s * 0.95); g.lineTo(x + s * 0.22, y + s * 1.9); g.lineTo(x, y + s * 2.1); g.lineTo(x - s * 0.22, y + s * 1.9); g.closePath(); g.fill(); }
    g.strokeStyle = '#3a2616'; g.lineWidth = s * 0.06; g.lineCap = 'round';
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * s * 0.25, y - s * 0.8); g.quadraticCurveTo(x + d * s * 0.4, y - s * 1.35, x + d * s * 0.7, y - s * 1.45); g.stroke(); ell(g, x + d * s * 0.72, y - s * 1.46, s * 0.08, s * 0.08, '#3a2616'); }
    ell(g, x, y, s, s * 0.92, o.color || '#c89350');                              // head
    const blink = (t % 3.1) < 0.12 || o.sleepy ? 0.12 : 1;
    for (const d of [-1, 1]) {
      ell(g, x + d * s * 0.58, y - s * 0.12, s * 0.46, s * 0.6 * blink, o.eyes || '#d8262c');
      if (blink > 0.5) ell(g, x + d * s * 0.48 + (o.look || 0) * s * 0.1, y - s * 0.34, s * 0.11, s * 0.13, 'rgba(255,255,255,.9)');
    }
    if (o.shades) { g.fillStyle = '#10131a'; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(x + d * s * 0.56, y - s * 0.1, s * 0.5, s * 0.36, 0, 0, TAU); g.fill(); } g.fillRect(x - s * 0.15, y - s * 0.2, s * 0.3, s * 0.07); }
    if (o.bags) for (const d of [-1, 1]) ell(g, x + d * s * 0.58, y + s * 0.5, s * 0.3, s * 0.08, 'rgba(60,30,60,.55)');
    const open = o.talk ? 0.04 + Math.abs(Math.sin(t * 13)) * 0.14 : o.shock ? 0.2 : 0.03;
    ell(g, x, y + s * 0.58, s * (o.shock ? 0.16 : 0.2), s * open, '#3a1a10');
  }
  function wasp(g, x, y, s, t, o = {}) {
    y += Math.sin(t * 7) * s * 0.04;
    ell(g, x, y + s * 1.6, s * 1.0, s * 0.9, '#ffc933');
    g.fillStyle = '#10131a'; for (let i = 0; i < 3; i++) g.fillRect(x - s, y + s * (1.2 + i * 0.35), s * 2, s * 0.14);
    if (o.tie) { g.fillStyle = '#2b4a8b'; g.beginPath(); g.moveTo(x - s * 0.12, y + s * 0.9); g.lineTo(x + s * 0.12, y + s * 0.9); g.lineTo(x + s * 0.18, y + s * 1.8); g.lineTo(x, y + s * 2); g.lineTo(x - s * 0.18, y + s * 1.8); g.closePath(); g.fill(); }
    ell(g, x, y, s * 0.9, s * 0.95, '#ffc933');
    for (const d of [-1, 1]) ell(g, x + d * s * 0.5, y - s * 0.15, s * 0.36, s * 0.52, '#10131a');
    ell(g, x, y + s * 0.55, s * 0.16, s * (0.04 + Math.abs(Math.sin(t * 12)) * 0.1), '#10131a');
  }
  function subs(g, W, H, t, lines, y) {
    if (!lines.length) return;
    const words = lines.join(' ').split(' '), i = Math.floor(t * 2.4) % (words.length + 3);
    if (i >= words.length) return;
    let n = 0, li = 0; for (; li < lines.length; li++) { const c = lines[li].split(' ').length; if (i < n + c) break; n += c; }
    const lw = lines[li].split(' '), k = i - n;
    g.font = `800 ${W * 0.085}px ${DISPLAY}`; g.textAlign = 'left'; g.lineJoin = 'round';
    const widths = lw.map((w) => g.measureText(w + ' ').width), total = widths.reduce((a, b) => a + b, 0);
    let x = (W - total) / 2;
    lw.forEach((w, j) => {
      g.lineWidth = W * 0.018; g.strokeStyle = '#000'; g.strokeText(w, x, y);
      g.fillStyle = j === k ? '#ffc44d' : j < k ? '#fff' : 'rgba(255,255,255,.55)'; g.fillText(w, x, y); x += widths[j];
    });
  }
  function room(g, W, H, v, t) {
    grad(g, W, H, v.bg[0], v.bg[1]);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(W * 0.62, H * 0.12, W * 0.28, H * 0.2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(W * 0.08, H * 0.26, W * 0.3, H * 0.02);
    ell(g, W * 0.16, H * 0.22, W * 0.05, W * 0.08, 'rgba(31,157,85,.7)');
    ell(g, W * 0.5, H * 0.34, W * 0.4, W * 0.4, 'rgba(255,255,255,.07)'); // ring light
  }

  // ------------------------------------------------------------------ scenes
  const SCENES = {
    vlog(g, W, H, t, v) {
      room(g, W, H, v, t);
      const cut = Math.floor(t / 1.3) % 2; // jump cuts
      g.save(); g.translate(W / 2, H * 0.42); g.scale(1 + cut * 0.18, 1 + cut * 0.18);
      fly(g, 0, 0, W * 0.2, t, { talk: true, bags: v.handle.includes('larva') || v.handle.includes('ghost'), tie: v.handle.includes('law'), look: Math.sin(t) });
      g.restore();
      subs(g, W, H, t, v.subs, H * 0.72);
    },
    pov(g, W, H, t, v) {
      grad(g, W, H, '#0b1020', '#2b4a8b');
      const flip = t > 1.2;
      rrect(g, W * 0.18, H * 0.22, W * 0.64, H * 0.14, 12, '#10131a');
      text(g, flip ? '9:00' : '8:59', W / 2, H * 0.325, W * 0.2, flip ? '#ff5c8a' : '#e9e5d9', 'center', MONO, 500);
      fly(g, W / 2, H * 0.52, W * 0.16, t, { shock: flip });
      if (flip) {
        const y = H * 0.68 + Math.max(0, 1 - (t - 1.2) * 4) * -H * 0.3;
        rrect(g, W * 0.08, y, W * 0.84, H * 0.1, 12, 'rgba(255,255,255,.95)');
        text(g, 'Vinegar & Sons', W * 0.13, y + H * 0.04, W * 0.045, '#10131a', 'left', DISPLAY, 700);
        text(g, 'Unfortunately, we have decided…', W * 0.13, y + H * 0.075, W * 0.04, '#5d6475', 'left', DISPLAY, 500);
      }
    },
    yacht(g, W, H, t, v) {
      grad(g, W, H, '#5fb8f0', '#bfe6ff');
      ell(g, W * 0.8, H * 0.14, W * 0.1, W * 0.1, '#ffe08a');
      g.fillStyle = '#1b8fb4'; g.fillRect(0, H * 0.62, W, H);
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) { g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * (0.66 + i * 0.07) + Math.sin(x * 0.05 + t * 3 + i) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      const bob = Math.sin(t * 2) * 5;
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(W * 0.1, H * 0.6 + bob); g.quadraticCurveTo(W * 0.5, H * 0.74 + bob, W * 0.9, H * 0.56 + bob); g.quadraticCurveTo(W * 0.5, H * 0.66 + bob, W * 0.1, H * 0.6 + bob); g.fill();
      fly(g, W * 0.5, H * 0.4 + bob, W * 0.15, t, { talk: true, shades: true, color: '#f1eadb', eyes: '#f1eadb' });
      subs(g, W, H, t, v.subs, H * 0.74);
    },
    grwm(g, W, H, t, v) {
      grad(g, W, H, '#f5d0dc', '#b58cff');
      g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.ellipse(W / 2, H * 0.42, W * 0.36, H * 0.26, 0, 0, TAU); g.stroke();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ell(g, W / 2 + Math.cos(a) * W * 0.4, H * 0.42 + Math.sin(a) * H * 0.29, 5, 5, '#fff8e0'); }
      fly(g, W / 2, H * 0.38, W * 0.17, t, { talk: true, tie: t > 1.5 });
      subs(g, W, H, t, v.subs, H * 0.75);
    },
    banana(g, W, H, t) {
      grad(g, W, H, '#1a1410', '#3a2a18');
      const r = clamp(t / 4, 0, 1);
      const col = r < 0.5 ? mix('#ffd23f', '#d9b23a', r * 2) : mix('#d9b23a', '#5a3a16', (r - 0.5) * 2);
      g.save(); g.translate(W / 2, H * 0.45); g.rotate(-0.35);
      g.fillStyle = col; g.beginPath(); g.moveTo(-W * 0.34, 0); g.quadraticCurveTo(0, H * 0.2, W * 0.34, -H * 0.03); g.quadraticCurveTo(0, H * 0.09, -W * 0.34, 0); g.fill();
      g.fillStyle = 'rgba(40,25,10,.8)'; for (let i = 0; i < Math.floor(r * 14); i++) ell(g, -W * 0.25 + (i * 37 % 100) / 100 * W * 0.5, H * 0.03 + (i * 53 % 7) * 3, 3 + (i % 3), 2 + (i % 2), 'rgba(40,25,10,.8)');
      g.restore();
      for (let i = 0; i < 12; i++) { const a = t * 0.8 + i; ell(g, W / 2 + Math.cos(a * 1.3) * W * 0.4, H * 0.45 + Math.sin(a) * H * 0.2, 1.6, 1.6, 'rgba(255,240,200,.6)'); }
      text(g, `Day ${1 + Math.floor(r * 8)}`, W / 2, H * 0.78, W * 0.09, '#fff', 'center', MONO, 500);
    },
    chart(g, W, H, t, v) {
      grad(g, W, H, '#f1f3f7', '#dde2eb');
      rrect(g, W * 0.06, H * 0.2, W * 0.88, H * 0.28, 8, '#fff');
      g.strokeStyle = '#e5356b'; g.lineWidth = 4; g.beginPath();
      const n = Math.min(12, Math.floor(t * 4) + 2);
      for (let i = 0; i < n; i++) { const x = W * (0.1 + i * 0.07), y = H * (0.26 + i * 0.016 + (i % 2) * 0.01); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      text(g, 'JOBS', W * 0.12, H * 0.24, W * 0.04, '#5d6475', 'left', MONO, 500);
      wasp(g, W * 0.5, H * 0.6, W * 0.13, t, { tie: true });
      g.strokeStyle = '#10131a'; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.62, H * 0.64); g.lineTo(W * 0.78, H * 0.42 + Math.sin(t * 3) * 6); g.stroke();
      subs(g, W, H, t, v.subs, H * 0.76);
    },
    hustle(g, W, H, t) {
      grad(g, W, H, '#05060a', '#1b2233');
      const ring = t < 1.2;
      g.save(); g.translate(W / 2, H * 0.24); if (ring) g.rotate(Math.sin(t * 40) * 0.08);
      rrect(g, -W * 0.28, -H * 0.06, W * 0.56, H * 0.12, 14, '#10131a'); text(g, '4:00', 0, H * 0.03, W * 0.15, '#ff3b3b', 'center', MONO, 500); g.restore();
      rrect(g, W * 0.15, H * 0.42, W * 0.7, H * 0.26, 10, '#262c3a'); rrect(g, W * 0.18, H * 0.44, W * 0.64, H * 0.21, 6, '#eef1f6');
      const apps = Math.min(400, Math.floor(Math.max(0, t - 0.8) * 160));
      text(g, 'applied', W / 2, H * 0.52, W * 0.05, '#5d6475', 'center', MONO, 500);
      text(g, String(apps), W / 2, H * 0.62, W * 0.14, '#10131a');
      fly(g, W / 2, H * 0.82, W * 0.1, t, { sleepy: t > 2 });
    },
    tier(g, W, H, t) {
      g.fillStyle = '#10131a'; g.fillRect(0, 0, W, H);
      const rows = [['S', '#ff5c8a'], ['A', '#ffb020'], ['B', '#ffd23f'], ['C', '#9bff6b'], ['F', '#5cc8e6']];
      const rh = H * 0.09, y0 = H * 0.25;
      rows.forEach(([l, c], i) => { g.fillStyle = c; g.fillRect(W * 0.05, y0 + i * (rh + 4), W * 0.16, rh); text(g, l, W * 0.13, y0 + i * (rh + 4) + rh * 0.68, rh * 0.55, '#10131a'); g.fillStyle = '#1d2230'; g.fillRect(W * 0.23, y0 + i * (rh + 4), W * 0.72, rh); });
      const cards = [['V', 1], ['W', 4], ['D', 2], ['H', 4], ['P', 3], ['L', 0]];
      cards.forEach(([ch, row], i) => {
        const appear = t - i * 0.45; if (appear < 0) return;
        const slot = cards.slice(0, i).filter((c) => c[1] === row).length;
        const tx = W * 0.26 + slot * W * 0.16, ty = y0 + row * (rh + 4) + rh * 0.12;
        const k = clamp(appear * 3, 0, 1), x = tx, y = H * 0.9 + (ty - H * 0.9) * (1 - (1 - k) ** 3);
        rrect(g, x, y, W * 0.13, rh * 0.76, 6, '#fff'); text(g, ch, x + W * 0.065, y + rh * 0.52, rh * 0.4, '#e5356b');
      });
      text(g, 'my rejection emails', W / 2, H * 0.225, W * 0.055, '#fff');
    },
    podcast(g, W, H, t, v) {
      grad(g, W, H, '#1a1030', '#2b1055');
      rrect(g, W * 0.05, H * 0.2, W * 0.9, H * 0.06, 8, 'rgba(255,255,255,.1)'); text(g, 'THE GRINDSET POD · ep. 400', W / 2, H * 0.24, W * 0.042, '#ffc44d', 'center', MONO, 500);
      fly(g, W * 0.5, H * 0.44, W * 0.16, t, { talk: true, shades: false });
      g.strokeStyle = '#10131a'; g.lineWidth = 7; g.beginPath(); g.arc(W * 0.5, H * 0.42, W * 0.2, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      rrect(g, W * 0.6, H * 0.5, W * 0.07, H * 0.12, 10, '#262c3a');
      subs(g, W, H, t, v.subs, H * 0.75);
    },
    window(g, W, H, t) {
      grad(g, W, H, '#6aa9e8', '#cfe6fb');
      ell(g, ((t * 6) % (W + 100)) - 50, H * 0.2, 40, 12, 'rgba(255,255,255,.8)');
      g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, W * 0.06, H); g.fillRect(W * 0.94, 0, W * 0.06, H); g.fillRect(0, 0, W, H * 0.05); g.fillRect(W * 0.47, 0, W * 0.06, H * 0.62);
      g.fillStyle = '#d8d0c0'; g.fillRect(0, H * 0.62, W, H * 0.06); g.fillStyle = '#b8ab94'; g.fillRect(0, H * 0.68, W, H);
      rrect(g, W * 0.06, H * 0.21, W * 0.2, H * 0.045, 6, '#e5356b'); text(g, 'LIVE', W * 0.16, H * 0.243, W * 0.045, '#fff', 'center', MONO, 700);
      text(g, `${(12 + Math.floor(t)) % 20} watching`, W * 0.3, H * 0.243, W * 0.04, '#10131a', 'left', MONO, 500);
      text(g, 'nothing is happening', W / 2, H * 0.8, W * 0.05, '#5d5040', 'center', MONO, 500);
    },
    fruit(g, W, H, t) {
      grad(g, W, H, '#fff4dc', '#ffd9a8');
      const fr = [['banana', '7/10'], ['apple', '4/10'], ['mango', '10/10'], ['grapes', '2/10']];
      const i = Math.min(fr.length - 1, Math.floor(t / 0.9)), cx = W / 2, cy = H * 0.45 + Math.sin(t * 5) * 4, s = W * 0.2;
      const kind = fr[i][0];
      if (kind === 'banana') { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(cx - s * 1.3, cy - s * 0.2); g.quadraticCurveTo(cx, cy + s * 1.2, cx + s * 1.3, cy - s * 0.4); g.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 1.3, cy - s * 0.2); g.fill(); }
      if (kind === 'apple') { ell(g, cx, cy, s, s * 0.92, '#e5356b'); g.fillStyle = '#3a2616'; g.fillRect(cx - 3, cy - s * 1.15, 6, s * 0.3); ell(g, cx + s * 0.3, cy - s * 1.0, s * 0.25, s * 0.12, '#1f9d55'); }
      if (kind === 'mango') { ell(g, cx, cy, s * 1.1, s * 0.8, '#ffb020'); ell(g, cx + s * 0.3, cy - s * 0.2, s * 0.6, s * 0.4, '#ff8a3d'); }
      if (kind === 'grapes') for (let r = 0; r < 4; r++) for (let k = 0; k <= 3 - r; k++) ell(g, cx - (3 - r) * s * 0.22 + k * s * 0.44, cy - s * 0.5 + r * s * 0.38, s * 0.22, s * 0.22, '#7a5af5');
      g.save(); g.translate(W * 0.7, H * 0.26); g.rotate(-0.2); rrect(g, -W * 0.18, -H * 0.04, W * 0.36, H * 0.08, 8, '#10131a'); text(g, fr[i][1], 0, H * 0.02, W * 0.08, '#ffc44d', 'center', MONO, 700); g.restore();
      text(g, `${kind} · ripeness`, W / 2, H * 0.72, W * 0.06, '#5d3a10', 'center', MONO, 500);
    },
    news(g, W, H, t, v) {
      grad(g, W, H, '#0b1020', '#1b2a55');
      wasp(g, W * 0.5, H * 0.34, W * 0.15, t, { tie: true });
      g.fillStyle = '#10131a'; g.fillRect(0, H * 0.54, W, H * 0.12);
      g.fillStyle = '#e5356b'; g.fillRect(0, H * 0.54, W * 0.36, H * 0.05); text(g, 'BREAKING', W * 0.18, H * 0.578, W * 0.05, '#fff', 'center', MONO, 700);
      text(g, 'LAYOFFS AT DROSOPHILA DYNAMICS', W * 0.04, H * 0.63, W * 0.045, '#fff', 'left', DISPLAY, 700);
      g.fillStyle = '#ffb020'; g.fillRect(0, H * 0.66, W, H * 0.04);
      const tick = 'FRUIT PRICES UP 400% · WASP HIRED AS HEAD OF HR · "WE ARE A FAMILY" SAYS CEO · ';
      g.save(); g.beginPath(); g.rect(0, H * 0.66, W, H * 0.04); g.clip();
      text(g, tick + tick, W - ((t * 60) % (W * 3)), H * 0.69, W * 0.038, '#10131a', 'left', MONO, 700); g.restore();
      subs(g, W, H, t, v.subs, H * 0.78);
    },
    speedrun(g, W, H, t) {
      g.fillStyle = '#e9edf5'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2b4a8b'; g.fillRect(0, H * 0.2, W, H * 0.06); text(g, 'Workdaze', W * 0.06, H * 0.243, W * 0.05, '#fff', 'left');
      rrect(g, W * 0.52, H * 0.28, W * 0.44, H * 0.07, 8, '#10131a'); text(g, `0:${(12 + t).toFixed(2).padStart(5, '0')}`, W * 0.74, H * 0.33, W * 0.07, '#9bff6b', 'center', MONO, 700);
      text(g, 'Work experience', W * 0.06, H * 0.4, W * 0.05, '#10131a', 'left', DISPLAY, 600);
      rrect(g, W * 0.06, H * 0.43, W * 0.88, H * 0.26, 6, '#fff');
      const s = 'Senior Fly, Compost Heap Logistics. Hovered near fruit. Increased landings by 40%. Skills: walking.';
      const shown = s.slice(0, Math.floor(t * 30));
      g.font = `500 ${W * 0.045}px ${MONO}`; g.fillStyle = '#10131a'; g.textAlign = 'left';
      let line = '', y = H * 0.48; for (const w of shown.split(' ')) { const tt = line ? line + ' ' + w : w; if (g.measureText(tt).width > W * 0.8 && line) { g.fillText(line, W * 0.09, y); y += W * 0.06; line = w; } else line = tt; } g.fillText(line + (Math.floor(t * 3) % 2 ? '|' : ''), W * 0.09, y);
      text(g, 'PB  -0.4', W * 0.28, H * 0.33, W * 0.045, '#1f9d55', 'center', MONO, 700);
    },
    compost(g, W, H, t, v) {
      grad(g, W, H, '#f3e7d3', '#d9c3a0');
      ell(g, W / 2, H * 0.5, W * 0.4, H * 0.1, '#fff'); ell(g, W / 2, H * 0.5, W * 0.33, H * 0.075, '#eee6d8');
      for (let i = 0; i < 14; i++) ell(g, W / 2 + ((i * 29) % 60 - 30) * W * 0.008, H * 0.46 + ((i * 17) % 20) * 0.9, 9, 6, ['#5a3a16', '#3a5a16', '#8a5a26', '#2a1a0a'][i % 4]);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3;
      for (let i = 0; i < 3; i++) { g.beginPath(); const x = W * (0.42 + i * 0.08); for (let k = 0; k < 20; k++) { const y = H * 0.4 - k * 5; const xx = x + Math.sin(k * 0.6 + t * 4 + i) * 5; k ? g.lineTo(xx, y) : g.moveTo(xx, y); } g.stroke(); }
      fly(g, W * 0.5, H * 0.2, W * 0.09, t, { talk: true });
      subs(g, W, H, t, v.subs, H * 0.74);
    },
    clock(g, W, H, t) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const a = 0.6 + Math.sin(t * 2) * 0.4;
      text(g, '3:12 AM', W / 2, H * 0.42, W * 0.18, `rgba(255,255,255,${a})`, 'center', MONO, 500);
      text(g, 'you should be asleep', W / 2, H * 0.52, W * 0.055, 'rgba(255,255,255,.7)');
      text(g, 'swipe to keep scrolling ↑', W / 2, H * 0.6, W * 0.045, '#ffc44d', 'center', MONO, 500);
    },
    ad(g, W, H, t) {
      grad(g, W, H, '#10131a', '#2a1800');
      const sweep = ((t * 0.8) % 1.6) - 0.3;
      rrect(g, W * 0.12, H * 0.28, W * 0.76, H * 0.3, 18, '#ffb020');
      g.save(); g.beginPath(); g.rect(W * 0.12, H * 0.28, W * 0.76, H * 0.3); g.clip();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(W * sweep, H * 0.28); g.lineTo(W * (sweep + 0.15), H * 0.28); g.lineTo(W * (sweep - 0.05), H * 0.58); g.lineTo(W * (sweep - 0.2), H * 0.58); g.fill(); g.restore();
      ell(g, W / 2, H * 0.4, W * 0.14, W * 0.08, '#2a1800'); ell(g, W / 2, H * 0.4, W * 0.05, W * 0.05, '#ffb020');
      text(g, 'Hatchery Premium', W / 2, H * 0.52, W * 0.07, '#2a1800');
      text(g, 'see who ignored you', W / 2, H * 0.66, W * 0.05, '#e9e5d9', 'center', MONO, 500);
    },
    adbot(g, W, H, t) {
      grad(g, W, H, '#0b0d14', '#2b1055');
      const r = W * 0.18 + Math.sin(t * 5) * 4, gr = g.createRadialGradient(W / 2, H * 0.36, 4, W / 2, H * 0.36, r + 30);
      gr.addColorStop(0, '#e6d9ff'); gr.addColorStop(0.4, '#b58cff'); gr.addColorStop(1, 'rgba(122,90,245,0)'); g.fillStyle = gr; g.beginPath(); g.arc(W / 2, H * 0.36, r + 30, 0, TAU); g.fill();
      rrect(g, W * 0.15, H * 0.56, W * 0.7, H * 0.14, 10, '#fff');
      const n = Math.floor(t * 18) % 60;
      g.fillStyle = '#10131a'; for (let i = 0; i < 4; i++) g.fillRect(W * 0.2, H * (0.585 + i * 0.028), W * (0.6 * clamp((n - i * 12) / 12, 0, 1)), 5);
      text(g, 'Résumé.ai', W / 2, H * 0.8, W * 0.07, '#fff');
    },
  };
  function mix(a, b, t) { const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), Bc = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return `rgb(${A.map((x, i) => Math.round(x + (Bc[i] - x) * t)).join(',')})`; }

  const ICON = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="currentColor"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M13 5l8 7-8 7v-4c-5 0-8 1.5-10 5 1-6 4-10 10-10z" fill="currentColor"/></svg>',
  };

  const Buzz = {
    root: null, current: null, canvas: null, watched: 0, batch: false, dirty: false, started: 0,
    init(root) {
      this.root = root;
      root.innerHTML = `
        <div class="bz-top"><span class="bz-time">7:00</span><span class="bz-tabs"><span>Following</span><b>For You</b></span><span class="bz-app">Buzz</span></div>
        <div class="bz-stage"></div>
        <div class="bz-bottom"><i class="bz-prog"></i></div>`;
      this.stage = root.querySelector('.bz-stage');
      this.next(true);
    },
    make() {
      const ad = Math.random() < 0.1;
      const [handle, text, sound, scene, subsLines] = ad ? pick(ADS) : pick(VIDEOS);
      return { ad, handle, text, sound, scene, subs: subsLines, bg: pick(BGS), likes: Math.floor(Math.random() ** 3 * 2.4e6) + 120, comments: Math.floor(Math.random() ** 3 * 4e4) + 3, liked: Math.random() < 0.15 };
    },
    card(v) {
      const el = document.createElement('div');
      el.className = 'bz-card' + (v.ad ? ' ad' : '');
      el.innerHTML = `
        <canvas class="bz-canvas"></canvas>
        <div class="bz-hook"><span></span></div>
        <div class="bz-rail">
          <span class="bz-av">${v.handle.replace(/[^a-z]/gi, '')[0].toUpperCase()}</span>
          <span class="bz-act${v.liked ? ' on' : ''}">${ICON.heart}<small>${fmt(v.likes)}</small></span>
          <span class="bz-act">${ICON.chat}<small>${fmt(v.comments)}</small></span>
          <span class="bz-act">${ICON.save}<small>${fmt(Math.floor(v.likes / 30))}</small></span>
          <span class="bz-act">${ICON.share}<small>Share</small></span>
        </div>
        <div class="bz-meta"><b></b><p></p><span class="bz-sound"></span>${v.ad ? '<button type="button" class="bz-cta">Learn more</button>' : ''}</div>`;
      el.querySelector('.bz-hook span').textContent = v.text;
      el.querySelector('.bz-meta b').textContent = v.handle;
      el.querySelector('.bz-meta p').textContent = v.ad ? 'Sponsored' : '#fyp #jobsearch #fly';
      el.querySelector('.bz-sound').textContent = `♫ ${v.sound}`;
      return el;
    },
    next(first, dwell = 3) {
      const v = this.make(); this.current = v; this.started = performance.now() / 1000;
      if (!first) this.watched++;
      if (!this.root) return v;
      if (this.batch) { this.dirty = true; return v; }
      const old = this.stage.querySelector('.bz-card:not(.leaving)');
      const el = this.card(v);
      if (!first) el.classList.add('entering');
      this.stage.appendChild(el);
      this.canvas = el.querySelector('canvas');
      if (old) { old.classList.add('leaving'); setTimeout(() => old.remove(), 420); }
      requestAnimationFrame(() => el.classList.remove('entering'));
      const prog = this.root.querySelector('.bz-prog');
      prog.style.transition = 'none'; prog.style.width = '0%'; void prog.offsetWidth;
      prog.style.transition = `width ${dwell}s linear`; prog.style.width = '100%';
      return v;
    },
    // draw the playing video; runs even when the phone overlay is hidden, because the 3D phone shows it too
    tick(now) {
      const c = this.canvas; if (!c || !this.current) return;
      const W = c.clientWidth || 272, H = c.clientHeight || 588, pr = Math.min(devicePixelRatio || 1, 2);
      if (c.width !== Math.round(W * pr) || c.height !== Math.round(H * pr)) { c.width = Math.round(W * pr); c.height = Math.round(H * pr); }
      const g = c.getContext('2d'); g.setTransform(pr, 0, 0, pr, 0, 0);
      g.save();
      try { (SCENES[this.current.scene] || SCENES.vlog)(g, W, H, Math.max(0, now - this.started), this.current); }
      catch (err) { if (!this.warned) { console.warn('Buzz scene failed', this.current.scene, err); this.warned = true; } }
      g.restore();
    },
    flush() {
      if (!this.dirty || !this.root) return;
      this.dirty = false;
      this.stage.innerHTML = ''; const el = this.card(this.current); this.stage.appendChild(el); this.canvas = el.querySelector('canvas');
    },
    setTime(t) { if (this.root) this.root.querySelector('.bz-time').textContent = t; },
  };
  window.Buzz = Buzz;
})();
