/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — app-theme.js (v4)
   Theme toggle (dark/light, persisted) · meta theme-color
   · eased anchor scrolling · spotlight cursor tracking.
   All work is rAF-throttled; zero layout thrash.
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {

  /* ════════════ theme toggle ════════════ */
  const root = document.documentElement;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const META = document.querySelector('meta[name="theme-color"]');

  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncMeta() {
    if (META) META.setAttribute('content', currentTheme() === 'dark' ? '#0D0B08' : '#F2EDE0');
  }

  function setTheme(t, animate) {
    if (t === currentTheme()) return;
    if (animate && !REDUCED) {
      root.classList.add('theming');
      setTimeout(() => root.classList.remove('theming'), 520);
    }
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('ssb-theme', t); } catch (e) {}
    syncMeta();
  }

  function bindToggle(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    });
  }

  bindToggle('theme-btn');
  bindToggle('theme-btn-m');
  syncMeta();

  /* follow OS-level change while user has no explicit choice */
  let explicit = false;
  try { explicit = !!localStorage.getItem('ssb-theme'); } catch (e) {}
  if (!explicit && window.matchMedia) {
    try {
      const mq = matchMedia('(prefers-color-scheme: light)');
      const onOS = e => setTheme(e.matches ? 'light' : 'dark', true);
      if (mq.addEventListener) mq.addEventListener('change', onOS);
      else if (mq.addListener) mq.addListener(onOS);
    } catch (e) {}
  }

  /* ════════════ eased anchor scrolling ════════════ */
  function easeInOutQuart(t) {
    return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  function scrollToY(targetY, dur) {
    if (REDUCED) { window.scrollTo(0, targetY); return; }
    const startY = window.scrollY;
    const delta = targetY - startY;
    if (Math.abs(delta) < 2) return;
    const t0 = performance.now();
    dur = dur || Math.min(1100, Math.max(450, Math.abs(delta) * .45));
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, startY + delta * easeInOutQuart(p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = (a.getAttribute('href') || '').slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const y = id === 'home' ? 0 : el.getBoundingClientRect().top + window.scrollY - 58;
    scrollToY(Math.max(0, y));
    try { history.replaceState(null, '', '#' + id); } catch (err) {}
  }, { passive: false });

  /* ════════════ spotlight tracking (one delegated, rAF-throttled listener) ════════════ */
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches && !REDUCED) {
    const SPOT = '.hw-card,.sub-card,.cc,.stat,.vip-link,.croom';
    let last = null, queued = null;
    document.addEventListener('mousemove', e => {
      queued = e;
      if (queued._r) return;
      queued._r = requestAnimationFrame(() => {
        queued._r = null;
        const ev = queued;
        const card = ev.target && ev.target.closest ? ev.target.closest(SPOT) : null;
        if (card !== last) {
          if (last) { last.style.removeProperty('--sx'); last.style.removeProperty('--sy'); }
          last = card;
        }
        if (card) {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--sx', (ev.clientX - r.left).toFixed(1) + 'px');
          card.style.setProperty('--sy', (ev.clientY - r.top).toFixed(1) + 'px');
        }
      });
    }, { passive: true });
  }

})();
