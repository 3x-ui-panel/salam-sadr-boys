/* ═══════════════════════════════════════════════════════
   سلام صدر بویز — panel app-ui.js
   auth · managers · publish
   ═══════════════════════════════════════════════════════ */
'use strict';

(function () {
  const P = window.PANEL;
  const { $, $$, faNum, esc, uid, sanitizeUrl, store } = P;

  const GRADE_NAMES = { 7: 'هفتم', 8: 'هشتم', 9: 'نهم' };
  const DAY_NAMES = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
  const COLORS = [
    { v: 'yellow', n: 'زرد' }, { v: 'turquoise', n: 'فیروزه‌ای' },
    { v: 'green', n: 'سبز' }, { v: 'red', n: 'قرمز' }
  ];
  const FALLBACK_SUBJECTS = ['ریاضی', 'علوم', 'فارسی', 'ادبیات', 'عربی', 'قرآن', 'پیام‌های آسمان', 'اجتماعی', 'علوم تجربی', 'ریاضی ۱', 'ریاضی ۲', 'نگارش', 'انگلیسی', 'کار و فناوری', 'تفکر و سبک زندگی', 'مجازی', 'ورزش', 'افق پرواز', 'آمادگی دفاعی', 'کارگاه'];
  let vipPassword = null; // in-memory only

  /* ── toast ── */
  let toastT = null;
  function toast(msg, isErr) {
    const t = $('#p-toast');
    t.textContent = msg;
    t.className = isErr ? 'err' : '';
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 350); }, 3600);
  }

  /* ── dirty state ── */
  function markDirty() {
    P.saveDraft();
    const el = $('#draft-state');
    el.textContent = 'تغییرات ذخیره شد — منتشر نشده';
    el.classList.add('dirty');
  }
  function markClean() {
    const el = $('#draft-state');
    el.textContent = 'هماهنگ با نسخه‌ی منتشرشده';
    el.classList.remove('dirty');
  }

  /* ═══════════ AUTH ═══════════ */
  async function initAuth() {
    try { await P.loadInitial(); }
    catch (e) {
      $('#auth-msg').textContent = 'خطا در خواندن داده: ' + e.message;
      $('#auth-msg').hidden = false;
      return;
    }
    if (store.hasSession()) return showApp();
    $('#auth-screen').style.display = 'flex';

    $('#auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#auth-msg');
      msg.hidden = true;
      const lock = store.getLock();
      if (Date.now() < lock.until) {
        const s = Math.ceil((lock.until - Date.now()) / 1000);
        showAuthMsg('err', 'به‌خاطر تلاش‌های زیاد، پنل ' + faNum(Math.ceil(s / 60)) + ' دقیقه قفل شده. کمی بعد برگرد.');
        return;
      }
      const pass = $('#auth-pass').value;
      if (!pass) return;
      const draftNow = P.getDraft();
      if (!draftNow || !draftNow.admin) {
        showAuthMsg('info', 'چند لحظه صبر کن — داده‌ها در حال بارگذاریه.');
        return;
      }
      const btn = $('#auth-submit');
      btn.disabled = true; btn.textContent = 'در حال بررسی…';
      try {
        // Auth must always verify against the PUBLISHED hash — a stale local
        // draft must never be able to lock the owner out (or let old hashes in).
        const pub = P.getPublished() || {};
        const admin = pub.admin || draftNow.admin || {};
        const hex = await P.pbkdf2Hex(pass, admin.salt || '', admin.iterations || 150000);
        if (!admin.hash || !P.ctEqual(hex, admin.hash)) {
          const n = (lock.n || 0) + 1;
          if (n >= 5) {
            store.setLock({ n: 0, until: Date.now() + 5 * 60 * 1000 });
            showAuthMsg('err', '۵ بار اشتباه! پنل برای ۵ دقیقه قفل شد. یه نفس عمیق بکش و رمز رو یادت بیار.');
          } else {
            store.setLock({ n, until: 0 });
            showAuthMsg('err', 'رمز درست نیست! ' + faNum(5 - n) + ' تلاش دیگه مونده تا قفل شدن پنل.');
          }
          return;
        }
        store.setLock({ n: 0, until: 0 });
        store.setSession();
        $('#auth-pass').value = '';
        showApp();
      } catch (err) {
        showAuthMsg('err', 'خطای غیرمنتظره: ' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'ورود';
      }
    });
  }
  function showAuthMsg(kind, text) {
    const m = $('#auth-msg');
    m.className = 'pmsg ' + kind;
    m.textContent = text;
    m.hidden = false;
  }
  function showApp() {
    $('#auth-screen').style.display = 'none';
    $('#panel-app').hidden = false;
    markClean();
    renderDash();
    initNav();
    $('#btn-publish').addEventListener('click', doPublish);
    $('#btn-preview').addEventListener('click', doPreview);
    $('#btn-logout').addEventListener('click', () => { store.clearSession(); location.reload(); });
  }

  /* ═══════════ NAV ═══════════ */
  let navInit = false;
  function initNav() {
    if (navInit) return;
    navInit = true;
    $$('.pnav').forEach(b => b.addEventListener('click', () => {
      $$('.pnav').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      $$('.pview').forEach(v => v.classList.remove('is-active'));
      const v = $('#view-' + b.dataset.view);
      v.classList.add('is-active');
      ({ dash: renderDash, homework: renderHomework, announcements: renderAnnouncements, subjects: renderSubjects, schedule: renderSchedule, content: renderContent, users: renderUsers, debug: renderDebug, vip: renderVip, settings: renderSettings })[b.dataset.view]();
    }));
  }

  /* ═══════════ DASHBOARD ═══════════ */
  function renderDash() {
    const d = P.getDraft();
    const token = store.getToken();
    const pub = P.getPublished();
    $('#view-dash').innerHTML = `
      <div class="pcard">
        <h2>سلام مدیر!</h2>
        <div class="pd">وضعیت سایت صدر بویز در یک نگاه — همه‌ی عدد‌ها واقعی و از همین داده‌ها.</div>
        <div class="stat-row">
          <div class="stat-c"><b>${faNum((d.homework || []).length)}</b><span>تکلیف ثبت‌شده</span></div>
          <div class="stat-c"><b>${faNum((d.announcements || []).length)}</b><span>اعلان منتشرشده</span></div>
          <div class="stat-c"><b>${faNum((d.subjects || []).length)}</b><span>درس فعال</span></div>
          <div class="stat-c"><b>${faNum((d.schedule || []).length)}</b><span>سطر برنامه‌ی کلاسی</span></div>
        </div>
        ${!token ? '<div class="pmsg info">برای انتشار تغییرات، توکن گیت‌هاب رو یک‌بار در «تنظیمات و انتشار» ثبت کن.</div>' : ''}
        <div class="fhint">آخرین هماهنگی داده‌ها: ${esc((pub && pub.updatedAt) ? new Date(pub.updatedAt).toLocaleString('fa-IR') : '—')}</div>
      </div>
      <div class="pcard">
        <h2>راهنمای سریع</h2>
        <div class="pd">چند نکته که کار با پنل رو راحت می‌کنه:</div>
        <div class="rowlist">
          <div class="prow"><span class="r-main"><b>۱. تغییرات رو ثبت کن</b><span>هر تغییر همین‌جا در مرورگر تو ذخیره می‌شه (پیش‌نویس).</span></span></div>
          <div class="prow"><span class="r-main"><b>۲. قبل از انتشار، پیش‌نمایش بگیر</b><span>دکمه‌ی «پیش‌نمایش سایت» نسخه‌ی جدید رو در تب دیگه نشون می‌ده.</span></span></div>
          <div class="prow"><span class="r-main"><b>۳. با دکمه‌ی «انتشار»، سایت به‌روز می‌شه</b><span>فایل داده در مخزن گیت‌هاب به‌روز می‌شه و پس از ۱ تا ۲ دقیقه برای همه اعمال می‌شه.</span></span></div>
        </div>
      </div>`;
  }

  /* ═══════════ HOMEWORK ═══════════ */
  function renderHomework() {
    const d = P.getDraft();
    const list = (d.homework || []).slice().sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    const dl = FALLBACK_SUBJECTS.concat((d.subjects || []).map(s => s.name)).filter((v, i, a) => a.indexOf(v) === i);
    $('#view-homework').innerHTML = `
      <div class="pcard">
        <h2 id="hw-form-title">ثبت تکلیف جدید</h2>
        <div class="pd">مهلت رو دقیق وارد کن؛ سایت خودش تکلیف رو توی «امروز / فردا / بعدی‌ها» می‌چینه.</div>
        <form id="hw-form">
          <input type="hidden" id="hw-id" value="">
          <div class="frow">
            <div class="fgroup"><label>عنوان تکلیف *</label><input id="hw-title" required maxlength="120" placeholder="مثلاً حل تمرین‌های ۵ تا ۹"></div>
            <div class="fgroup"><label>درس *</label><input id="hw-subject" list="hw-subjects" required maxlength="40" placeholder="مثلاً ریاضی">
              <datalist id="hw-subjects">${dl.map(s => '<option value="' + esc(s) + '">').join('')}</datalist></div>
            <div class="fgroup"><label>پایه *</label><select id="hw-grade" required>
              <option value="7">هفتم</option><option value="8">هشتم</option><option value="9">نهم</option></select></div>
          </div>
          <div class="frow">
            <div class="fgroup"><label>مهلت (به وقت تهران) *</label><input id="hw-due" type="datetime-local" required></div>
            <div class="fgroup"><label>دبیر</label><input id="hw-teacher" maxlength="60" placeholder="اختیاری"></div>
            <div class="fgroup"><label>لینک / فایل</label><input id="hw-link" maxlength="300" placeholder="https://…" dir="ltr"></div>
          </div>
          <div class="fgroup"><label>توضیحات</label><textarea id="hw-note" maxlength="1200" placeholder="هر نکته‌ای که بچه‌ها لازم دارن…"></textarea></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="pbtn pbtn-yellow" type="submit" id="hw-save">ثبت تکلیف</button>
            <button class="pbtn pbtn-ghost" type="button" id="hw-reset" hidden>انصراف از ویرایش</button>
          </div>
        </form>
      </div>
      <div class="pcard">
        <h2>تکالیف ثبت‌شده (${faNum(list.length)})</h2>
        <div class="pd">مرتب‌شده بر اساس مهلت — نزدیک‌ترین اول.</div>
        ${list.length ? '<div class="rowlist">' + list.map(h => `
          <div class="prow">
            <span class="pill pill-${({ 7: 'y', 8: 't', 9: 'g' })[+h.grade] || 'y'}">${GRADE_NAMES[+h.grade] || faNum(h.grade)}</span>
            <span class="r-main"><b>${esc(h.title)}</b><span>${esc(h.subject || '')} · مهلت: ${esc(fmtDT(h.dueAt))}${h.teacher ? ' · ' + esc(h.teacher) : ''}</span></span>
            <span class="r-actions">
              <button class="icon-btn" data-edit="${esc(h.id)}" title="ویرایش" aria-label="ویرایش"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13 7l4 4"/></svg></button>
              <button class="icon-btn del" data-del="${esc(h.id)}" title="حذف" aria-label="حذف"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg></button>
            </span>
          </div>`).join('') + '</div>'
          : '<div class="emptybox">هنوز تکلیفی ثبت نشده — اولین تکلیف رو از فرم بالا ثبت کن.</div>'}
      </div>`;

    $('#hw-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = $('#hw-id').value;
      const item = {
        id: id || uid(),
        title: $('#hw-title').value.trim(),
        subject: $('#hw-subject').value.trim(),
        grade: +$('#hw-grade').value,
        dueAt: $('#hw-due').value,
        teacher: $('#hw-teacher').value.trim(),
        note: $('#hw-note').value.trim(),
        link: $('#hw-link').value.trim(),
        createdAt: id ? undefined : new Date().toISOString()
      };
      if (!item.title || !item.subject || !item.dueAt) { toast('عنوان، درس و مهلت رو کامل کن.', true); return; }
      if (!d.homework) d.homework = [];
      if (id) {
        const i = d.homework.findIndex(x => x.id === id);
        if (i >= 0) d.homework[i] = { ...d.homework[i], ...item };
      } else d.homework.push(item);
      markDirty();
      toast(id ? 'تکلیف به‌روز شد.' : 'تکلیف ثبت شد.');
      renderHomework();
    });
    $('#hw-reset').addEventListener('click', renderHomework);
    $$('#view-homework [data-edit]').forEach(b => b.addEventListener('click', () => {
      const h = (d.homework || []).find(x => x.id === b.dataset.edit);
      if (!h) return;
      $('#hw-form-title').textContent = 'ویرایش تکلیف';
      $('#hw-id').value = h.id;
      $('#hw-title').value = h.title || '';
      $('#hw-subject').value = h.subject || '';
      $('#hw-grade').value = String(h.grade || 7);
      $('#hw-due').value = h.dueAt || '';
      $('#hw-teacher').value = h.teacher || '';
      $('#hw-link').value = h.link || '';
      $('#hw-note').value = h.note || '';
      $('#hw-reset').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    $$('#view-homework [data-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('این تکلیف حذف بشه؟')) return;
      d.homework = (d.homework || []).filter(x => x.id !== b.dataset.del);
      markDirty(); toast('تکلیف حذف شد.'); renderHomework();
    }));
  }

  /* ═══════════ ANNOUNCEMENTS ═══════════ */
  function renderAnnouncements() {
    const d = P.getDraft();
    const list = (d.announcements || []).slice().reverse();
    $('#view-announcements').innerHTML = `
      <div class="pcard">
        <h2 id="an-form-title">اعلان جدید</h2>
        <div class="pd">اعلان‌های سنجاق‌شده بالا‌تر از بقیه نمایش داده می‌شن و با برچسب «مهم» می‌رسن.</div>
        <form id="an-form">
          <input type="hidden" id="an-id" value="">
          <div class="frow">
            <div class="fgroup"><label>عنوان *</label><input id="an-title" required maxlength="120" placeholder="مثلاً آزمون علوم هفته‌ی دیگه"></div>
            <div class="fgroup"><label>تاریخ</label><input id="an-date" type="date"></div>
            <div class="fgroup"><label>رنگ</label><select id="an-color">${COLORS.map(c => '<option value="' + c.v + '">' + c.n + '</option>').join('')}</select></div>
          </div>
          <div class="fgroup"><label>متن اعلان</label><textarea id="an-body" maxlength="1500" placeholder="جزئیات…"></textarea></div>
          <label class="fcheck"><input type="checkbox" id="an-pin"> سنجاق کن (مهم)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="pbtn pbtn-yellow" type="submit">ثبت اعلان</button>
            <button class="pbtn pbtn-ghost" type="button" id="an-reset" hidden>انصراف از ویرایش</button>
          </div>
        </form>
      </div>
      <div class="pcard">
        <h2>اعلان‌ها (${faNum(list.length)})</h2>
        ${list.length ? '<div class="rowlist">' + list.map(a => `
          <div class="prow">
            ${a.pinned ? '<span class="pill pill-r">مهم</span>' : ''}
            <span class="r-main"><b>${esc(a.title)}</b><span>${esc(a.date ? fmtD(a.date) : '')}</span></span>
            <span class="r-actions">
              <button class="icon-btn" data-edit="${esc(a.id)}" aria-label="ویرایش"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13 7l4 4"/></svg></button>
              <button class="icon-btn del" data-del="${esc(a.id)}" aria-label="حذف"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg></button>
            </span>
          </div>`).join('') + '</div>'
          : '<div class="emptybox">اعلانی ثبت نشده.</div>'}
      </div>`;

    $('#an-date').value = new Date().toISOString().slice(0, 10);
    $('#an-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = $('#an-id').value;
      const item = {
        id: id || uid(),
        title: $('#an-title').value.trim(),
        body: $('#an-body').value.trim(),
        date: $('#an-date').value,
        pinned: $('#an-pin').checked,
        color: $('#an-color').value
      };
      if (!item.title) return;
      if (!d.announcements) d.announcements = [];
      if (id) {
        const i = d.announcements.findIndex(x => x.id === id);
        if (i >= 0) d.announcements[i] = { ...d.announcements[i], ...item };
      } else d.announcements.push(item);
      markDirty(); toast('اعلان ذخیره شد.'); renderAnnouncements();
    });
    $('#an-reset').addEventListener('click', renderAnnouncements);
    $$('#view-announcements [data-edit]').forEach(b => b.addEventListener('click', () => {
      const a = (d.announcements || []).find(x => x.id === b.dataset.edit);
      if (!a) return;
      $('#an-form-title').textContent = 'ویرایش اعلان';
      $('#an-id').value = a.id; $('#an-title').value = a.title || '';
      $('#an-date').value = a.date || ''; $('#an-color').value = a.color || 'yellow';
      $('#an-body').value = a.body || ''; $('#an-pin').checked = !!a.pinned;
      $('#an-reset').hidden = false;
    }));
    $$('#view-announcements [data-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('این اعلان حذف بشه؟')) return;
      d.announcements = (d.announcements || []).filter(x => x.id !== b.dataset.del);
      markDirty(); toast('اعلان حذف شد.'); renderAnnouncements();
    }));
  }

  /* ═══════════ SUBJECTS ═══════════ */
  function renderSubjects() {
    const d = P.getDraft();
    const list = d.subjects || [];
    $('#view-subjects').innerHTML = `
      <div class="pcard">
        <h2 id="sb-form-title">درس جدید</h2>
        <div class="pd">هر درس یه رنگ داره؛ اگه انتخاب نکنی خود سایت به‌ترتیب رنگ می‌ده.</div>
        <form id="sb-form">
          <input type="hidden" id="sb-id" value="">
          <div class="frow">
            <div class="fgroup"><label>نام درس *</label><input id="sb-name" required maxlength="40" placeholder="مثلاً ریاضی"></div>
            <div class="fgroup"><label>دبیر</label><input id="sb-teacher" maxlength="60" placeholder="اختیاری"></div>
            <div class="fgroup"><label>پایه</label><select id="sb-grade">
              <option value="">مشترک (همه)</option><option value="7">هفتم</option><option value="8">هشتم</option><option value="9">نهم</option></select></div>
            <div class="fgroup"><label>رنگ</label><select id="sb-color">${COLORS.map(c => '<option value="' + c.v + '">' + c.n + '</option>').join('')}</select></div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="pbtn pbtn-yellow" type="submit">ثبت درس</button>
            <button class="pbtn pbtn-ghost" type="button" id="sb-reset" hidden>انصراف</button>
          </div>
        </form>
      </div>
      <div class="pcard">
        <h2>درس‌ها (${faNum(list.length)})</h2>
        ${list.length ? '<div class="rowlist">' + list.map(s => `
          <div class="prow">
            <span class="pill pill-${({ yellow: 'y', turquoise: 't', green: 'g', red: 'r' })[s.color] || 'y'}">${esc(s.name)}</span>
            <span class="r-main"><b>${esc(s.name)}</b><span>${esc(s.teacher || 'بدون دبیر')}${s.grade ? ' · پایه‌ی ' + GRADE_NAMES[+s.grade] : ' · مشترک'}</span></span>
            <span class="r-actions">
              <button class="icon-btn" data-edit="${esc(s.id)}" aria-label="ویرایش"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13 7l4 4"/></svg></button>
              <button class="icon-btn del" data-del="${esc(s.id)}" aria-label="حذف"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg></button>
            </span>
          </div>`).join('') + '</div>'
          : '<div class="emptybox">درسی ثبت نشده.</div>'}
      </div>`;

    $('#sb-form').addEventListener('submit', e => {
      e.preventDefault();
      const id = $('#sb-id').value;
      const item = {
        id: id || uid(),
        name: $('#sb-name').value.trim(),
        teacher: $('#sb-teacher').value.trim(),
        grade: $('#sb-grade').value ? +$('#sb-grade').value : null,
        color: $('#sb-color').value
      };
      if (!item.name) return;
      if (!d.subjects) d.subjects = [];
      if (id) {
        const i = d.subjects.findIndex(x => x.id === id);
        if (i >= 0) d.subjects[i] = { ...d.subjects[i], ...item };
      } else d.subjects.push(item);
      markDirty(); toast('درس ذخیره شد.'); renderSubjects();
    });
    $('#sb-reset').addEventListener('click', renderSubjects);
    $$('#view-subjects [data-edit]').forEach(b => b.addEventListener('click', () => {
      const s = (d.subjects || []).find(x => x.id === b.dataset.edit);
      if (!s) return;
      $('#sb-form-title').textContent = 'ویرایش درس';
      $('#sb-id').value = s.id; $('#sb-name').value = s.name || '';
      $('#sb-teacher').value = s.teacher || '';
      $('#sb-grade').value = s.grade ? String(s.grade) : '';
      $('#sb-color').value = s.color || 'yellow';
      $('#sb-reset').hidden = false;
    }));
    $$('#view-subjects [data-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('این درس حذف بشه؟')) return;
      d.subjects = (d.subjects || []).filter(x => x.id !== b.dataset.del);
      markDirty(); toast('درس حذف شد.'); renderSubjects();
    }));
  }

  /* ═══════════ SCHEDULE ═══════════ */
  function renderSchedule(grade) {
    const d = P.getDraft();
    const g = grade || 7;
    const rows = (d.schedule || []).filter(r => +r.grade === g).sort((a, b) => (+a.day - +b.day) || (+a.period - +b.period));
    const dl = FALLBACK_SUBJECTS.concat((d.subjects || []).map(s => s.name)).filter((v, i, a) => a.indexOf(v) === i);
    $('#view-schedule').innerHTML = `
      <div class="pcard">
        <h2>برنامه‌ی کلاسی — پایه‌ی ${GRADE_NAMES[g]}</h2>
        <div class="pd">روز و ساعت و درس رو اضافه کن؛ سایت هر پایه رو جدا و بر اساس روز نمایش می‌ده.</div>
        <div class="mtabs">
          <button class="mtab ${g === 7 ? 'is-active' : ''}" data-g="7">هفتم</button>
          <button class="mtab ${g === 8 ? 'is-active' : ''}" data-g="8">هشتم</button>
          <button class="mtab ${g === 9 ? 'is-active' : ''}" data-g="9">نهم</button>
        </div>
        <form id="sc-form">
          <div class="frow">
            <div class="fgroup"><label>روز *</label><select id="sc-day">${DAY_NAMES.map((n, i) => '<option value="' + i + '">' + n + '</option>').join('')}</select></div>
            <div class="fgroup"><label>ساعت (زنگ) *</label><select id="sc-period">${[1, 2, 3, 4, 5, 6, 7, 8].map(p => '<option value="' + p + '">زنگ ' + faNum(p) + '</option>').join('')}</select></div>
            <div class="fgroup"><label>درس *</label><input id="sc-subject" list="sc-subjects" required maxlength="40">
              <datalist id="sc-subjects">${dl.map(s => '<option value="' + esc(s) + '">').join('')}</datalist></div>
            <div class="fgroup"><label>دبیر</label><input id="sc-teacher" maxlength="60" placeholder="اختیاری"></div>
          </div>
          <button class="pbtn pbtn-yellow" type="submit">افزودن به برنامه</button>
        </form>
      </div>
      <div class="pcard">
        <h2>برنامه‌ی ثبت‌شده (${faNum(rows.length)} سطر)</h2>
        ${rows.length ? '<div class="rowlist">' + rows.map(r => `
          <div class="prow">
            <span class="pill pill-${({ 0: 'y', 1: 't', 2: 'g', 3: 'r', 4: 'y', 5: 't' })[+r.day] || 'y'}">${DAY_NAMES[+r.day] || ''}</span>
            <span class="r-main"><b>زنگ ${faNum(r.period)} — ${esc(r.subject)}</b><span>${esc(r.teacher || '')}</span></span>
            <span class="r-actions">
              <button class="icon-btn del" data-del="${esc(r.id)}" aria-label="حذف"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg></button>
            </span>
          </div>`).join('') + '</div>'
          : '<div class="emptybox">برنامه‌ی این پایه هنوز خالیه.</div>'}
      </div>`;

    $$('#view-schedule .mtab').forEach(b => b.addEventListener('click', () => renderSchedule(+b.dataset.g)));
    $('#sc-form').addEventListener('submit', e => {
      e.preventDefault();
      const item = {
        id: uid(), grade: g,
        day: +$('#sc-day').value, period: +$('#sc-period').value,
        subject: $('#sc-subject').value.trim(), teacher: $('#sc-teacher').value.trim()
      };
      if (!item.subject) return;
      if (!d.schedule) d.schedule = [];
      d.schedule.push(item);
      markDirty(); toast('به برنامه اضافه شد.');
      renderSchedule(g);
    });
    $$('#view-schedule [data-del]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('این سطر حذف بشه؟')) return;
      d.schedule = (d.schedule || []).filter(x => x.id !== b.dataset.del);
      markDirty(); toast('حذف شد.'); renderSchedule(g);
    }));
  }

  /* ═══════════ CONTENT ═══════════ */
  function renderContent() {
    const s = P.getDraft().site || {};
    $('#view-content').innerHTML = `
      <div class="pcard">
        <h2>محتوای صفحه‌ی اصلی</h2>
        <div class="pd">متن‌های مهم سایت — عنوان‌ها، معرفی و راه‌های ارتباطی.</div>
        <form id="ct-form">
          <div class="frow">
            <div class="fgroup"><label>عنوان اصلی (Hero)</label><input id="ct-hero" maxlength="60" value="${esc(s.heroTitle || '')}"></div>
            <div class="fgroup"><label>عنوان بخش درباره</label><input id="ct-about-title" maxlength="80" value="${esc(s.aboutTitle || '')}"></div>
          </div>
          <div class="fgroup"><label>تگ‌لاین زیر عنوان اصلی</label><textarea id="ct-tagline" maxlength="300">${esc(s.heroTagline || '')}</textarea></div>
          <div class="fgroup"><label>متن بخش درباره</label><textarea id="ct-about" maxlength="2000" style="min-height:150px">${esc(s.aboutText || '')}</textarea></div>
          <div class="fgroup"><label>برچسب «در راه…»</label><input id="ct-roadmap" maxlength="80" value="${esc(s.roadmap || '')}"></div>
          <div class="fgroup"><label>جمله‌های نوار متحرک (هر خط یکی)</label><textarea id="ct-marquee" maxlength="500" placeholder="هر جمله در یک خط">${esc((s.marquee || []).join('\n'))}</textarea></div>
          <div class="frow">
            <div class="fgroup"><label>تلفن</label><input id="ct-phone" maxlength="20" value="${esc((s.contact || {}).phone || '')}" dir="ltr"></div>
            <div class="fgroup"><label>لینک تلگرام</label><input id="ct-telegram" maxlength="200" value="${esc((s.contact || {}).telegram || '')}" dir="ltr" placeholder="https://t.me/…"></div>
            <div class="fgroup"><label>لینک اینستاگرام</label><input id="ct-instagram" maxlength="200" value="${esc((s.contact || {}).instagram || '')}" dir="ltr" placeholder="https://instagram.com/…"></div>
            <div class="fgroup"><label>لینک ایتا</label><input id="ct-eitaa" maxlength="200" value="${esc((s.contact || {}).eitaa || '')}" dir="ltr"></div>
          </div>
          <button class="pbtn pbtn-yellow" type="submit">ذخیره‌ی محتوا</button>
        </form>
      </div>`;

    $('#ct-form').addEventListener('submit', e => {
      e.preventDefault();
      const d = P.getDraft();
      d.site = {
        ...(d.site || {}),
        heroTitle: $('#ct-hero').value.trim(),
        heroTagline: $('#ct-tagline').value.trim(),
        aboutTitle: $('#ct-about-title').value.trim(),
        aboutText: $('#ct-about').value.trim(),
        roadmap: $('#ct-roadmap').value.trim(),
        marquee: $('#ct-marquee').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12),
        contact: {
          phone: $('#ct-phone').value.trim(),
          telegram: $('#ct-telegram').value.trim(),
          instagram: $('#ct-instagram').value.trim(),
          eitaa: $('#ct-eitaa').value.trim()
        }
      };
      markDirty(); toast('محتوا ذخیره شد — با «انتشار» روی سایت اعمال می‌شه.');
    });
  }

  /* ═══════════ VIP ═══════════ */
  function renderVip() {
    const d = P.getDraft();
    const vip = d.vip || (d.vip = { enabled: false, salt: '', hash: '', iterations: 150000, enc: null });
    const unlocked = Array.isArray(vip.links);
    const needsUnlock = vip.enabled && !unlocked && vip.enc && vip.hash;
    $('#view-vip').innerHTML = `
      <div class="pcard">
        <h2>بخش ویژه (VIP)</h2>
        <div class="pd">محتوای ویژه با رمزنگاری AES-GCM ذخیره می‌شه؛ حتی کسی که فایل داده رو ببینه بدون رمز به لینک‌ها دسترسی نداره.</div>
        <label class="fcheck"><input type="checkbox" id="vip-enabled" ${vip.enabled ? 'checked' : ''}> بخش ویژه فعال باشه</label>
        ${needsUnlock ? `
          <div class="pmsg info">برای ویرایش لینک‌های ویژه، رمز فعلی بخش ویژه رو وارد کن.</div>
          <form id="vip-unlock-form" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            <div class="fgroup" style="flex:1;min-width:200px;margin:0"><input type="password" id="vip-unlock-pass" placeholder="رمز بخش ویژه…" maxlength="64" required></div>
            <button class="pbtn pbtn-primary" type="submit">باز کردن</button>
          </form>` : ''}
        ${vip.enabled && (unlocked || !needsUnlock) ? `
          <form id="vip-links-form" style="margin-top:14px">
            <div class="frow">
              <div class="fgroup"><label>عنوان لینک *</label><input id="vl-title" required maxlength="80" placeholder="مثلاً جزوه‌ی طلایی ریاضی"></div>
              <div class="fgroup"><label>لینک *</label><input id="vl-url" required maxlength="400" dir="ltr" placeholder="https://…"></div>
            </div>
            <div class="fgroup"><label>توضیح کوتاه</label><input id="vl-note" maxlength="160" placeholder="اختیاری"></div>
            <button class="pbtn pbtn-yellow" type="submit">افزودن لینک</button>
          </form>
          <div class="rowlist" style="margin-top:14px">
            ${(vip.links || []).map(l => `
              <div class="prow">
                <span class="pill pill-y">ویژه</span>
                <span class="r-main"><b>${esc(l.title)}</b><span dir="ltr" style="unicode-bidi:embed">${esc(l.url)}</span></span>
                <span class="r-actions"><button class="icon-btn del" data-del="${esc(l.id)}" aria-label="حذف"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg></button></span>
              </div>`).join('')}
          </div>
          <details style="margin-top:16px">
            <summary style="cursor:pointer;font-weight:800;font-size:14px">تغییر رمز بخش ویژه</summary>
            <form id="vip-pass-form" style="margin-top:10px">
              <div class="frow">
                <div class="fgroup"><label>رمز جدید (حداقل ۸ کاراکتر) *</label><input type="password" id="vip-new-pass" minlength="8" maxlength="64" required></div>
                <div class="fgroup"><label>تکرار رمز جدید *</label><input type="password" id="vip-new-pass2" minlength="8" maxlength="64" required></div>
              </div>
              <button class="pbtn pbtn-primary" type="submit">ثبت رمز جدید</button>
            </form>
          </details>` : ''}
      </div>`;

    $('#vip-enabled').addEventListener('change', e => {
      d.vip.enabled = e.target.checked;
      if (e.target.checked && !d.vip.links) d.vip.links = [];
      markDirty();
      toast('وضعیت بخش ویژه: ' + (e.target.checked ? 'فعال' : 'غیرفعال'));
      renderVip();
    });
    const uf = $('#vip-unlock-form');
    if (uf) uf.addEventListener('submit', async e => {
      e.preventDefault();
      const pass = $('#vip-unlock-pass').value;
      if (!pass) return;
      try {
        const hex = await P.pbkdf2Hex(pass, d.vip.salt, d.vip.iterations || 150000);
        if (!P.ctEqual(hex, d.vip.hash || '')) { toast('رمز بخش ویژه درست نیست.', true); return; }
        const key = await P.deriveAesKey(pass, d.vip.salt, d.vip.iterations || 150000);
        const iv = new Uint8Array((d.vip.enc && d.vip.enc.iv || '').match(/.{2}/g).map(b => parseInt(b, 16)));
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, new Uint8Array((d.vip.enc.data || '').match(/.{2}/g).map(b => parseInt(b, 16))));
        vipPassword = pass;
        d.vip.links = JSON.parse(new TextDecoder().decode(plain));
        markDirty();
        toast('لینک‌های ویژه باز شد.');
        renderVip();
      } catch (err) {
        toast('رمز درست نیست یا داده خرابه.', true);
      }
    });
    const lf = $('#vip-links-form');
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      const title = $('#vl-title').value.trim();
      const url = sanitizeUrl($('#vl-url').value);
      if (!title || !url) { toast('عنوان و لینک معتبر لازم است.', true); return; }
      if (!d.vip.links) d.vip.links = [];
      d.vip.links.push({ id: uid(), title, url, note: $('#vl-note').value.trim() });
      d.vip.needsCipher = true;
      markDirty(); toast('لینک اضافه شد (در انتشار، رمزنگاری می‌شه).');
      renderVip();
    });
    $$('#view-vip [data-del]').forEach(b => b.addEventListener('click', () => {
      d.vip.links = (d.vip.links || []).filter(x => x.id !== b.dataset.del);
      d.vip.needsCipher = true;
      markDirty(); toast('لینک حذف شد.'); renderVip();
    }));
    const pf = $('#vip-pass-form');
    if (pf) pf.addEventListener('submit', async e => {
      e.preventDefault();
      const a = $('#vip-new-pass').value, b = $('#vip-new-pass2').value;
      if (a !== b) { toast('دو رمز یکسان نیستن.', true); return; }
      if (a.length < 8) { toast('رمز حداقل ۸ کاراکتر باشه.', true); return; }
      vipPassword = a;
      d.vip.needsCipher = true;
      markDirty();
      toast('رمز جدید ثبت شد — در انتشار اعمال می‌شه.');
      renderVip();
    });
  }

  /* apply VIP cipher before publish */
  async function applyVipCipher() {
    const d = P.getDraft();
    const vip = d.vip;
    if (!vip || !vip.enabled) return;
    const mustCipher = vip.needsCipher || !vip.enc || !vip.hash;
    if (!mustCipher) return;
    if (!vipPassword) throw new Error('برای انتشار، اول در بخش «بخش ویژه» رمز رو وارد کن تا لینک‌ها رمزنگاری بشن.');
    if (!Array.isArray(vip.links)) throw new Error('لینک‌های ویژه باز نشده‌اند — رمز ویژه را در پنل وارد کن.');
    const out = await P.encryptLinks(vip.links, vipPassword);
    const hex = await P.pbkdf2Hex(vipPassword, out.salt, out.iterations);
    d.vip.salt = out.salt; d.vip.enc = out.enc; d.vip.hash = hex; d.vip.iterations = out.iterations;
    d.vip.needsCipher = false;
  }

  /* ═══════════ SETTINGS ═══════════ */
  async function renderSettings() {
    const d = P.getDraft();
    const det = P.detectRepo();
    $('#view-settings').innerHTML = `
      <div class="pcard">
        <h2>انتشار روی گیت‌هاب</h2>
        <div class="pd">توکن فقط در مرورگر خودت (localStorage) ذخیره می‌شه و هیچ‌وقت داخل کد یا مخزن نمی‌ره. پیشنهاد: از توکن Fine-grained فقط با دسترسی همین مخزن استفاده کن.</div>
        <form id="st-token-form">
          <div class="fgroup"><label>توکن گیت‌هاب</label><input type="password" id="st-token" value="${esc(store.getToken())}" dir="ltr" placeholder="ghp_… یا github_pat_…" autocomplete="off"></div>
          <div class="frow">
            <div class="fgroup"><label>Owner</label><input id="st-owner" dir="ltr" value="${esc(det.owner || '')}" placeholder="username"></div>
            <div class="fgroup"><label>Repo</label><input id="st-repo" dir="ltr" value="${esc(det.repo || '')}" placeholder="salam-sadr-boys"></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="pbtn pbtn-primary" type="submit">ذخیره و بررسی توکن</button>
            ${store.getToken() ? '<button class="pbtn pbtn-danger" type="button" id="st-token-del">حذف توکن از این مرورگر</button>' : ''}
          </div>
          <div id="st-token-msg" class="pmsg ok" hidden></div>
        </form>
      </div>
      <div class="pcard">
        <h2>تغییر رمز مدیر</h2>
        <div class="pd">رمز فقط به‌صورت هش PBKDF2 ذخیره می‌شه. بعد از تغییر، دکمه‌ی «انتشار» رو بزن تا روی سایت اعمال بشه.</div>
        <form id="st-pass-form">
          <div class="frow">
            <div class="fgroup"><label>رمز فعلی *</label><input type="password" id="st-old" required maxlength="64"></div>
            <div class="fgroup"><label>رمز جدید (حداقل ۱۰ کاراکتر) *</label><input type="password" id="st-new" minlength="10" maxlength="64" required></div>
            <div class="fgroup"><label>تکرار رمز جدید *</label><input type="password" id="st-new2" minlength="10" maxlength="64" required></div>
          </div>
          <button class="pbtn pbtn-primary" type="submit">تغییر رمز</button>
        </form>
      </div>
      <div class="pcard">
        <h2>پشتیبان‌گیری</h2>
        <div class="pd">از همه‌ی داده‌ها فایل JSON بگیر یا نسخه‌ی قبلی رو برگردون.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="pbtn pbtn-ghost" type="button" id="st-export">دانلود پشتیبان (JSON)</button>
          <label class="pbtn pbtn-ghost" style="cursor:pointer">بازیابی از فایل<input type="file" id="st-import" accept="application/json,.json" hidden></label>
          <button class="pbtn pbtn-ghost" type="button" id="st-reset">بازگشت به نسخه‌ی منتشرشده</button>
        </div>
      </div>`;

    $('#st-token-form').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#st-token-msg');
      msg.hidden = true;
      const t = $('#st-token').value.trim();
      store.setToken(t);
      store.setRepoCfg({ owner: $('#st-owner').value.trim(), repo: $('#st-repo').value.trim() });
      if (!t) { toast('توکن حذف شد.'); renderSettings(); return; }
      try {
        const login = await P.validateToken();
        msg.className = 'pmsg ok';
        msg.textContent = 'توکن معتبره — حساب: ' + login;
        msg.hidden = false;
        toast('توکن ذخیره و تأیید شد.');
      } catch (err) {
        msg.className = 'pmsg err';
        msg.textContent = err.message;
        msg.hidden = false;
      }
    });
    const tdel = $('#st-token-del');
    if (tdel) tdel.addEventListener('click', () => { store.setToken(''); toast('توکن از این مرورگر پاک شد.'); renderSettings(); });

    $('#st-pass-form').addEventListener('submit', async e => {
      e.preventDefault();
      const oldP = $('#st-old').value, n1 = $('#st-new').value, n2 = $('#st-new2').value;
      const admin = d.admin || {};
      try {
        const oldHex = await P.pbkdf2Hex(oldP, admin.salt || '', admin.iterations || 150000);
        if (!admin.hash || !P.ctEqual(oldHex, admin.hash)) { toast('رمز فعلی درست نیست.', true); return; }
        if (n1 !== n2) { toast('دو رمز جدید یکسان نیستن.', true); return; }
        if (n1.length < 10) { toast('رمز جدید حداقل ۱۰ کاراکتر باشه.', true); return; }
        const salt = P.randomSalt();
        const hex = await P.pbkdf2Hex(n1, salt, 150000);
        d.admin = { salt, hash: hex, iterations: 150000 };
        markDirty();
        toast('رمز مدیر عوض شد — حتماً «انتشار» بزن.');
        $('#st-pass-form').reset();
      } catch (err) { toast('خطا: ' + err.message, true); }
    });

    $('#st-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(P.getDraft(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sadr-boys-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $('#st-import').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          if (!j || typeof j !== 'object' || !('homework' in j)) throw new Error('ساختار فایل معتبر نیست.');
          Object.assign(P.getDraft(), j);
          markDirty();
          toast('داده بازیابی شد — با «انتشار» اعمالش کن.');
          renderDash();
        } catch (err) { toast('فایل معتبر نیست: ' + err.message, true); }
      };
      r.readAsText(f);
    });
    $('#st-reset').addEventListener('click', () => {
      if (!confirm('پیش‌نویس با نسخه‌ی منتشرشده جایگزین بشه؟ تغییرات ذخیره‌نشده از بین می‌ره.')) return;
      const pub = JSON.parse(JSON.stringify(P.getPublished()));
      Object.keys(P.getDraft()).forEach(k => delete P.getDraft()[k]);
      Object.assign(P.getDraft(), pub);
      store.setDraft(P.getDraft());
      markClean();
      toast('به نسخه‌ی منتشرشده برگشت.');
      renderDash();
    });
  }

  /* ═══════════ APP ACCOUNTS (users & moderation) ═══════════ */
  let appUser = undefined; // undefined = unknown · null = logged out

  async function appMe() {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      const d = await r.json().catch(() => null);
      appUser = d && d.user ? d.user : null;
    } catch (e) { appUser = null; }
    return appUser;
  }

  async function appLogin(username, password) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error) || 'ورود به سامانه ناموفق بود.');
    appUser = d.user;
    return d.user;
  }

  async function appPatch(id, body) {
    const r = await fetch('/api/admin/users/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error) || 'عملیات ناموفق بود.');
    return d;
  }

  const MUTE_OPTS = [
    { v: '1', n: 'سکوت ۱ ساعته' }, { v: '6', n: 'سکوت ۶ ساعته' },
    { v: '24', n: 'سکوت ۱ روزه' }, { v: '72', n: 'سکوت ۳ روزه' },
    { v: '168', n: 'سکوت ۱ هفته‌ای' }
  ];
  const ROLE_FA = { STUDENT: 'دانش‌آموز', MODERATOR: 'ناظر', CONTENT_EDITOR: 'ویراستار', ADMIN: 'مدیر', SUPER_ADMIN: 'مدیر ارشد' };

  function statusChip(u) {
    if (u.isBanned) return '<i class="uchip u-red">مسدود</i>';
    if (u.mutedUntil && new Date(u.mutedUntil) > new Date())
      return '<i class="uchip u-amber">سکوت تا ' + fmtDT(u.mutedUntil) + '</i>';
    return '<i class="uchip u-green">فعال</i>';
  }

  async function renderUsers() {
    const view = $('#view-users');
    if (appUser === undefined) await appMe();

    if (!appUser) {
      view.innerHTML = `
        <div class="pcard">
          <h2>کاربران سایت</h2>
          <div class="pd">برای دیدن اعضای ثبت‌نام‌شده و دادن سکوت/مسدودی، اول با حساب مدیرِ سامانه وارد شو.</div>
          <form id="au-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px">
            <label class="plabel">نام کاربری<input id="au-user" dir="ltr" placeholder="admin"></label>
            <label class="plabel">رمز سامانه<input id="au-pass" type="password" placeholder="رمز مدیر"></label>
            <button class="pbtn pbtn-primary" type="submit">ورود به سامانه</button>
          </form>
          <div id="au-msg" class="pmsg err" hidden></div>
        </div>`;
      $('#au-form').addEventListener('submit', async e => {
        e.preventDefault();
        const msg = $('#au-msg');
        msg.hidden = true;
        try {
          await appLogin($('#au-user').value.trim().toLowerCase() || 'admin', $('#au-pass').value);
          toast('به سامانه وصل شدی.');
          renderUsers();
        } catch (err) {
          msg.textContent = err.message;
          msg.hidden = false;
        }
      });
      return;
    }

    const canMod = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(appUser.role);
    if (!canMod) {
      view.innerHTML = `<div class="pcard"><h2>کاربران سایت</h2>
        <div class="pd">حساب «${esc(appUser.username)}» دسترسی مدیریتی نداره. با حساب مدیر اصلی وارد شو.</div>
        <button class="pbtn pbtn-ghost" type="button" id="au-switch">ورود با حساب دیگر</button></div>`;
      $('#au-switch').addEventListener('click', () => {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
        appUser = null;
        renderUsers();
      });
      return;
    }

    view.innerHTML = `
      <div class="pcard">
        <h2>کاربران سایت</h2>
        <div class="pd">وصل است به‌عنوان «${esc(appUser.displayName)}» — همه‌ی اعداد واقعی‌اند. سکوت موفق یعنی کاربر تا زمان مشخصی نمی‌تواند در چت پیام بدهد.</div>
        <div style="display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap">
          <input id="au-q" placeholder="جست‌وجوی نام یا نام کاربری…" style="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit">
          <button class="pbtn pbtn-ghost" type="button" id="au-refresh">تازه‌سازی</button>
          <button class="pbtn pbtn-ghost" type="button" id="au-logout-app">خروج از سامانه</button>
        </div>
        <div id="au-list" class="au-list"><div class="pd">در حال خواندن…</div></div>
      </div>`;

    $('#au-refresh').addEventListener('click', loadUsers);
    $('#au-logout-app').addEventListener('click', async () => {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
      appUser = null;
      renderUsers();
    });
    let qT;
    $('#au-q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(loadUsers, 250); });

    async function loadUsers() {
      const list = $('#au-list');
      if (!list) return;
      try {
        const q = $('#au-q').value.trim();
        const r = await fetch('/api/admin/users' + (q ? '?q=' + encodeURIComponent(q) : ''), { cache: 'no-store' });
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error((d && d.error) || 'خواندن کاربران ناموفق بود.');
        const items = d.items || [];
        if (!items.length) {
          list.innerHTML = '<div class="pd">هنوز کسی ثبت‌نام نکرده. به‌محض اولین عضویت، همین‌جا ظاهر می‌شه.</div>';
          return;
        }
        list.innerHTML = items.map(u => `
          <div class="urow" data-id="${esc(u.id)}">
            <div class="u-main">
              <b>${esc(u.displayName)}</b>
              <span dir="ltr">@${esc(u.username)}</span>
              ${u.grade ? `<i class="uchip u-t">${esc(u.grade.shortName || '')}</i>` : ''}
              ${u.isVip ? '<i class="uchip u-gold">VIP</i>' : ''}
              ${ROLE_FA[u.role] && u.role !== 'STUDENT' ? `<i class="uchip u-red">${ROLE_FA[u.role]}</i>` : ''}
              ${statusChip(u)}
            </div>
            <div class="u-meta">
              <span>عضویت: ${fmtD(u.createdAt)}</span>
              <span>آخرین بازدید: ${fmtD(u.lastSeenAt)}</span>
              <span>پیام‌ها: ${faNum(u.messageCount)}</span>
              ${u.isBanned && u.banReason ? `<span>دلیل مسدودی: ${esc(u.banReason)}</span>` : ''}
            </div>
            <div class="u-actions">
              <select class="u-mute" data-id="${esc(u.id)}" ${u.isBanned ? 'disabled' : ''}>
                <option value="">سکوت موقت…</option>
                ${u.mutedUntil && new Date(u.mutedUntil) > new Date() ? '<option value="0">رفع سکوت (پایان سکوت)</option>' : ''}
                ${MUTE_OPTS.map(o => `<option value="${o.v}">${o.n}</option>`).join('')}
              </select>
              ${u.isBanned
            ? `<button class="pbtn pbtn-ghost u-act" data-act="unban" data-id="${esc(u.id)}">رفع مسدودی</button>`
            : `<button class="pbtn pbtn-ghost u-act" data-act="ban" data-id="${esc(u.id)}">مسدود کردن</button>`}
              ${u.isVip
            ? `<button class="pbtn pbtn-ghost u-act" data-act="unvip" data-id="${esc(u.id)}">گرفتن VIP</button>`
            : `<button class="pbtn pbtn-ghost u-act" data-act="vip" data-id="${esc(u.id)}" ${u.isBanned ? 'disabled' : ''}>دادن VIP (۳۰ روز)</button>`}
            </div>
          </div>`).join('');

        list.querySelectorAll('.u-act').forEach(b => b.addEventListener('click', async () => {
          const id = b.dataset.id, act = b.dataset.act;
          try {
            if (act === 'ban') {
              const reason = prompt('دلیل مسدودی رو بنویس (برای خود کاربر نمایش داده می‌شه):', 'نقض قوانین چت');
              if (reason === null) return;
              await appPatch(id, { ban: true, banReason: reason || 'نقض قوانین سامانه' });
              toast('کاربر مسدود شد.');
            } else if (act === 'unban') {
              await appPatch(id, { ban: false });
              toast('مسدودی برداشته شد.');
            } else if (act === 'vip') {
              await appPatch(id, { vipAction: 'grant', vipDays: 30 });
              toast('VIP تا ۳۰ روز فعال شد.');
            } else if (act === 'unvip') {
              await appPatch(id, { vipAction: 'revoke' });
              toast('VIP گرفته شد.');
            }
            loadUsers();
          } catch (err) { toast(err.message, true); }
        }));

        list.querySelectorAll('.u-mute').forEach(sel => sel.addEventListener('change', async () => {
          const hours = sel.value;
          if (!hours) return;
          try {
            await appPatch(sel.dataset.id, { muteHours: Number(hours) });
            toast('سکوت اعمال شد.');
            loadUsers();
          } catch (err) { toast(err.message, true); }
        }));
      } catch (err) {
        list.innerHTML = '<div class="pd">' + esc(err.message) + '</div>';
      }
    }
    loadUsers();
  }

  /* ═══════════ DEBUG ═══════════ */
  async function renderDebug() {
    const view = $('#view-debug');
    view.innerHTML = `<div class="pcard"><h2>عیب‌یابی</h2><div class="pd">در حال بررسی…</div></div>`;
    const rows = [];
    let health = null;
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      health = await r.json();
    } catch (e) { health = null; }

    if (health && health.ok) {
      const db = health.db || {};
      rows.push(['اتصال به سرور', '<i class="uchip u-green">برقرار</i>']);
      rows.push(['ساعت سرور', fmtDT(health.time)]);
      rows.push(['اعضای ثبت‌نام‌شده', faNum(db.users || 0)]);
      rows.push(['پیام‌های چت', faNum(db.messages || 0)]);
      rows.push(['اتاق‌های چت', faNum(db.rooms || 0)]);
      rows.push(['تکالیف ثبت‌شده', faNum(db.homework || 0)]);
      rows.push(['اعلان‌ها', faNum(db.announcements || 0)]);
    } else {
      rows.push(['اتصال به سرور', '<i class="uchip u-red">ناموفق</i>']);
      rows.push(['توضیح', 'سامانه (چت، عضویت، دستیار) فقط روی نسخه‌ی اصلی سایت فعاله؛ روی نسخه‌ی استاتیک GitHub Pages در دسترس نیست.']);
    }

    if (appUser === undefined) await appMe();
    rows.push(['ورود مدیر به سامانه', appUser ? '<i class="uchip u-green">' + esc(appUser.username) + '</i>' : '<i class="uchip u-amber">وارد نشده</i>']);
    rows.push(['داده‌ی سایت (data.json)', P.getDraft() && P.getDraft().version ? '<i class="uchip u-green">سالم (v' + faNum(P.getDraft().version) + ')</i>' : '<i class="uchip u-red">نامشخص</i>']);
    rows.push(['توکن انتشار GitHub', store.getToken() ? '<i class="uchip u-green">ذخیره شده</i>' : '<i class="uchip u-amber">هنوز وارد نشده</i>']);

    view.innerHTML = `<div class="pcard">
      <h2>عیب‌یابی</h2>
      <div class="pd">وضعیت لحظه‌ای سامانه — همه‌چیز واقعی و زنده.</div>
      <div class="dbg-grid">
        ${rows.map(r => `<div class="dbg-row"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}
      </div>
      <div class="pd" style="margin-top:10px">نکته: چت و دستیار هوشمند به سرور نیاز دارن — روی نشانی اصلی سایت تست کن، نه نسخه‌ی استاتیک.</div>
    </div>`;
  }

  /* ═══════════ PUBLISH ═══════════ */
  async function doPublish() {
    const btn = $('#btn-publish');
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = 'در حال انتشار…';
    try {
      await applyVipCipher();
      const out = await P.publish();
      markClean();
      toast('انتشار موفق! پس از ۱ تا ۲ دقیقه روی سایت اعمال می‌شه.');
      if (out && out.commitUrl) window.open(out.commitUrl, '_blank', 'noopener');
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }
  function doPreview() {
    P.saveDraft();
    store.setPreview(P.getDraft());
    window.open('../index.html?preview=' + Date.now(), '_blank', 'noopener');
    toast('پیش‌نمایش در تب جدید باز شد — در سایت دکمه‌ی «بازگشت» پایین صفحه هست.');
  }

  /* ── date fmt ── */
  function fmtDT(v) {
    try { return new Date(v).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return esc(v); }
  }
  function fmtD(v) {
    try { return new Date(v).toLocaleDateString('fa-IR'); }
    catch (e) { return esc(v); }
  }

  /* ── boot ── */
  document.addEventListener('DOMContentLoaded', () => {
    $('#auth-screen').style.display = 'none';
    initAuth();
  });
})();
