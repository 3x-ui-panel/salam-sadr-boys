/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — app-core.js
   Data layer · Persian utils · renderers (XSS-safe)
   ═══════════════════════════════════════════════════════ */
'use strict';

window.SSB = (function () {

  /* ── utils ── */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  function faNum(v) {
    return String(v).replace(/[0-9]/g, d => FA_DIGITS[+d]);
  }
  function enNum(v) {
    return String(v).replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function sanitizeUrl(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s; // bare domain
    return '';
  }

  /* ── Tehran / Persian calendar helpers ── */
  const TZ = 'Asia/Tehran';
  function tzParts(date) {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const p = {};
    for (const { type, value } of f.formatToParts(date)) p[type] = value;
    return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute };
  }
  function dayKey(date) {
    const p = tzParts(date);
    return p.y * 10000 + p.m * 100 + p.d;
  }
  function faDateLong(date) {
    try {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).formatToParts(date);
      const get = t => (parts.find(p => p.type === t) || {}).value || '';
      return [get('weekday'), get('day'), get('month'), get('year')].filter(Boolean).join(' ');
    } catch (e) { return ''; }
  }
  function faDateShort(date) {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric'
      }).format(date);
    } catch (e) { return ''; }
  }
  function faWeekday(date) {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: TZ, weekday: 'long' }).format(date);
    } catch (e) { return ''; }
  }
  const normDay = s => String(s || '').replace(/[\u200C\s]/g, '');

  function countdown(due) {
    const diff = due.getTime() - Date.now();
    const past = diff <= 0;
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    let txt;
    if (days >= 1) txt = faNum(days) + ' روز و ' + faNum(hours % 24) + ' ساعت';
    else if (hours >= 1) txt = faNum(hours) + ' ساعت و ' + faNum(mins % 60) + ' دقیقه';
    else txt = faNum(Math.max(mins, 1)) + ' دقیقه';
    return { past, txt };
  }

  /* homework buckets by Tehran day */
  function bucketOf(due) {
    const k = dayKey(due);
    const today = dayKey(new Date());
    const tomorrow = dayKey(new Date(Date.now() + 864e5));
    if (k === today) return 'today';
    if (k === tomorrow) return 'tomorrow';
    if (k > tomorrow) return 'upcoming';
    return 'past';
  }

  /* ── state ── */
  const state = {
    data: null,
    hwBucket: 'today',
    hwGrade: 0,
    hwQuery: '',
    schGrade: 7,
    schDay: 0,
    previewMode: false
  };

  const SUBJECT_PALETTE = ['yellow', 'turquoise', 'green', 'red'];
  const COLOR_HEX = { yellow: '#F5B301', turquoise: '#14B8C4', red: '#E5484D', green: '#3BA55D' };
  const GRADE_COLORS = { 7: 'yellow', 8: 'turquoise', 9: 'green' };
  const GRADE_NAMES = { 7: 'هفتم', 8: 'هشتم', 9: 'نهم' };
  const DAY_NAMES = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
  const SUBJECT_FALLBACK = ['ریاضی', 'علوم', 'فارسی', 'عربی', 'دینی', 'اجتماعی', 'انسانی', 'نگارش', 'انگلیسی', 'کار و فناوری', 'مجازی', 'ورزش', 'افق'];

  function subjectColor(name, subjects) {
    const s = (subjects || state.data.subjects || []).find(x => (x.name || '').trim() === (name || '').trim());
    if (s && SUBJECT_PALETTE.includes(s.color)) return s.color;
    const i = SUBJECT_FALLBACK.indexOf(name);
    return SUBJECT_PALETTE[(i >= 0 ? i : name ? name.length : 0) % SUBJECT_PALETTE.length];
  }
  function colorSoft(c) {
    return { yellow: 'var(--yellow-soft)', turquoise: 'var(--turquoise-soft)', red: 'var(--red-soft)', green: 'var(--green-soft)' }[c] || 'var(--yellow-soft)';
  }

  /* ── data loading ── */
  async function loadData() {
    // preview mode: draft pushed by admin panel
    try {
      const pv = localStorage.getItem('ssb_preview');
      if (pv) {
        const d = JSON.parse(pv);
        if (d && d.version) {
          state.data = d;
          state.previewMode = true;
          document.getElementById('preview-banner').hidden = false;
          return d;
        }
      }
    } catch (e) { /* ignore */ }

    const res = await fetch('./data/data.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('data fetch failed: ' + res.status);
    state.data = await res.json();
    return state.data;
  }

  /* ── renderers ── */
  function applySiteContent() {
    const s = state.data.site || {};
    if (s.heroTitle) {
      document.title = s.heroTitle + ' | سایت بچه‌های مدرسه‌ی سلام صدر';
      const ht = $('.ht-line');
      if (ht && s.heroTitle.includes('صدر')) {
        ht.innerHTML = esc(s.heroTitle).replace('صدر', '<em class="ht-mark">صدر</em>');
      }
    }
    if (s.heroTagline) $('#hero-tagline').textContent = s.heroTagline;
    if (s.aboutTitle) $('#about-title').textContent = s.aboutTitle;
    if (s.aboutText) $('#about-text').textContent = s.aboutText;
    if (s.roadmap) $('#roadmap-text').textContent = s.roadmap;
    if (Array.isArray(s.marquee) && s.marquee.length) {
      const unit = s.marquee.map(t => '<span>' + esc(t) + '</span><i>✦</i>').join('');
      $('#marquee-track').innerHTML = unit + unit + unit + unit;
    }
    $('#hero-date').textContent = faDateLong(new Date());
    $('#foot-year').textContent = faNum(new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: TZ, year: 'numeric' }).format(new Date()).match(/\d+/)?.[0] || '۱۴۰۵');
  }

  function renderHomework() {
    const list = $('#hw-list');
    if (!state.data.homework || !state.data.homework.length) {
      $$('.bcount').forEach(b => b.textContent = '۰');
      list.innerHTML = emptyState('hw', state.hwBucket);
      return;
    }
    const items = state.data.homework
      .map(h => ({ ...h, due: new Date(h.dueAt) }))
      .filter(h => !isNaN(h.due))
      .sort((a, b) => a.due - b.due);

    const counts = { today: 0, tomorrow: 0, upcoming: 0, past: 0 };
    items.forEach(h => counts[bucketOf(h.due)]++);
    $$('.bcount').forEach(b => {
      const t = b.closest('.btab')?.dataset.bucket;
      if (t) b.textContent = faNum(counts[t] || 0);
    });

    let shown = items.filter(h => bucketOf(h.due) === state.hwBucket);
    if (state.hwGrade) shown = shown.filter(h => +h.grade === state.hwGrade);
    if (state.hwQuery) {
      const q = state.hwQuery.toLowerCase();
      shown = shown.filter(h =>
        (h.title || '').toLowerCase().includes(q) ||
        (h.subject || '').toLowerCase().includes(q) ||
        (h.note || '').toLowerCase().includes(q) ||
        (h.teacher || '').toLowerCase().includes(q));
    }

    if (!shown.length) { list.innerHTML = emptyState('filter'); return; }

    list.innerHTML = shown.map(h => {
      const c = subjectColor(h.subject, state.data.subjects);
      const cd = countdown(h.due);
      const isPast = bucketOf(h.due) === 'past';
      const dueCls = isPast ? 'past' : (cd.past ? 'soon' : (cd.txt.includes('ساعت') && !cd.txt.includes('روز') ? 'soon' : 'ok'));
      const url = sanitizeUrl(h.link);
      return `
      <article class="hw-card ${isPast ? 'past-done' : ''}" data-hw="${esc(h.id)}" tabindex="0" role="button" aria-expanded="false">
        <div class="hw-top">
          <div>
            <h3 class="hw-title">${esc(h.title)}</h3>
            <div class="hw-meta">
              <span class="hw-subject" style="--g:${COLOR_HEX[c]};--g-soft:${colorSoft(c)};--g-ink:var(--ink)">${esc(h.subject || 'درس')}</span>
              <span class="grade-tag gt-${GRADE_COLORS[+h.grade] || 'y'}">پایه‌ی ${GRADE_NAMES[+h.grade] || faNum(h.grade)}</span>
              ${h.teacher ? `<span class="m hw-teacher"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>${esc(h.teacher)}</span>` : ''}
            </div>
          </div>
          <div class="m hw-due ${dueCls}">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
            ${isPast ? (cd.past ? 'مهلت گذشت — ' + cd.txt + ' پیش' : '') : (cd.past ? 'مهلت تموم شد' : cd.txt + ' مونده')}
          </div>
        </div>
        <div class="hw-body"><div class="hw-body-in">
          ${h.note ? `<div class="hw-note">${esc(h.note).replace(/\n/g, '<br>')}</div>` : ''}
          ${url ? `<a class="hw-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24"><path d="M10 14a4.5 4.5 0 0 0 6.4.4l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11.5 6.5"/><path d="M14 10a4.5 4.5 0 0 0-6.4-.4l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1"/></svg>
            لینک / فایل تکلیف</a>` : ''}
        </div></div>
      </article>`;
    }).join('');

    $$('.hw-card', list).forEach(card => {
      const toggle = () => {
        const open = card.classList.toggle('open');
        card.setAttribute('aria-expanded', open);
      };
      card.addEventListener('click', e => { if (!e.target.closest('a')) toggle(); });
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }

  function emptyState(kind, bucket) {
    const bucketNames = { today: 'برای امروز', tomorrow: 'برای فردا', upcoming: 'برای روزهای بعد', past: 'از روزهای گذشته' };
    if (kind === 'hw') {
      return `<div class="empty">
        <svg viewBox="0 0 24 24"><path d="M4 19V6a2 2 0 0 1 2-2h5v15H6a2 2 0 0 0-2 2Zm16 0V6a2 2 0 0 0-2-2h-5v15h5a2 2 0 0 1 2 2Z"/><path d="M8.5 8h4M8.5 11.5h4"/></svg>
        <b>هنوز تکلیفی ${bucketNames[bucket] || ''} ثبت نشده.</b>
        <span>به‌محض اینکه تکلیف جدید ثبت بشه، همین‌جا با جزئیات کامل ظاهر می‌شه.</span>
      </div>`;
    }
    return `<div class="empty">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <b>چیزی پیدا نشد!</b>
      <span>فیلترها رو عوض کن یا عبارت دیگه‌ای جست‌وجو کن.</span>
    </div>`;
  }

  function renderSubjects() {
    const grid = $('#subject-grid');
    const subs = state.data.subjects || [];
    if (!subs.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><path d="M4 19V6a2 2 0 0 1 2-2h5v15H6a2 2 0 0 0-2 2Zm16 0V6a2 2 0 0 0-2-2h-5v15h5a2 2 0 0 1 2 2Z"/></svg>
        <b>درس‌ها هنوز ثبت نشدن.</b>
        <span>لیست درس‌ها و دبیرها به‌زودی از پنل مدیریت این‌جا منتشر می‌شه.</span>
      </div>`;
      return;
    }
    grid.innerHTML = subs.map(s => {
      const c = SUBJECT_PALETTE.includes(s.color) ? s.color : 'yellow';
      return `<article class="sub-card" style="--g:${COLOR_HEX[c]}">
        <b>${esc(s.name)}</b>
        ${s.teacher ? `<span class="t"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>${esc(s.teacher)}</span>` : ''}
        ${s.grade ? `<span class="g grade-tag gt-${GRADE_COLORS[+s.grade] || 'y'}">پایه‌ی ${GRADE_NAMES[+s.grade] || faNum(s.grade)}</span>` : ''}
      </article>`;
    }).join('');
  }

  function renderScheduleTabs() {
    const tabs = $('#day-tabs');
    const todayIdx = DAY_NAMES.findIndex(d => normDay(d) === normDay(faWeekday(new Date())));
    tabs.innerHTML = DAY_NAMES.map((d, i) =>
      `<button type="button" class="dtab ${i === state.schDay ? 'is-active' : ''} ${i === todayIdx ? 'is-today' : ''}" data-day="${i}" role="tab" aria-selected="${i === state.schDay}">${d}</button>`
    ).join('');
    $$('.dtab', tabs).forEach(b => b.addEventListener('click', () => {
      state.schDay = +b.dataset.day;
      renderScheduleTabs(); renderSchedule();
    }));
  }

  function renderSchedule() {
    const listEl = $('#schedule-list');
    const rows = (state.data.schedule || [])
      .filter(r => +r.grade === state.schGrade && +r.day === state.schDay)
      .sort((a, b) => (+a.period || 0) - (+b.period || 0));
    if (!rows.length) {
      listEl.innerHTML = `<div class="empty" style="padding:30px 20px">
        <b>برنامه‌ی ${DAY_NAMES[state.schDay]} برای پایه‌ی ${GRADE_NAMES[state.schGrade]} هنوز ثبت نشده.</b>
      </div>`;
      return;
    }
    listEl.innerHTML = rows.map(r => `
      <div class="sch-row">
        <b class="p">${faNum(r.period || '—')}</b>
        <span class="s">${esc(r.subject)}</span>
        ${r.teacher ? `<span class="t">${esc(r.teacher)}</span>` : ''}
      </div>`).join('');
  }

  function renderAnnouncements() {
    const list = $('#ann-list');
    const items = state.data.announcements || [];
    if (!items.length) {
      list.innerHTML = `<div class="empty">
        <svg viewBox="0 0 24 24"><path d="M6 4h12v16l-3-2-3 2-3-2-3 2V4Z"/><path d="M9 9h6M9 13h6"/></svg>
        <b>هنوز خبری ثبت نشده.</b>
        <span>اعلان‌های مهم مدرسه — از آزمون تا اردو — به‌محض ثبت، همین‌جا می‌شینه.</span>
      </div>`;
      return;
    }
    const sorted = [...items].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return new Date(b.date || b.id) - new Date(a.date || a.id);
    });
    list.innerHTML = sorted.map(a => {
      const c = SUBJECT_PALETTE.includes(a.color) ? a.color : 'yellow';
      return `<article class="ann-item">
        <span class="ann-dot" style="--g:${COLOR_HEX[c]}"></span>
        <div class="ann-card">
          <div class="ann-top">
            ${a.pinned ? '<span class="ann-pin">مهم</span>' : ''}
            <h3>${esc(a.title)}</h3>
            <span class="ann-date">${esc(a.date ? faDateShort(new Date(a.date)) : '')}</span>
          </div>
          ${a.body ? `<p>${esc(a.body).replace(/\n/g, '<br>')}</p>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function renderStats() {
    const grid = $('#stats-grid');
    const hw = (state.data.homework || []).length;
    const an = (state.data.announcements || []).length;
    const sb = (state.data.subjects || []).length;
    const cells = [
      { n: hw, l: 'تکلیف ثبت‌شده' },
      { n: an, l: 'اعلان منتشرشده' },
      { n: sb, l: 'درس فعال' },
      { n: 3, l: 'پایه‌ی تحصیلی' }
    ];
    grid.innerHTML = cells.map(c =>
      `<div class="stat"><b class="count" data-count="${c.n}">۰</b><span>${c.l}</span></div>`
    ).join('');
  }

  function renderContacts() {
    const box = $('#contact-cards');
    const c = (state.data.site || {}).contact || {};
    const cards = [];
    if (sanitizeUrl(c.telegram)) cards.push({ cls: 't', label: 'تلگرام صدر بویز', v: '@salam_sadr_boys', url: sanitizeUrl(c.telegram), ic: '<path d="M21 4L3 11l5.5 2L10 19l3-3.5L18 19z"/>' });
    if (sanitizeUrl(c.instagram)) cards.push({ cls: 'r', label: 'اینستاگرام', v: c.instagram.replace(/^@/, '@'), url: sanitizeUrl(c.instagram), ic: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r=".8"/>' });
    if (sanitizeUrl(c.eitaa)) cards.push({ cls: 'y', label: 'ایتا', v: 'کانال ایتا', url: sanitizeUrl(c.eitaa), ic: '<path d="M21 4L3 11l5.5 2L10 19l3-3.5L18 19z"/>' });
    if (c.phone) cards.push({ cls: 'g', label: 'تلفن مدرسه', v: faNum(c.phone), url: 'tel:' + esc(c.phone), ic: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>' });
    if (!cards.length) {
      box.innerHTML = '<div class="cc-empty">راه‌های ارتباطی به‌زودی همین‌جا اعلام می‌شه.</div>';
      return;
    }
    box.innerHTML = cards.map(k => `
      <a class="cc cc-${k.cls}" href="${esc(k.url)}" target="${k.url.startsWith('tel:') ? '_self' : '_blank'}" rel="noopener noreferrer">
        <span class="cc-ic"><svg viewBox="0 0 24 24">${k.ic}</svg></span>
        <span><b>${k.label}</b><span>${esc(k.v)}</span></span>
      </a>`).join('');
  }

  /* hero chips reflect real data (or honest placeholders) */
  function renderHeroChips() {
    const hw = state.data.homework || [];
    const an = state.data.announcements || [];
    const chipHw = $('#chip-hw'), chipAn = $('#chip-an'), chipSc = $('#chip-sc');
    if (hw.length) chipHw.textContent = faNum(hw.length) + ' تکلیف فعال';
    if (an.length) chipAn.textContent = faNum(an.length) + ' خبر تازه';
    const sch = (state.data.schedule || []).length;
    if (sch) chipSc.textContent = 'برنامه‌ی کامل هفته';
  }

  function renderAll() {
    applySiteContent();
    renderHomework();
    renderSubjects();
    renderScheduleTabs();
    renderSchedule();
    renderAnnouncements();
    renderStats();
    renderContacts();
    renderHeroChips();
  }

  /* ── events ── */
  function initEvents() {
    $$('.btab').forEach(b => b.addEventListener('click', () => {
      $$('.btab').forEach(x => { x.classList.remove('is-active'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('is-active'); b.setAttribute('aria-selected', 'true');
      state.hwBucket = b.dataset.bucket;
      renderHomework();
    }));
    $$('.gpill').forEach(b => b.addEventListener('click', () => {
      $$('.gpill').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      state.hwGrade = +b.dataset.grade;
      renderHomework();
    }));
    let qT;
    $('#hw-search-input').addEventListener('input', e => {
      clearTimeout(qT);
      qT = setTimeout(() => { state.hwQuery = e.target.value.trim(); renderHomework(); }, 220);
    });
    $$('.gtab').forEach(b => b.addEventListener('click', () => {
      $$('.gtab').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      state.schGrade = +b.dataset.sgrade;
      renderSchedule();
    }));
    const pe = document.getElementById('preview-exit');
    if (pe) pe.addEventListener('click', () => {
      localStorage.removeItem('ssb_preview');
      location.reload();
    });
    setInterval(() => {
      if (state.data) { renderHomework(); }
    }, 60000);
  }

  return {
    $, $$, faNum, enNum, esc, sanitizeUrl,
    loadData, renderAll, initEvents, state,
    COLOR_HEX, GRADE_NAMES, DAY_NAMES
  };
})();
