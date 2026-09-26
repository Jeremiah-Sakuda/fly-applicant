(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const colors = ['#1b8fb4', '#e5356b', '#7a5af5', '#1f9d55', '#d9480f', '#2b4a8b', '#b8860b'];
  let current = null, queue = [], busy = false, unread = 0;
  const WD_CHARS = 18;

  async function fetchPosting() { const r = await fetch('/api/posting'); return r.json(); }
  async function fill() { while (queue.length < 4) queue.push(await fetchPosting()); }

  function render(p) {
    current = p;
    $('company').textContent = p.company;
    $('meta').textContent = `${p.location} · ${p.posted} ago`;
    $('av').textContent = p.company[0];
    $('av').style.background = colors[p.id % colors.length];
    $('role').textContent = p.role;
    $('chips').innerHTML = '';
    [[p.salary, 'sal'], [p.perk, ''], [p.workdaze ? 'Apply on company site' : 'Easy Apply', '']].forEach(([t, c]) => {
      const s = document.createElement('span'); s.className = 'chip ' + c; s.textContent = t; $('chips').appendChild(s);
    });
    $('reqs').innerHTML = '';
    p.reqs.forEach((t) => { const li = document.createElement('li'); li.textContent = t; $('reqs').appendChild(li); });
    $('appl').textContent = `${p.applicants.toLocaleString()} applicants`;
    $('easy').textContent = p.workdaze ? 'Apply' : 'Easy Apply';
    $('next').innerHTML = '';
    queue.slice(0, 3).forEach((q) => {
      const d = document.createElement('div'); d.className = 'mini';
      d.innerHTML = `<span><b></b> · <span></span></span><span>${q.posted}</span>`;
      d.querySelector('b').textContent = q.role; d.querySelector('span span').textContent = q.company;
      $('next').appendChild(d);
    });
  }

  let ws;
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

  async function advance() {
    const card = $('card');
    card.classList.add('out');
    await new Promise((r) => setTimeout(r, 200));
    await fill();
    render(queue.shift());
    fill();
    card.classList.remove('out'); card.classList.add('in');
    $('stamp').classList.remove('show');
    void card.offsetWidth; card.classList.remove('in');
    busy = false;
  }

  function applied() {
    send({ type: 'applied', posting: current });
    $('stamp').classList.add('show');
    setTimeout(advance, 260);
  }

  $('easy').addEventListener('click', () => {
    if (busy || !current) return;
    busy = true;
    if (current.workdaze) return openWorkdaze();
    applied();
  });

  // ---------- Workdaze ----------
  let wdStep = 0;
  function openWorkdaze() {
    wdStep = 0;
    $('wdCo').textContent = `${current.company} · Careers`;
    $('wdSteps').innerHTML = Array.from({ length: 11 }, (_, i) => `<i class="${i < 3 ? 'done' : ''}"></i>`).join('');
    $('wdText').value = ''; $('wdErr').hidden = true;
    $('wd').hidden = false;
    $('easy').removeAttribute('data-fly');
    $('wdText').setAttribute('data-fly', 'primary');
    $('wdText').focus();
    send({ type: 'workdaze', company: current.company });
  }
  $('wdText').addEventListener('input', () => {
    if ($('wdText').value.length >= WD_CHARS) {
      $('wdText').removeAttribute('data-fly');
      $('wdGo').setAttribute('data-fly', 'primary');
    }
  });
  $('wdGo').addEventListener('click', () => {
    if ($('wdText').value.length < WD_CHARS) return;
    wdStep++;
    if (wdStep === 1) {
      $('wdErr').hidden = false;
      $('wdGo').removeAttribute('data-fly');
      setTimeout(() => {
        $('wd').hidden = true;
        $('easy').setAttribute('data-fly', 'primary');
        applied();
      }, 1600);
    }
  });

  // ---------- inbox ----------
  function mail(cls, from, text, when) {
    const d = document.createElement('div'); d.className = 'mail ' + cls;
    d.innerHTML = '<div class="from"><span></span><time></time></div><p></p>';
    d.querySelector('span').textContent = from; d.querySelector('time').textContent = when; d.querySelector('p').textContent = text;
    $('mails').prepend(d);
    while ($('mails').children.length > 5) $('mails').lastChild.remove();
    unread++; $('navInbox').textContent = unread; $('inboxMeta').textContent = `${unread} unread`;
  }
  function fmtAfter(m) { return m < 1 ? `${Math.round(m * 60)} sec after applying` : `${m.toFixed(0)} min after applying`; }
  function onEvent(e) {
    const s = e.state || {};
    if (s.apps !== undefined) { $('count').textContent = s.apps.toLocaleString(); $('navApplied').textContent = s.apps.toLocaleString(); $('navInt').textContent = s.interviews; }
    if (e.type === 'rejection') mail('rej', e.company, e.text, fmtAfter(e.after));
    if (e.type === 'interview') mail('int', e.company, e.text, fmtAfter(e.after));
    if (e.type === 'inmail') mail('inm', e.sender, e.text, 'InMail');
  }
  function connect() {
    ws = new WebSocket(`ws://${location.host}/ws/board`);
    ws.onmessage = (m) => onEvent(JSON.parse(m.data));
    ws.onclose = () => setTimeout(connect, 1000);
  }

  // ---------- cursor ----------
  const cur = $('cursor');
  document.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; });
  document.addEventListener('mousedown', (e) => {
    const r = document.createElement('div'); r.className = 'ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 600);
  });
  cur.style.left = '450px'; cur.style.top = '640px';

  connect();
  fill().then(() => { render(queue.shift()); fill(); });
})();
