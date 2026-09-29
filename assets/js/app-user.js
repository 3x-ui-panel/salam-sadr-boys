/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — app-user.js (v3)
   Accounts (register/login/logout) · Chat rooms (polling)
   · AI tutor (grades 7-9, image solving) · markdown-lite
   All server calls same-origin; every render is XSS-escaped.
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {
  if (!window.SSB) return;
  const { $, $$, esc, faNum } = window.SSB;
  const toast = (m, ms) => window.SSB.ui && window.SSB.ui.toast(m, ms);

  /* ── tiny helpers ── */
  function faTime(iso) {
    try {
      return new Intl.DateTimeFormat('fa-IR', { timeZone: window.SSB.TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch (e) { return ''; }
  }
  function faDateTime(iso) {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: window.SSB.TZ, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch (e) { return ''; }
  }
  function muteUntilFa(iso) {
    try {
      const mins = Math.max(1, Math.round((new Date(iso) - Date.now()) / 60000));
      if (mins < 60) return faNum(mins) + ' دقیقه';
      const h = Math.round(mins / 60);
      if (h < 24) return faNum(h) + ' ساعت';
      return faNum(Math.round(h / 24)) + ' روز';
    } catch (e) { return ''; }
  }

  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'ارتباط با سرور برقرار نشد.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ═══════════ state ═══════════ */
  let me = null;
  let grades = [];
  let rooms = [];
  let activeRoom = 'general';
  let activeRoomId = null;   // resolved db id of the active room
  let lastAt = null;          // chat polling cursor
  let pollT = null;
  let sending = false;
  let chatFileId = null;
  let aiFileId = null;
  let aiConvId = null;
  let aiBusy = false;
  const POLL_MS = 4000;

  const ADMINS = { MODERATOR: 1, ADMIN: 1, SUPER_ADMIN: 1, CONTENT_EDITOR: 1 };

  /* ═══════════ auth ═══════════ */
  async function loadMe() {
    try {
      const d = await api('/api/auth/me');
      me = d && d.user ? d.user : null;
    } catch (e) { me = null; }
  }

  function renderNavAuth() {
    const box = $('#nav-auth');
    if (!box) return;
    if (!me) {
      box.innerHTML = '<button type="button" class="nav-login" id="nav-login">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>' +
        'ورود / عضویت</button>';
      $('#nav-login').addEventListener('click', () => openAuth('login'));
      return;
    }
    const initial = (me.displayName || me.username || '?').trim().charAt(0);
    box.innerHTML =
      '<span class="nav-user">' +
      '<span class="nu-avatar">' + esc(initial) + '</span>' +
      '<b class="nu-name">' + esc(me.displayName) + '</b>' +
      (me.isVip ? '<i class="nu-vip">VIP</i>' : '') +
      '<button type="button" class="nu-out" id="nav-logout">خروج</button>' +
      '</span>';
    $('#nav-logout').addEventListener('click', async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { }
      me = null;
      renderNavAuth();
      updateGates();
      stopPolling();
      $('#chat-msgs').innerHTML = '';
      toast('خارج شدی. می‌بینمت!');
    });
  }

  const modal = () => $('#auth-modal');
  function openAuth(tab) {
    const m = modal();
    if (!m) return;
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
    setAuthTab(tab || 'login');
  }
  function closeAuth() {
    const m = modal();
    if (!m) return;
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
    showAuthMsg('', '');
  }
  function setAuthTab(tab) {
    const login = tab === 'login';
    $$('.atab').forEach(b => {
      const on = b.dataset.atab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    $('#login-form').hidden = !login;
    $('#register-form').hidden = login;
    showAuthMsg('', '');
  }
  function showAuthMsg(text, kind) {
    const el = $('#auth-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'vip-msg' + (kind ? ' ' + kind : '');
    el.hidden = !text;
  }

  async function loadGrades() {
    if (grades.length) return;
    try {
      const d = await api('/api/grades');
      grades = (d.items || []);
      const sel = $('#rg-grade');
      sel.innerHTML = '<option value="">انتخاب کن…</option>' +
        grades.map(g => '<option value="' + esc(g.id) + '">پایه‌ی ' + esc(g.shortName || g.name) + '</option>').join('');
    } catch (e) { /* offline-safe; register still possible without grade */ }
  }

  function wireAuth() {
    $$('[data-aclose]').forEach(el => el.addEventListener('click', closeAuth));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && modal() && !modal().hidden) closeAuth(); });
    $$('.atab').forEach(b => b.addEventListener('click', () => setAuthTab(b.dataset.atab)));
    $$('[data-auth-open]').forEach(b => b.addEventListener('click', () => openAuth(b.dataset.authOpen)));

    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#li-submit');
      const username = $('#li-user').value.trim().toLowerCase();
      const password = $('#li-pass').value;
      if (!username || !password) return;
      btn.disabled = true; btn.textContent = 'در حال ورود…';
      try {
        const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        me = d.user;
        closeAuth();
        renderNavAuth();
        updateGates();
        toast('خوش برگشتی ' + me.displayName + '!');
      } catch (err) {
        showAuthMsg(err.message, 'err');
      } finally {
        btn.disabled = false; btn.textContent = 'ورود';
      }
    });

    $('#register-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#rg-submit');
      const displayName = $('#rg-name').value.trim();
      const username = $('#rg-user').value.trim().toLowerCase();
      const password = $('#rg-pass').value;
      const gradeId = $('#rg-grade').value || null;
      if (!displayName || !username || !password) return;
      btn.disabled = true; btn.textContent = 'در حال ثبت‌نام…';
      try {
        const d = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ displayName, username, password, gradeId }) });
        me = d.user;
        closeAuth();
        renderNavAuth();
        updateGates();
        toast('عضو صدر شدی! خوش اومدی ' + me.displayName + '!');
      } catch (err) {
        showAuthMsg(err.message, 'err');
      } finally {
        btn.disabled = false; btn.textContent = 'عضویت';
      }
    });
  }

  function updateGates() {
    const inApp = !!me;
    const cg = $('#chat-gate'), cs = $('#chat-shell');
    const ag = $('#ai-gate'), as = $('#ai-shell');
    if (cg && cs) { cg.hidden = inApp; cs.hidden = !inApp; }
    if (ag && as) { ag.hidden = inApp; as.hidden = !inApp; }
    if (inApp) {
      loadRooms().catch(() => { });
      if (!$('#ai-msgs').dataset.hello) aiHello();
    } else {
      stopPolling();
    }
  }

  /* ═══════════ chat ═══════════ */
  async function loadRooms() {
    const d = await api('/api/chat/rooms');
    rooms = d.items || [];
    const bySlug = {};
    rooms.forEach(r => bySlug[r.slug] = r);
    $$('.croom').forEach(btn => {
      const slug = btn.dataset.room;
      const r = bySlug[slug];
      const badge = btn.querySelector('.cr-unread');
      if (badge) badge.remove();
      if (r && r.unread > 0 && slug !== activeRoom) {
        const b = document.createElement('i');
        b.className = 'cr-unread';
        b.textContent = faNum(r.unread);
        btn.appendChild(b);
      }
    });
    if (!bySlug[activeRoom]) activeRoom = rooms[0] ? rooms[0].slug : 'general';
    return bySlug;
  }

  function roomMeta(slug) {
    if (slug === 'vip') return { name: 'چت ویژه', desc: 'اتاق طلایی — باز برای همه‌ی اعضا، تگ VIP مال اعضای ویژه‌ست' };
    return { name: 'چت عمومی', desc: 'گفت‌وگوی همه‌ی بچه‌های صدر' };
  }

  async function openRoom(slug) {
    if (slug === activeRoom && activeRoomId && $('#chat-msgs').children.length) return;
    activeRoom = slug;
    $$('.croom').forEach(b => {
      const on = b.dataset.room === slug;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    const meta = roomMeta(slug);
    $('#chat-room-name').textContent = meta.name;
    $('#chat-room-desc').textContent = meta.desc;
    const box = $('#chat-msgs');
    lastAt = null;
    stopPolling();
    let rid = null;
    try {
      const bySlug = await loadRooms();
      rid = bySlug[slug] && bySlug[slug].id;
    } catch (e) { rid = null; }
    if (!rid) {
      box.innerHTML = emptyChat('گفت‌وگو الان باز نشد؛ کمی بعد دوباره امتحان کن.');
      return;
    }
    activeRoomId = rid;
    try {
      const d = await api('/api/chat/messages?roomId=' + encodeURIComponent(rid));
      const items = d.items || [];
      box.innerHTML = items.length ? '' : emptyChat('اولین پیام رو تو بفرست!');
      items.forEach(m => { box.appendChild(msgEl(m)); lastAt = m.createdAt; });
      scrollChat(true);
      startPolling();
    } catch (err) {
      box.innerHTML = emptyChat('گفت‌وگو الان باز نشد؛ کمی بعد دوباره امتحان کن.');
    }
  }

  function emptyChat(line) {
    return '<div class="chat-empty">' +
      '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/></svg>' +
      '<b>هنوز خبری نیست!</b><span>' + esc(line) + '</span></div>';
  }

  function msgEl(m) {
    const el = document.createElement('div');
    if (m.deleted) {
      el.className = 'cmsg';
      el.innerHTML = '<span class="cm-bubble cm-del">این پیام حذف شد.</span>';
      return el;
    }
    const mine = me && m.user && m.user.id === me.id;
    el.className = 'cmsg' + (mine ? ' me' : '');
    const admin = m.user && ADMINS[m.user.role];
    const who = esc((m.user && (m.user.displayName || m.user.username)) || 'ناشناس');
    let head = '<span class="cm-head"><b>' + who + '</b>';
    if (admin) head += '<i class="cm-badge admin">مدیر</i>';
    if (m.isVipUser) head += '<i class="cm-badge">VIP</i>';
    head += '</span>';

    let body = '';
    if (m.fileId) body += '<img class="cm-img" src="/api/files/' + esc(m.fileId) + '" alt="تصویر پیام" loading="lazy">';
    if (m.content) body += '<span class="cm-bubble">' + esc(m.content).replace(/\n/g, '<br>') + '<span class="cm-time">' + esc(faTime(m.createdAt)) + '</span></span>';

    el.innerHTML = head + body;
    const img = el.querySelector('.cm-img');
    if (img) img.addEventListener('click', () => lightbox(img.src));
    return el;
  }

  function appendMsgs(items) {
    if (!items.length) return 0;
    const box = $('#chat-msgs');
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
    const emptyEl = box.querySelector('.chat-empty');
    if (emptyEl) emptyEl.remove();
    items.forEach(m => { box.appendChild(msgEl(m)); if (m.createdAt) lastAt = m.createdAt; });
    if (nearBottom) scrollChat(false);
    return items.length;
  }

  function scrollChat(force) {
    const box = $('#chat-msgs');
    box.scrollTop = box.scrollHeight;
  }

  function startPolling() {
    stopPolling();
    pollT = setInterval(pollOnce, POLL_MS);
  }
  function stopPolling() { if (pollT) { clearInterval(pollT); pollT = null; } }

  async function pollOnce() {
    if (document.hidden || !me || sending || !activeRoomId) return;
    try {
      const q = '/api/chat/messages?roomId=' + encodeURIComponent(activeRoomId) + (lastAt ? '&after=' + encodeURIComponent(lastAt) : '');
      const d = await api(q);
      appendMsgs(d.items || []);
    } catch (e) { /* transient — keep polling */ }
  }

  async function uploadImage(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/media', { method: 'POST', body: fd });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d || !d.id) throw new Error((d && d.error) || 'بارگذاری عکس ناموفق بود.');
    return d.id;
  }

  function wireChat() {
    $$('.croom').forEach(b => b.addEventListener('click', () => openRoom(b.dataset.room)));

    const input = $('#chat-img-input');
    $('#chat-img-btn').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      if (!me) return openAuth('login');
      try {
        chatFileId = await uploadImage(f);
        const pv = $('#chat-img-preview');
        pv.querySelector('img').src = URL.createObjectURL(f);
        pv.hidden = false;
      } catch (err) { toast(err.message); }
    });
    $('#chat-img-x').addEventListener('click', () => {
      chatFileId = null;
      $('#chat-img-preview').hidden = true;
    });

    $('#chat-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (!me) return openAuth('login');
      const textEl = $('#chat-text');
      const content = textEl.value.trim();
      if (!content && !chatFileId) return;
      if (sending || !activeRoomId) return;
      sending = true;
      const btn = $('#chat-send');
      btn.disabled = true;
      try {
        const d = await api('/api/chat/messages', {
          method: 'POST',
          body: JSON.stringify({ roomId: activeRoomId, content, fileId: chatFileId })
        });
        textEl.value = '';
        if (chatFileId) { chatFileId = null; $('#chat-img-preview').hidden = true; }
        appendMsgs([d.item]);
        scrollChat(true);
        $('#chat-warn') && ($('#chat-warn').hidden = true);
      } catch (err) {
        if (err.data && err.data.muted) {
          toast('مدیر تا ' + (me.mutedUntil ? muteUntilFa(me.mutedUntil) : 'مدتی') + ' دیگه اجازه‌ی حرف زدن بهت نمی‌ده.');
        } else if (err.status === 401) {
          me = null; renderNavAuth(); updateGates(); openAuth('login');
        } else {
          toast(err.message);
        }
      } finally {
        sending = false;
        btn.disabled = false;
      }
    });
  }

  /* ═══════════ AI tutor ═══════════ */
  function aiHello() {
    const box = $('#ai-msgs');
    box.dataset.hello = '1';
    box.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'amsg bot';
    el.innerHTML =
      '<span class="am-role">دستیار صدر</span>' +
      '<span class="am-bubble">سلام! من دستیار درسی صدر بویزم. ' +
      'سؤال ریاضی، علوم، فارسی، عربی، انگلیسی و بقیه‌ی درس‌های هفتم، هشتم و نهم رو ازم بپرس؛ ' +
      'یا عکسِ مسئله رو بفرست تا قدم‌به‌قدم حلش کنم.</span>';
    box.appendChild(el);
  }

  // minimal, XSS-safe markdown: escape first, then a few safe transforms
  function mdLite(src) {
    let s = esc(src == null ? '' : String(src));

    // fenced code blocks
    s = s.replace(/```([\s\S]*?)```/g, (m, c) => '<pre><code>' + c.replace(/^\n/, '') + '</code></pre>');
    // inline code
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // bold
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // links [t](http…)
    s = s.replace(/\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>');

    const lines = s.split('\n');
    let out = '', list = null, table = null;

    const closeList = () => { if (list) { out += '</' + list + '>'; list = null; } };
    const closeTable = () => { if (table) { out += '</tbody></table>'; table = false; } };

    for (const raw of lines) {
      const line = raw.trimEnd();
      const t = line.trim();
      // table rows
      if (/^\|.*\|$/.test(t)) {
        const cells = t.slice(1, -1).split('|').map(c => c.trim());
        if (/^[-: |]+$/.test(t)) continue; // separator row
        if (!table) { table = true; out += '<table style="width:100%;border-collapse:collapse;margin:.4rem 0">'; out += '<tbody>'; }
        out += '<tr>' + cells.map(c => '<td style="border:1px solid rgba(250,246,237,.15);padding:.3rem .55rem">' + c + '</td>').join('') + '</tr>';
        continue;
      }
      closeTable();

      if (!t) { closeList(); continue; }
      const h = /^(#{1,4})\s+(.*)$/.exec(t);
      if (h) { closeList(); out += '<h3>' + h[2] + '</h3>'; continue; }
      if (t === '---' || t === '***') { closeList(); out += '<hr>'; continue; }
      let m;
      if ((m = /^[-*•]\s+(.*)$/.exec(t))) {
        if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; }
        out += '<li>' + m[1] + '</li>'; continue;
      }
      if ((m = /^\d+[.)]\s+(.*)$/.exec(t))) {
        if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; }
        out += '<li>' + m[1] + '</li>'; continue;
      }
      closeList();
      out += '<p>' + t + '</p>';
    }
    closeList(); closeTable();
    return out;
  }

  function aiBubble(role, html) {
    const el = document.createElement('div');
    el.className = 'amsg ' + (role === 'user' ? 'user' : 'bot');
    el.innerHTML = '<span class="am-role">' + (role === 'user' ? 'تو' : 'دستیار صدر') + '</span>' +
      '<span class="am-bubble">' + html + '</span>';
    $('#ai-msgs').appendChild(el);
    const box = $('#ai-msgs');
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function aiThinking(on) {
    const box = $('#ai-msgs');
    let t = $('#ai-wait');
    if (on && !t) {
      t = document.createElement('div');
      t.id = 'ai-wait';
      t.className = 'amsg bot';
      t.innerHTML = '<span class="am-role">دستیار صدر</span><span class="am-bubble"><span class="am-wait"><i></i><i></i><i></i></span></span>';
      box.appendChild(t);
      box.scrollTop = box.scrollHeight;
    } else if (!on && t) t.remove();
  }

  async function aiSend(text) {
    if (aiBusy) return;
    const content = (text || $('#ai-text').value).trim();
    if (!content && !aiFileId) return;
    aiBusy = true;
    $('#ai-send').disabled = true;

    // user bubble
    let userHtml = '';
    if (aiFileId) userHtml += '<img src="/api/files/' + esc(aiFileId) + '" alt="عکس مسئله">';
    if (content) userHtml += '<p>' + esc(content).replace(/\n/g, '<br>') + '</p>';
    aiBubble('user', userHtml);
    $('#ai-text').value = '';
    const sentFile = aiFileId;
    if (aiFileId) { aiFileId = null; $('#ai-img-preview').hidden = true; }

    aiThinking(true);
    try {
      const d = await api('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ content, fileId: sentFile, conversationId: aiConvId })
      });
      aiConvId = d.conversationId || aiConvId;
      aiThinking(false);
      aiBubble('bot', mdLite(d.assistantMessage ? d.assistantMessage.content : ''));
    } catch (err) {
      aiThinking(false);
      if (err.status === 401) { me = null; renderNavAuth(); updateGates(); openAuth('login'); }
      else aiBubble('bot', '<p>' + esc(err.message || 'الان نمی‌تونم جواب بدم؛ کمی بعد دوباره امتحان کن.') + '</p>');
    } finally {
      aiBusy = false;
      $('#ai-send').disabled = false;
    }
  }

  function wireAI() {
    $('#ai-form').addEventListener('submit', e => { e.preventDefault(); aiSend(); });

    const ta = $('#ai-text');
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); }
    });
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 112) + 'px';
    });

    $$('#ai-suggest button').forEach(b => b.addEventListener('click', () => {
      $('#ai-text').value = b.dataset.q;
      aiSend();
    }));

    const input = $('#ai-img-input');
    $('#ai-img-btn').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      if (!me) return openAuth('login');
      try {
        aiFileId = await uploadImage(f);
        const pv = $('#ai-img-preview');
        pv.querySelector('img').src = URL.createObjectURL(f);
        pv.hidden = false;
        $('#ai-text').focus();
      } catch (err) { toast(err.message); }
    });
    $('#ai-img-x').addEventListener('click', () => {
      aiFileId = null;
      $('#ai-img-preview').hidden = true;
    });

    $('#ai-new').addEventListener('click', () => {
      aiConvId = null;
      aiFileId = null;
      $('#ai-img-preview').hidden = true;
      $('#ai-text').value = '';
      aiHello();
      toast('گفت‌وگوی تازه شروع شد.');
    });
  }

  /* ═══════════ lightbox ═══════════ */
  function lightbox(src) {
    let lb = $('#lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'lightbox';
      lb.hidden = true;
      lb.innerHTML = '<img alt="نمایش تصویر">';
      document.body.appendChild(lb);
      lb.addEventListener('click', () => { lb.hidden = true; });
    }
    lb.querySelector('img').src = src;
    lb.hidden = false;
  }

  /* ═══════════ boot ═══════════ */
  async function boot() {
    wireAuth();
    wireChat();
    wireAI();
    await Promise.all([loadMe(), loadGrades()]);
    renderNavAuth();
    updateGates();
    if (me) {
      openRoom('general').catch(() => { });
      // light rooms refresh for unread badges
      setInterval(() => { if (!document.hidden && me) loadRooms().catch(() => { }); }, 30000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SSB.user = { get me() { return me; }, openAuth, updateGates };
})();
