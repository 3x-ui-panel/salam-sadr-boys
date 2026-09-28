/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — app-ui.js
   Motion engine · VIP crypto gate · interactions
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {
  const { $, $$, faNum, esc, sanitizeUrl, loadData, renderAll, initEvents, state } = window.SSB;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── preloader ── */
  function initPreloader() {
    const pre = document.getElementById('preloader');
    const minWait = REDUCED ? 100 : 1500;
    const t0 = Date.now();
    const hide = () => {
      const wait = Math.max(0, minWait - (Date.now() - t0));
      setTimeout(() => {
        pre.classList.add('done');
        setTimeout(() => pre.remove(), 900);
        document.body.classList.add('ready');
      }, wait);
    };
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
    setTimeout(hide, 3800); // safety
  }

  /* ── scroll progress ── */
  function initProgress() {
    const bar = document.getElementById('progress-bar');
    let raf = null;
    const update = () => {
      raf = null;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  /* ── nav state + active section ── */
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

    const map = { home: 'home', homework: 'homework', subjects: 'subjects', announcements: 'announcements', vip: 'vip', about: 'about', contact: 'about' };
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const id = map[en.target.id] || en.target.id;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
        bnItems.forEach(a => a.classList.toggle('is-active', a.dataset.bn === id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['home', 'homework', 'subjects', 'announcements', 'vip', 'about', 'contact'].forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  /* ── mobile menu ── */
  function initMobileMenu() {
    const burger = document.getElementById('burger');
    const menu = document.getElementById('mobile-menu');
    const set = open => {
      burger.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', !open);
      burger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => set(!menu.classList.contains('open')));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    window.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  /* ── reveal engine ── */
  function initReveals() {
    const els = $$('[data-reveal]');
    if (REDUCED) {
      els.forEach(el => {
        el.style.opacity = 1; el.style.transform = 'none';
        el.classList.add('revealed');
      });
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const dly = el.dataset.delay;
        if (dly) el.style.setProperty('--dly', dly + 'ms');
        el.classList.add('revealed');
        obs.unobserve(el);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => obs.observe(el));
  }

  /* ── hero parallax + tilt ── */
  function initParallax() {
    if (REDUCED || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const art = $('.hero-art');
    const crest = document.getElementById('hero-crest');
    const blobs = $$('.blob');
    if (!art) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    window.addEventListener('mousemove', e => {
      const nx = (e.clientX / window.innerWidth - 0.5);
      const ny = (e.clientY / window.innerHeight - 0.5);
      tx = nx; ty = ny;
      if (!raf) loop();
    }, { passive: true });
    function loop() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      if (crest) crest.style.translate = (cx * -18) + 'px ' + (cy * -14) + 'px';
      art.style.rotate = (cx * 1.6) + 'deg';
      blobs.forEach((b, i) => { b.style.translate = (cx * (14 + i * 8)) + 'px ' + (cy * (12 + i * 6)) + 'px'; });
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
      else raf = null;
    }
  }

  /* ── magnetic buttons + ripple ── */
  function initButtons() {
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    $$('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = 'translate(' + (x * 0.18) + 'px,' + (y * 0.22 - 2) + 'px)';
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }
  function initRipple() {
    $$('.btn').forEach(btn => {
      btn.addEventListener('click', e => {
        if (REDUCED) return;
        const r = btn.getBoundingClientRect();
        const d = Math.max(r.width, r.height);
        const sp = document.createElement('span');
        sp.className = 'ripple';
        sp.style.width = sp.style.height = d + 'px';
        sp.style.left = (e.clientX - r.left - d / 2) + 'px';
        sp.style.top = (e.clientY - r.top - d / 2) + 'px';
        btn.appendChild(sp);
        setTimeout(() => sp.remove(), 650);
      });
    });
  }

  /* ── custom cursor ── */
  function initCursor() {
    if (REDUCED || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    const cur = document.getElementById('cursor');
    let x = -100, y = -100, tx = x, ty = y, raf = null;
    window.addEventListener('mousemove', e => {
      tx = e.clientX; ty = e.clientY;
      cur.classList.add('on');
      if (!raf) loop();
    }, { passive: true });
    document.addEventListener('mouseover', e => {
      cur.classList.toggle('big', !!e.target.closest('a,button,[role="button"],input,select,textarea'));
    });
    function loop() {
      x += (tx - x) * 0.2; y += (ty - y) * 0.2;
      cur.style.transform = 'translate(' + (x - 7) + 'px,' + (y - 7) + 'px)';
      if (cur.classList.contains('big')) cur.style.transform = 'translate(' + (x - 22) + 'px,' + (y - 22) + 'px)';
      raf = requestAnimationFrame(loop);
    }
  }

  /* ── counters ── */
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

  /* ── toast ── */
  let toastT = null;
  function toast(msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 350); }, ms || 3200);
  }

  /* ── VIP: crypto gate ── */
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

    // session restore
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

  /* ── boot ── */
  async function boot() {
    initPreloader();
    try {
      await loadData();
    } catch (err) {
      console.error('SSB data error:', err);
      document.getElementById('hw-list').innerHTML =
        '<div class="empty"><b>مخاطب عزیز، داده‌ها الان در دسترس نیستن.</b><span>اتصال اینترنتت رو چک کن و صفحه رو رفرش کن.</span></div>';
    }
    if (state.data) {
      renderAll();
      initVip();
      initCounters();
    }
    initEvents();
    initProgress();
    initNav();
    initMobileMenu();
    initReveals();
    initParallax();
    initButtons();
    initRipple();
    initCursor();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SSB.ui = { toast };
})();
