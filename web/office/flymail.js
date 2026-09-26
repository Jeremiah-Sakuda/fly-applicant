/* FlyMail: the fly's phone. A mail app in the spirit of every mail app, with its own look. */
(() => {
  'use strict';
  const COLORS = ['#e5356b', '#1b8fb4', '#7a5af5', '#1f9d55', '#d9480f', '#2b4a8b', '#b8860b', '#0f766e'];
  const colorFor = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const TABS = [['primary', 'Primary'], ['updates', 'Updates'], ['recruiters', 'Recruiters']];

  const FlyMail = {
    mails: [], tab: 'primary', openId: null, nextId: 1, root: null, onToast: null, batch: false, dirty: false, visible: false, lastBanner: 0,
    init(root) {
      this.root = root;
      root.innerHTML = `
        <div class="fm-status"><span class="fm-time">3:47</span><span class="fm-right"><span class="fm-sig"><i></i><i></i><i></i><i></i></span><span class="fm-batt"><span class="fm-batt-lvl"></span></span><span class="fm-pct">100%</span></span></div>
        <div class="fm-banner" hidden><div class="fm-bicon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l9 6 9-6M4 6h16v12H4z" fill="none" stroke="#2a1800" stroke-width="2" stroke-linejoin="round"/></svg></div><div class="fm-btext"><div class="fm-bapp">FlyMail · now</div><div class="fm-bfrom"></div><div class="fm-bsub"></div></div></div>
        <div class="fm-list-view">
          <div class="fm-search"><span class="fm-burger" aria-hidden="true"><i></i><i></i><i></i></span><span class="fm-ph">Search in mail</span><span class="fm-me" title="D. melanogaster">D</span></div>
          <div class="fm-tabs" role="tablist"></div>
          <div class="fm-list" role="list"></div>
          <button class="fm-fab" type="button">Compose</button>
          <div class="fm-snack" hidden></div>
        </div>
        <div class="fm-detail" hidden>
          <div class="fm-dbar"><button class="fm-back" type="button" aria-label="Back to inbox">←</button><span class="fm-dlabel"></span></div>
          <div class="fm-dscroll">
            <h3 class="fm-dsub"></h3>
            <div class="fm-dmeta"><span class="fm-av fm-dav"></span><div><div class="fm-dfrom"></div><div class="fm-dto">to me · <span class="fm-dtime"></span></div></div></div>
            <div class="fm-dbody"></div>
            <div class="fm-dbtns"><button type="button" class="fm-reply">Reply</button><button type="button" class="fm-reply">Forward</button></div>
          </div>
        </div>`;
      this.$ = (s) => root.querySelector(s);
      const tabs = this.$('.fm-tabs');
      for (const [key, label] of TABS) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'fm-tab'; b.dataset.tab = key; b.setAttribute('role', 'tab');
        b.innerHTML = `<span></span><b></b>`; b.querySelector('span').textContent = label;
        b.addEventListener('click', () => { this.tab = key; this.render(); });
        tabs.appendChild(b);
      }
      this.$('.fm-back').addEventListener('click', () => { this.openId = null; this.render(); });
      this.$('.fm-fab').addEventListener('click', () => this.snack('Compose is disabled. You are a fly.'));
      root.querySelectorAll('.fm-reply').forEach((b) => b.addEventListener('click', () => this.snack('Replies go to no-reply@. Nobody is reading.')));
      this.render();
    },
    add(mail) {
      const m = Object.assign({ id: this.nextId++, unread: true, starred: false, category: 'primary' }, mail);
      this.mails.unshift(m);
      if (this.mails.length > 120) this.mails.length = 120;
      if (this.batch) { this.dirty = true; return m; } // time skip: redraw a few times a second instead
      this.render();
      if (m.notify !== false) this.banner(m);
      return m;
    },
    unread(cat) { return this.mails.filter((m) => m.unread && (!cat || m.category === cat)).length; },
    banner(m) {
      // one banner at a time, long enough to read
      const now = performance.now();
      if (now - this.lastBanner < 4500) return;
      this.lastBanner = now;
      // fixed-position elements have no offsetParent, so the page tells us whether the phone is showing
      if (!this.visible) { if (this.onToast) this.onToast(m); return; }
      const b = this.$('.fm-banner');
      this.$('.fm-bfrom').textContent = m.from;
      this.$('.fm-bsub').textContent = m.subject;
      b.hidden = false; b.classList.remove('out'); void b.offsetWidth; b.classList.add('in');
      clearTimeout(this._bt);
      this._bt = setTimeout(() => { b.classList.add('out'); setTimeout(() => { b.hidden = true; }, 350); }, 4000);
    },
    snack(text) {
      const s = this.$('.fm-snack'); s.textContent = text; s.hidden = false;
      clearTimeout(this._st); this._st = setTimeout(() => { s.hidden = true; }, 2200);
    },
    setStatus(time, battery, charging) {
      if (!this.root) return;
      this.$('.fm-time').textContent = time;
      this.$('.fm-pct').textContent = `${Math.round(battery)}%${charging ? ' ⚡' : ''}`;
      const lvl = this.$('.fm-batt-lvl');
      lvl.style.width = `${Math.max(4, battery)}%`;
      lvl.style.background = battery < 20 && !charging ? '#e5356b' : charging ? '#1f9d55' : '#10131a';
    },
    render() {
      if (!this.root) return;
      this.dirty = false;
      this.root.querySelectorAll('.fm-tab').forEach((b) => {
        const k = b.dataset.tab; const n = this.unread(k);
        b.setAttribute('aria-selected', String(k === this.tab));
        b.querySelector('b').textContent = n ? (n > 99 ? '99+' : n) : '';
      });
      const list = this.$('.fm-list'); list.innerHTML = '';
      const shown = this.mails.filter((m) => m.category === this.tab);
      if (!shown.length) {
        const e = document.createElement('div'); e.className = 'fm-empty';
        e.textContent = this.tab === 'primary' ? 'No replies yet. Most companies never write back.' : 'Nothing here yet.';
        list.appendChild(e);
      }
      for (const m of shown.slice(0, 40)) {
        const row = document.createElement('div');
        row.className = 'fm-row' + (m.unread ? ' unread' : '') + (m.kind ? ' k-' + m.kind : ''); row.setAttribute('role', 'listitem'); row.tabIndex = 0;
        row.innerHTML = '<span class="fm-av"></span><div class="fm-mid"><div class="fm-top"><span class="fm-from"></span><span class="fm-when"></span></div><div class="fm-subj"></div><div class="fm-snip"></div></div><button class="fm-star" type="button" aria-label="Star">☆</button>';
        const av = row.querySelector('.fm-av'); av.textContent = m.from[0].toUpperCase(); av.style.background = colorFor(m.from);
        row.querySelector('.fm-from').textContent = m.from;
        row.querySelector('.fm-when').textContent = m.time;
        row.querySelector('.fm-subj').textContent = m.subject;
        row.querySelector('.fm-snip').textContent = m.body.replace(/\n+/g, ' ');
        const star = row.querySelector('.fm-star');
        if (m.starred) { star.textContent = '★'; star.classList.add('on'); }
        star.addEventListener('click', (ev) => { ev.stopPropagation(); m.starred = !m.starred; this.render(); if (m.starred) this.snack('Starred. It will not help.'); });
        const open = () => { m.unread = false; this.openId = m.id; this.render(); };
        row.addEventListener('click', open);
        row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(); });
        list.appendChild(row);
      }
      const d = this.mails.find((m) => m.id === this.openId);
      this.$('.fm-list-view').hidden = !!d; this.$('.fm-detail').hidden = !d;
      if (d) {
        this.$('.fm-dlabel').textContent = TABS.find((t) => t[0] === d.category)[1];
        this.$('.fm-dsub').textContent = d.subject;
        const av = this.$('.fm-dav'); av.textContent = d.from[0].toUpperCase(); av.style.background = colorFor(d.from);
        this.$('.fm-dfrom').textContent = `${d.from} <${d.address || 'no-reply@' + d.from.toLowerCase().replace(/[^a-z]/g, '') + '.jobs'}>`;
        this.$('.fm-dtime').textContent = d.time;
        const body = this.$('.fm-dbody'); body.innerHTML = '';
        for (const p of d.body.split('\n')) { const el = document.createElement('p'); el.textContent = p; body.appendChild(el); }
      }
    },
  };
  window.FlyMail = FlyMail;
})();
