/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — panel app-core.js
   utils · crypto · draft storage · GitHub publish
   ═══════════════════════════════════════════════════════ */
'use strict';

window.PANEL = (function () {

  /* ── utils ── */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const faNum = v => String(v).replace(/[0-9]/g, d => FA[+d]);
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() {
    try { return crypto.randomUUID(); }
    catch (e) { return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  }
  function sanitizeUrl(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s;
    return '';
  }

  /* ── crypto ── */
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const hexToBuf = hex => new Uint8Array(String(hex).match(/.{2}/g).map(b => parseInt(b, 16)));
  const bufToHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const randomSalt = () => bufToHex(crypto.getRandomValues(new Uint8Array(16)));
  function ctEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }
  async function pbkdf2Hex(password, saltHex, iterations) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBuf(saltHex), iterations },
      key, 256
    );
    return bufToHex(bits);
  }
  async function deriveAesKey(password, saltHex, iterations) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBuf(saltHex), iterations }, key, 256
    );
    return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function encryptLinks(links, password) {
    const salt = randomSalt();
    const iterations = 150000;
    const key = await deriveAesKey(password, salt, iterations);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(links)));
    return { salt, iterations, hash: null, enc: { iv: bufToHex(iv), data: bufToHex(cipher) } };
  }

  /* ── storage ── */
  const DRAFT_KEY = 'ssb_draft';
  const TOKEN_KEY = 'ssb_gh_token';
  const REPO_KEY = 'ssb_repo_cfg';
  const LOCK_KEY = 'ssb_panel_lock';
  const SESSION_KEY = 'ssb_panel_session';

  const store = {
    getToken: () => localStorage.getItem(TOKEN_KEY) || '',
    setToken: t => t ? localStorage.setItem(TOKEN_KEY, t.trim()) : localStorage.removeItem(TOKEN_KEY),
    getRepoCfg() {
      try { return JSON.parse(localStorage.getItem(REPO_KEY)) || {}; } catch (e) { return {}; }
    },
    setRepoCfg(c) { localStorage.setItem(REPO_KEY, JSON.stringify(c || {})); },
    getLock() {
      try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; }
    },
    setLock(l) { localStorage.setItem(LOCK_KEY, JSON.stringify(l || { n: 0, until: 0 })); },
    setSession() { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp: Date.now() + 45 * 60 * 1000 })); },
    hasSession() {
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        return s && s.exp > Date.now();
      } catch (e) { return false; }
    },
    clearSession() { sessionStorage.removeItem(SESSION_KEY); },
    getDraft() {
      try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { return null; }
    },
    setDraft(d) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); },
    clearDraft() { localStorage.removeItem(DRAFT_KEY); },
    getPreview() {
      try { return JSON.parse(localStorage.getItem('ssb_preview')); } catch (e) { return null; }
    },
    setPreview(d) { localStorage.setItem('ssb_preview', JSON.stringify(d)); },
    clearPreview() { localStorage.removeItem('ssb_preview'); }
  };

  /* ── data ── */
  let draft = null;
  let published = null; // last fetched published copy (for diff/updatedAt)

  async function loadInitial() {
    const local = store.getDraft();
    const res = await fetch('../data/data.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('خواندن داده‌ی سایت ممکن نشد (HTTP ' + res.status + ')');
    published = await res.json();
    const localT = local && local.updatedAt ? Date.parse(local.updatedAt) : 0;
    const pubT = published && published.updatedAt ? Date.parse(published.updatedAt) : 0;
    if (local && local.version && localT >= pubT) {
      draft = local;
    } else {
      draft = JSON.parse(JSON.stringify(published));
      store.setDraft(draft);
    }
    return draft;
  }
  function saveDraft() {
    draft.updatedAt = new Date().toISOString();
    store.setDraft(draft);
  }

  /* ── repo identity ── */
  function detectRepo() {
    const cfg = store.getRepoCfg();
    if (cfg.owner && cfg.repo) return { owner: cfg.owner, repo: cfg.repo, manual: true };
    const host = location.hostname;                 // e.g. 3x-ui-panel.github.io
    const owner = host.split('.')[0];
    const seg = location.pathname.split('/').filter(Boolean);
    const repo = (seg.length && !seg[0].endsWith('.html')) ? seg[0] : '';
    return { owner, repo, manual: false };
  }

  /* ── GitHub publish ── */
  async function gh(path, opts) {
    const token = store.getToken();
    if (!token) throw new Error('توکن گیت‌هاب ثبت نشده — از «تنظیمات و انتشار» اضافه‌اش کن.');
    const res = await fetch('https://api.github.com' + path, {
      ...opts,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...(opts && opts.headers || {})
      }
    });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.message || ''; } catch (e) { }
      if (res.status === 401) throw new Error('توکن نامعتبره یا منقضی شده (401).');
      if (res.status === 403) throw new Error('دسترسی رد شد (403) — توکن باید دسترسی repo داشته باشه.' + (detail ? ' ' + detail : ''));
      if (res.status === 404) throw new Error('مخزن یا فایل پیدا نشد (404) — آدرس owner/repo رو در تنظیمات چک کن.');
      throw new Error('خطای گیت‌هاب (' + res.status + ') ' + detail);
    }
    return res.json();
  }

  async function validateToken() {
    const u = await gh('/user');
    return u.login;
  }

  async function publish() {
    const { owner, repo } = detectRepo();
    if (!owner || !repo) throw new Error('شناسایی owner/repo ممکن نشد — در تنظیمات دستی واردش کن.');
    saveDraft();
    const json = JSON.stringify(draft, null, 2);
    const content = btoa(unescape(encodeURIComponent(json)));
    const path = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/data/data.json';
    let sha = null;
    try {
      const cur = await gh(path + '?ref=main');
      sha = cur.sha;
    } catch (e) { /* file may not exist */ }
    const body = {
      message: 'update: به‌روزرسانی داده‌ی سایت از پنل مدیریت — ' + new Date().toLocaleString('fa-IR'),
      content,
      branch: 'main'
    };
    if (sha) body.sha = sha;
    const out = await gh(path, { method: 'PUT', body: JSON.stringify(body) });
    published = JSON.parse(JSON.stringify(draft));
    store.setDraft(draft);
    return { commitUrl: out.commit && out.commit.html_url, owner, repo };
  }

  return {
    $, $$, faNum, esc, uid, sanitizeUrl,
    pbkdf2Hex, ctEqual, randomSalt, encryptLinks, deriveAesKey,
    store, loadInitial, saveDraft,
    detectRepo, gh, validateToken, publish,
    getDraft: () => draft,
    getPublished: () => published,
    isDirty() {
      const d = store.getDraft();
      return !d || JSON.stringify(d) !== JSON.stringify(draft) || draft.updatedAt !== (d.updatedAt || '');
    }
  };
})();
