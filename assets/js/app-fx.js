/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — app-fx.js (v3 — lightweight motion engine)
   Zero canvas, zero WebGL, zero per-mousemove work.
   Only rAF-throttled scroll + one-shot IntersectionObservers:
   loader · spring reveals · word blur-up · sticky stack
   · weekly circuit lap (one-shot) · segmented progress
   · full-screen menu · VIP crypto gate · Tehran clock
   Runs smooth on the weakest school computers.
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {
  const { $, $$, faNum, esc, sanitizeUrl, loadData, renderAll, initEvents, state } = window.SSB;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ════════════ loader (Lumora × KIMI veil) ════════════ */
  const loaderDone = (function () {
    let resolveFn;
    const promise = new Promise(res => { resolveFn = res; });
    const pre = document.getElementById('loader');
    const count = document.getElementById('loader-count');
    const meter = document.getElementById('loader-meter');
    const t0 = Date.now();
    const MIN = REDUCED ? 150 : 1500;
    const MAX = 4200;

    let p = 0, shown = 0, finished = false;
    const tick = setInterval(() => {
      p = Math.min(p + Math.random() * 7 + 2, 96);
      shown = p;
      render();
    }, 90);

    function render() {
      const v = Math.round(shown);
      count.textContent = faNum(String(v).padStart(3, '0'));
      meter.style.width = v + '%';
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      const wait = Math.max(0, MIN - (Date.now() - t0));
      setTimeout(() => {
        p = 100; shown = 100; render();
        setTimeout(() => {
          pre.classList.add('done');
          document.body.classList.add('ready');
          setTimeout(() => pre.remove(), 1000);
          resolveFn();
        }, 260);
      }, wait);
    }

    // gate: fonts + data (with safety timeout)
    Promise.race([
      Promise.allSettled([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        window.__ssbData
      ]),
      new Promise(res => setTimeout(res, MAX))
    ]).then(finish);
    render();
    return promise;
  })();

  /* ════════════ Tehran live clock ════════════ */
  function initClock() {
    const el = document.getElementById('clock-time');
    const mo = document.getElementById('mo-date');
    const update = () => {
      el.textContent = window.SSB.tehranClock(new Date());
      if (mo) mo.textContent = window.SSB.faDateLong(new Date());
    };
    update();
    setInterval(update, 10000);
  }

  /* ════════════ segmented scroll progress ════════════ */
  function initProgress() {
    const segs = $$('#progress-bar i');
    let raf = null;
    const anchors = () => {
      const ids = ['home', 'homework', 'chat', 'ai', 'about'];
      const tops = ids.map(id => {
        const el = document.getElementById(id);
        return el ? el.offsetTop : 0;
      });
      const doc = document.documentElement;
      tops.push(doc.scrollHeight - window.innerHeight);
      return tops;
    };
    const update = () => {
      raf = null;
      const tops = anchors();
      const y = window.scrollY;
      segs.forEach((s, i) => {
        const a = tops[i], b = tops[i + 1] || (a + 1);
        const f = Math.max(0, Math.min(1, (y - a) / Math.max(1, b - a)));
        s.style.setProperty('--seg', f.toFixed(3));
      });
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ════════════ hero emblem ring text (per-glyph, works in every engine) ════════════ */
  function initEmblem() {
    const svg = document.getElementById('emb-ring-text');
    if (!svg || svg.childNodes.length) return;
    const str = 'SALAM SADR BOYS \u2726 GRADE 7 \u2726 GRADE 8 \u2726 GRADE 9 \u2726 ';
    const n = str.length;
    let html = '';
    for (let i = 0; i < n; i++) {
      const ch = str[i] === ' ' ? '' : str[i];
      html += '<text x="100" y="27" text-anchor="middle" transform="rotate(' + (360 / n * i).toFixed(2) + ' 100 100)">' + ch + '</text>';
    }
    svg.innerHTML = html;
  }

  /* ════════════ spring reveals ════════════ */
  function initSprings() {
    const els = $$('[data-spring]');
    if (REDUCED) { els.forEach(el => el.classList.add('sprung')); return; }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (el.dataset.delay) el.style.setProperty('--dly', el.dataset.delay + 'ms');
        el.classList.add('sprung');
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    els.forEach(el => obs.observe(el));
  }

  /* ════════════ word/letter split + blur-up ════════════ */
  function splitAll(root) {
    $$('[data-split]', root || document).forEach(el => {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = '1';
      const mode = el.getAttribute('data-split');
      const txt = el.textContent.trim();
      el.textContent = '';
      const parts = mode === 'latin' ? Array.from(txt) : txt.split(/\s+/);
      parts.forEach((p, i) => {
        let node;
        if (mode !== 'latin' && p.includes('صدر')) {
          node = document.createElement('em');
          node.className = 'ht-mark';
          node.textContent = p;
        } else {
          node = document.createElement('span');
          node.textContent = p;
        }
        node.className += ' w';
        node.style.setProperty('--wd', (i * (mode === 'latin' ? 26 : 65)) + 'ms');
        el.appendChild(node);
        if (mode !== 'latin') el.appendChild(document.createTextNode(' '));
      });
    });
  }

  function initSplitReveals(root) {
    splitAll(root);
    const els = $$('[data-split]', root || document).filter(el => !el.dataset.splitObs);
    els.forEach(el => el.dataset.splitObs = '1');
    if (REDUCED) { els.forEach(el => el.classList.add('split-on')); return; }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('split-on');
        obs.unobserve(en.target);
      });
    }, { threshold: 0.3 });
    els.forEach(el => obs.observe(el));
  }

  /* assemble Persian dates word-by-word */
  function initAssemble(root) {
    $$('[data-assemble]', root || document).forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      const txt = el.getAttribute('data-assemble');
      el.setAttribute('data-split', 'words');
      el.textContent = txt;
    });
    splitAll(root);
    const els = $$('[data-assemble][data-split]', root || document).filter(el => !el.dataset.splitObs);
    els.forEach(el => {
      el.dataset.splitObs = '1';
      if (REDUCED) { el.classList.add('split-on'); return; }
      const obs = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          en.target.classList.add('split-on');
          obs.unobserve(en.target);
        });
      }, { threshold: 0.5 });
      obs.observe(el);
    });
  }

  /* ════════════ counters ════════════ */
  function initCounters() {
    const els = $$('.count');
    if (!els.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        obs.unobserve(el);
        const target = +el.dataset.count || 0;
        if (REDUCED || target === 0) { el.textContent = faNum(target); return; }
        const t0 = performance.now(), dur = 1100;
        const step = now => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = faNum(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach(el => obs.observe(el));
  }

  /* ════════════ cinema slides (scroll-driven) ════════════ */
  function initCinema() {
    const strip = document.getElementById('cinema');
    const slides = $$('.cslide', strip);
    if (!strip || !slides.length) return;
    let raf = null;
    const update = () => {
      raf = null;
      const rect = strip.getBoundingClientRect();
      const total = rect.height - innerHeight;
      const p = Math.max(0, Math.min(1, -rect.top / Math.max(1, total)));
      const idx = Math.min(slides.length - 1, Math.floor(p * slides.length));
      slides.forEach((s, i) => {
        const on = i === idx;
        const passed = i < idx;
        s.classList.toggle('is-on', on);
        s.classList.toggle('is-out', passed);
        if (on) s.classList.add('split-on'); // retrigger words if not yet
      });
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ════════════ sticky stack: covered panel recedes (KIMI) ════════════ */
  function initStack() {
    const panels = $$('.stack .panel');
    if (panels.length < 2) return;
    let raf = null;
    const update = () => {
      raf = null;
      const vh = innerHeight;
      for (let i = 0; i < panels.length - 1; i++) {
        const next = panels[i + 1].getBoundingClientRect();
        const p = Math.max(0, Math.min(1, 1 - next.top / vh));
        const el = panels[i];
        if (p <= 0) { el.style.transform = ''; el.style.filter = ''; continue; }
        const e = p * p * (3 - 2 * p); // smoothstep
        el.style.transform = `scale(${(1 - 0.09 * e).toFixed(4)})`;
        el.style.filter = `brightness(${(1 - 0.42 * e).toFixed(3)})`;
        el.style.transformOrigin = 'top center';
      }
      // checker seam on first panel
      const first = panels[0];
      const seam = first.querySelector('.checker-seam');
      if (seam) {
        const r = first.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.6)));
        seam.style.setProperty('--seam-s', (1 - 0.25 * p).toFixed(3));
        seam.style.opacity = (0.9 * (1 - p * 0.5)).toFixed(3);
      }
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ════════════ weekly circuit lap (KIMI) ════════════ */
  function initCircuit() {
    const box = document.getElementById('circuit-box');
    const track = document.getElementById('circuit-track');
    const base = document.getElementById('circuit-base');
    const head = document.getElementById('circuit-head');
    const glow = document.getElementById('circuit-head-glow');
    const hint = document.querySelector('.circuit-hint');
    if (!box || !track || !base || typeof base.getTotalLength !== 'function') return;

    const L = base.getTotalLength();
    track.style.strokeDasharray = String(L);
    track.style.strokeDashoffset = String(L);
    const fr = [0.035, 0.21, 0.40, 0.575, 0.765, 0.94];

    const run = () => {
      if (REDUCED) {
        track.style.strokeDashoffset = '0';
        $$('.day-marker').forEach(m => m.classList.add('lit'));
        if (hint) hint.classList.add('off');
        return;
      }
      const DUR = 6000;
      const t0 = performance.now();
      const litSet = new Set();
      const ease = t => 0.5 - 0.5 * Math.cos(Math.PI * t); // gentle braking feel
      function step(now) {
        const p = Math.min(1, (now - t0) / DUR);
        const e = ease(p);
        track.style.strokeDashoffset = String(L * (1 - e));
        const pt = base.getPointAtLength(L * e);
        head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
        glow.setAttribute('cx', pt.x); glow.setAttribute('cy', pt.y);
        head.style.opacity = glow.style.opacity = p < 1 ? '1' : '0';
        fr.forEach((f, i) => {
          if (e >= f && !litSet.has(i)) {
            litSet.add(i);
            const m = document.querySelector(`.day-marker[data-day="${i}"]`);
            if (m) m.classList.add('lit');
          }
        });
        if (p < 1) requestAnimationFrame(step);
        else if (hint) hint.classList.add('off');
        // v3: no idle spin loop — the lap runs once and stops. CPU idles at 0%.
      }
      requestAnimationFrame(step);
    };

    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        obs.disconnect();
        setTimeout(run, 350);
      });
    }, { threshold: 0.45 });
    obs.observe(box);

    /* reticle (desktop) */
    if (FINE) {
      const rv = box.querySelector('.rv'), rh = box.querySelector('.rh'), rc = box.querySelector('.rc');
      box.addEventListener('mousemove', e => {
        const r = box.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        rv.style.left = x + 'px'; rh.style.top = y + 'px';
        rc.style.left = x + 'px'; rc.style.top = y + 'px';
      }, { passive: true });
    }
  }

  /* ════════════ menu overlay ════════════ */
  function initMenu() {
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu-overlay');
    const set = open => {
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', !open);
      btn.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        splitAll(menu);
        $$('.mo-nav b', menu).forEach((el, i) => {
          el.style.transitionDelay = (0.18 + i * 0.07) + 's';
          el.classList.add('split-on');
        });
      } else {
        $$('.mo-nav b', menu).forEach(el => {
          el.classList.remove('split-on');
          el.style.transitionDelay = '0s';
        });
      }
    };
    btn.addEventListener('click', () => set(!menu.classList.contains('open')));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) set(false); });
  }

  /* ════════════ nav state ════════════ */
  function initNav() {
    const nav = document.getElementById('site-nav');
    const links = $$('.nav-links a');
    const bnItems = $$('.bn-item');
    let raf = null;
    const onScroll = () => {
      raf = null;
      nav.classList.toggle('scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(onScroll); }, { passive: true });
    onScroll();
    const map = { home: 'home', homework: 'homework', 'schedule-sec': 'schedule-sec', announcements: 'announcements', subjects: 'subjects', chat: 'chat', ai: 'ai', vip: 'vip', about: 'about', contact: 'about' };
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const id = map[en.target.id] || en.target.id;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
        bnItems.forEach(a => a.classList.toggle('is-active', a.dataset.bn === id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['home', 'homework', 'schedule-sec', 'announcements', 'subjects', 'chat', 'ai', 'vip', 'about', 'contact'].forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  /* ════════════ toast ════════════ */
  let toastT = null;
  function toast(msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 350); }, ms || 3200);
  }

  /* ════════════ VIP crypto gate (unchanged contract) ════════════ */
  const VIP = (() => {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const hexToBuf = hex => new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const bufToHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    function ctEqual(a, b) {
      if (a.length !== b.length) return false;
      let r = 0;
      for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return r === 0;
    }
    async function deriveBits(password, saltHex, iterations) {
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBuf(saltHex), iterations }, key, 256);
    }
    async function verify(password, vip) {
      const bits = await deriveBits(password, vip.salt, vip.iterations || 150000);
      return ctEqual(bufToHex(bits), (vip.hash || '').toLowerCase());
    }
    async function deriveKey(password, saltHex, iterations) {
      const bits = await deriveBits(password, saltHex, iterations);
      return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt', 'encrypt']);
    }
    async function openVault(password, vip) {
      if (!(vip && vip.enc && vip.enc.iv && vip.enc.data)) {
        return { ok: true, empty: true, links: [] };
      }
      const key = await deriveKey(password, vip.salt, vip.iterations || 150000);
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBuf(vip.enc.iv) },
        key,
        hexToBuf(vip.enc.data)
      );
      return { ok: true, links: JSON.parse(dec.decode(plain)), key };
    }
    function remember(key) {
      try { sessionStorage.setItem('ssb_vip_key', JSON.stringify(Array.from(new Uint8Array(key)))); } catch (e) { }
    }
    async function recall(vip) {
      try {
        const raw = sessionStorage.getItem('ssb_vip_key');
        if (!raw) return null;
        const bytes = new Uint8Array(JSON.parse(raw));
        const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBuf(vip.enc.iv) }, key, hexToBuf(vip.enc.data));
        return { links: JSON.parse(dec.decode(plain)), key };
      } catch (e) { sessionStorage.removeItem('ssb_vip_key'); return null; }
    }
    return { verify, openVault, remember, recall };
  })();

  function renderVipLinks(links) {
    const box = document.getElementById('vip-links');
    if (!links || !links.length) {
      box.innerHTML = '<div class="vip-hello">فعلاً چیزی این‌جا نیست — به‌زودی سورپرایزهای ویژه اضافه می‌شه!</div>';
      return;
    }
    box.innerHTML = links.map(l => {
      const url = sanitizeUrl(l.url);
      if (!url) return '';
      return `<a class="vip-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
        <b>${esc(l.title)}</b>
        ${l.note ? `<span>${esc(l.note)}</span>` : ''}
        <i><svg viewBox="0 0 24 24"><path d="M15 5h4v4M19 5l-7 7"/><path d="M17 13v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H11"/></svg>مشاهده</i>
      </a>`;
    }).join('');
  }

  function initVip() {
    const modal = document.getElementById('vip-modal');
    const openBtn = document.getElementById('vip-open');
    const lockBtn = document.getElementById('vip-lock-btn');
    const form = document.getElementById('vip-form');
    const pass = document.getElementById('vip-pass');
    const msg = document.getElementById('vip-msg');
    const locked = document.getElementById('vip-locked');
    const unlocked = document.getElementById('vip-unlocked');
    const submit = document.getElementById('vip-submit');
    if (!openBtn) return;
    const data = state.data;
    const vip = data.vip || {};
    let attempts = 0, waitUntil = 0;

    if (!vip.enabled) {
      document.getElementById('vip-desc').textContent = 'بخش ویژه به‌زودی با سورپرایزهای صدر باز می‌شه — حواست به اعلان‌ها باشه!';
      openBtn.textContent = 'فعلاً بسته‌ست!';
      openBtn.addEventListener('click', () => toast('بخش ویژه هنوز باز نشده — به‌زودی!'));
      return;
    }

    const showUnlocked = links => {
      locked.hidden = true;
      unlocked.hidden = false;
      renderVipLinks(links);
    };

    VIP.recall(vip).then(r => { if (r) showUnlocked(r.links); }).catch(() => { });

    openBtn.addEventListener('click', () => {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(() => pass.focus(), 60);
    });
    $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeModal));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
    function closeModal() {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      msg.hidden = true;
    }

    lockBtn.addEventListener('click', () => {
      sessionStorage.removeItem('ssb_vip_key');
      unlocked.hidden = true;
      locked.hidden = false;
      toast('بخش ویژه قفل شد. می‌بینمت!');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.hidden = true;
      const val = pass.value;
      if (!val) return;
      if (Date.now() < waitUntil) {
        const s = Math.ceil((waitUntil - Date.now()) / 1000);
        showMsg('err', 'یه کم عجله کردی! ' + faNum(s) + ' ثانیه صبر کن و دوباره امتحان کن.');
        return;
      }
      submit.disabled = true;
      submit.textContent = 'در حال بررسی…';
      try {
        const ok = await VIP.verify(val, vip);
        if (!ok) {
          attempts++;
          if (attempts >= 4) {
            waitUntil = Date.now() + 45000;
            attempts = 0;
            showMsg('err', 'چند بار اشتباه شد! یه جای امن بشین، ۴۵ ثانیه فکر کن و برگرد. راستی، رمز رو از مدیر بگیر.');
          } else {
            showMsg('err', 'رمز درست نیست! شاید یه حرفش از قلم افتاد — دوباره امتحان کن، یا برو از مدیر بپرس، شاید با یه بستنی راضیت کرد.');
          }
          pass.value = '';
          pass.focus();
          return;
        }
        const vault = await VIP.openVault(val, vip);
        if (vault.key) VIP.remember(vault.key);
        showUnlocked(vault.links);
        closeModal();
        toast('خوش اومدی! بخش ویژه باز شد.');
      } catch (err) {
        showMsg('err', 'رمز درست نیست یا داده‌ی ویژه در دسترس نیست. دوباره امتحان کن.');
      } finally {
        submit.disabled = false;
        submit.textContent = 'ورود';
      }
    });

    function showMsg(kind, text) {
      msg.className = 'vip-msg ' + kind;
      msg.textContent = text;
      msg.hidden = false;
    }
  }

  /* ════════════ boot ════════════ */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('load', () => window.scrollTo(0, 0));

  async function boot() {
    window.scrollTo(0, 0);
    initClock();
    const dataPromise = loadData()
      .catch(err => {
        console.error('SSB data error:', err);
        const hw = document.getElementById('hw-list');
        if (hw) hw.innerHTML =
          '<div class="empty"><b>مخاطب عزیز، داده‌ها الان در دسترس نیستن.</b><span>اتصال اینترنتت رو چک کن و صفحه رو رفرش کن.</span></div>';
        return null;
      });
    window.__ssbData = dataPromise;

    const data = await dataPromise;
    if (data) {
      renderAll();
      initVip();
    }
    initEvents();

    await loaderDone;               // cinematic veil lifts first
    initEmblem();
    initSprings();
    initSplitReveals();
    initAssemble();
    initCounters();
    initCinema();
    initStack();
    initCircuit();
    initProgress();
    initNav();
    initMenu();
    // v3: canvas shader, double-ring cursor, magnetic buttons, ripples
    // and mouse parallax are gone — the site now runs pure CSS + rAF-throttled
    // scroll only, so even the weakest computer stays at 60fps with no lag.
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SSB.ui = { toast };
})();
