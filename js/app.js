// تقويم هيثم — واجهة بأسلوب Google Calendar (RTL)
import { addDays, dow, arab, DAY_NAMES, MONTH_NAMES, parseIso, toIso } from './dates.js';
import { COLOR_HEX } from './schedule.js';
import {
  settings, saveSettings, allEvents, eventById, updateEvent, deleteEvent, createEvent,
  toggleDone, resetAllEdits, extendSchedule, groupOf, invalidate, SCHEDULE_START,
  checksFor, toggleCheck, decorateDesc, foodFor, addFood, resetFood,
} from './store.js';
import { downloadIcs } from './ics.js';
import * as gcal from './gcal.js';
import { quranStateFor } from './quran.js';
import { strengthSnapshot } from './workout.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

// ───── الحالة ─────
function todayIso() {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
let anchor = todayIso();
// على الجوال يبدأ بعرض «يوم» (كتطبيق Google Calendar)، وعلى الشاشات الكبيرة «أسبوع»
let view = settings.view || (window.innerWidth <= 640 ? 'day' : 'week');
let miniAnchor = anchor;
let pulled = []; // أحداث Google المسحوبة (للعرض فقط)
let hidden = new Set(settings.hiddenGroups || []);
let searchQuery = '';

const HEX = { ...COLOR_HEX, 7: '#039be5', 1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 11: '#d50000' };
const colorOf = (ev) => HEX[ev.colorId] || '#039be5';

const weekStart = (d) => addDays(d, -((dow(d) - 6 + 7) % 7)); // الأسبوع يبدأ السبت
const dayName = (d) => DAY_NAMES[dow(d)];

function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 || 12;
  return m === 0 ? `${arab(h12)} ${ap}` : `${arab(h12)}:${arab(String(m).padStart(2, '0'))} ${ap}`;
}
const timeOf = (iso) => iso.slice(11);
const dateOf = (iso) => iso.slice(0, 10);
const minOf = (iso) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);

function fmtDateLong(d) {
  const p = parseIso(d);
  return `${dayName(d)}، ${arab(p.d)} ${MONTH_NAMES[p.m - 1]} ${arab(p.y)}`;
}

// ───── الأحداث المرئية ─────
function visibleEvents() {
  const evs = [...allEvents(), ...pulled];
  return evs.filter((e) => !hidden.has(groupOf(e)));
}
function eventsTouchingDay(evs, d) {
  const d0 = `${d}T00:00`, d1 = `${addDays(d, 1)}T00:00`;
  return evs.filter((e) => e.start < d1 && e.end > d0);
}

// ───── العنوان ─────
function updateTitle() {
  const p = parseIso(anchor);
  let t = '';
  if (view === 'day') t = fmtDateLong(anchor);
  else if (view === 'month') t = `${MONTH_NAMES[p.m - 1]} ${arab(p.y)}`;
  else {
    const ws = weekStart(anchor), we = addDays(ws, 6);
    const a = parseIso(ws), b = parseIso(we);
    t = a.m === b.m ? `${MONTH_NAMES[a.m - 1]} ${arab(a.y)}` : `${MONTH_NAMES[a.m - 1]} – ${MONTH_NAMES[b.m - 1]} ${arab(b.y)}`;
  }
  $('#rangeTitle').textContent = t;
  $('#logoDay').textContent = arab(parseIso(todayIso()).d);
}

// ───── الشبكة الزمنية (أسبوع/يوم) ─────
let nowLineEl = null, lastRenderDay = null;

function renderTimeGrid(days) {
  const main = $('#main');
  main.innerHTML = '';
  nowLineEl = null;

  const outer = el('div', 'grid-outer'); // يسمح بالتمرير الأفقي للأسبوع على الجوال
  const header = el('div', 'grid-header' + (days.length > 1 ? ' wk' : ''));
  const gh = el('div', 'gh-gutter');
  gh.appendChild(el('div', 'tz', 'GMT+٣'));
  header.appendChild(gh);
  for (const d of days) {
    const h = el('div', 'gh-day' + (d === todayIso() ? ' today' : ''));
    h.appendChild(el('div', 'gh-name', dayName(d)));
    const num = el('div', 'gh-num', arab(parseIso(d).d));
    num.onclick = () => { anchor = d; setView('day'); };
    h.appendChild(num);
    header.appendChild(h);
  }
  outer.appendChild(header);

  const scroll = el('div', 'grid-scroll');
  const body = el('div', 'grid-body' + (days.length > 1 ? ' wk' : ''));
  const gutter = el('div', 'gutter-col');
  for (let i = 1; i < 24; i++) {
    const lab = el('div', 'hour-label', fmt12(`${String(i).padStart(2, '0')}:00`));
    lab.style.top = `${i * 48}px`;
    gutter.appendChild(lab);
  }
  body.appendChild(gutter);

  const evs = visibleEvents();
  for (const d of days) {
    const col = el('div', 'day-col');
    col.dataset.date = d;
    for (let i = 1; i < 24; i++) {
      const line = el('div', 'hour-line');
      line.style.top = `${i * 48}px`;
      col.appendChild(line);
    }
    // مقاطع أحداث اليوم (مع قصّ ما يعبر منتصف الليل)
    const segs = eventsTouchingDay(evs, d).map((e) => {
      const d0 = `${d}T00:00`, d1 = `${addDays(d, 1)}T00:00`;
      const s = e.start > d0 ? minOf(e.start) : 0;
      const en = e.end < d1 ? minOf(e.end) : 1440;
      return { e, s, en };
    }).sort((a, b) => a.s - b.s || b.en - a.en);
    // توزيع الأعمدة عند التداخل (مع أحداث Google الخارجية)
    const lanes = [];
    for (const seg of segs) {
      let lane = 0;
      while (lanes[lane] > seg.s) lane++;
      lanes[lane] = seg.en;
      seg.lane = lane;
    }
    const laneCount = Math.max(1, lanes.length);
    for (const seg of segs) {
      const { e, s, en } = seg;
      const chip = el('div', 'chip');
      const h = Math.max(((en - s) / 60) * 48 - 2, 12);
      chip.style.top = `${(s / 60) * 48 + 1}px`;
      chip.style.height = `${h}px`;
      if (laneCount > 1) {
        chip.style.insetInlineStart = `${2 + (seg.lane * 96) / laneCount}%`;
        chip.style.insetInlineEnd = `${2 + ((laneCount - 1 - seg.lane) * 96) / laneCount}%`;
      }
      const c = colorOf(e);
      if (e.transparent) {
        chip.classList.add('free');
        chip.style.color = c;
        chip.style.borderColor = c;
      } else {
        chip.style.background = c;
      }
      if (e.done) chip.classList.add('done');
      const label = (e.done ? '✓ ' : '') + esc(e.title);
      if (h < 24) {
        chip.classList.add('tiny');
        chip.innerHTML = `<span class="c-title">${label}</span><span class="c-time">${fmt12(timeOf(e.start))}</span>`;
      } else {
        chip.innerHTML = `<div class="c-title">${label}</div>` +
          (h > 34 ? `<div class="c-time">${fmt12(timeOf(e.start))} – ${fmt12(timeOf(e.end))}</div>` : '');
      }
      chip.onclick = (ev2) => { ev2.stopPropagation(); openPopover(e, chip); };
      col.appendChild(chip);
    }
    if (d === todayIso()) {
      nowLineEl = el('div', 'now-line');
      col.appendChild(nowLineEl);
    }
    // نقرة على فراغ = إنشاء حدث في تلك الساعة
    col.onclick = (ev2) => {
      if (ev2.target !== col) return;
      const rect = col.getBoundingClientRect();
      const hour = Math.floor((ev2.clientY - rect.top) / 48);
      const hh = Math.min(Math.max(hour, 0), 23);
      openEditor(null, { date: d, startTime: `${String(hh).padStart(2, '0')}:00`, endTime: hh === 23 ? '23:59' : `${String(hh + 1).padStart(2, '0')}:00` });
    };
    body.appendChild(col);
  }
  scroll.appendChild(body);
  outer.appendChild(scroll);
  main.appendChild(outer);
  updateNowLine();
  // تمرير إلى الوقت الحالي (أو السادسة صباحًا)
  const nowMin = new Date().getHours() * 60;
  scroll.scrollTop = Math.max(((nowMin - 120) / 60) * 48, 0);
}

function updateNowLine() {
  if (!nowLineEl) return;
  const n = new Date();
  nowLineEl.style.top = `${((n.getHours() * 60 + n.getMinutes()) / 60) * 48}px`;
}
setInterval(() => {
  // إعادة رسم كاملة فقط عند تغيّر التاريخ (منتصف الليل)، وإلا نحرّك خط الآن وحده
  if (todayIso() !== lastRenderDay) render();
  else updateNowLine();
}, 60000);

// ───── عرض الشهر ─────
function renderMonth() {
  const main = $('#main');
  main.innerHTML = '';
  const wrap = el('div', 'month-wrap');
  const dows = el('div', 'month-dows');
  for (let i = 0; i < 7; i++) dows.appendChild(el('div', '', DAY_NAMES[(6 + i) % 7]));
  wrap.appendChild(dows);

  const p = parseIso(anchor);
  const first = toIso(p.y, p.m, 1);
  let d = weekStart(first);
  const grid = el('div', 'month-grid');
  const evs = visibleEvents();
  for (let i = 0; i < 42; i++) {
    const cell = el('div', 'm-cell');
    const cp = parseIso(d);
    if (cp.m !== p.m) cell.classList.add('other');
    if (d === todayIso()) cell.classList.add('today');
    const num = el('div', 'm-num', arab(cp.d));
    const dd = d;
    num.onclick = () => { anchor = dd; setView('day'); };
    cell.appendChild(num);
    const dayEvs = eventsTouchingDay(evs, d).filter((e) => dateOf(e.start) === dd);
    const maxShow = 3;
    for (const e of dayEvs.slice(0, maxShow)) {
      const chip = el('div', 'm-chip', `${fmt12(timeOf(e.start))} ${esc(e.title)}`);
      const c = colorOf(e);
      if (e.transparent) { chip.classList.add('free'); chip.style.color = c; chip.style.border = `1px solid ${c}`; }
      else chip.style.background = c;
      chip.onclick = (ev2) => { ev2.stopPropagation(); openPopover(e, chip); };
      cell.appendChild(chip);
    }
    if (dayEvs.length > maxShow) {
      const more = el('div', 'm-more', `${arab(dayEvs.length - maxShow)} أخرى`);
      more.onclick = () => { anchor = dd; setView('day'); };
      cell.appendChild(more);
    }
    grid.appendChild(cell);
    d = addDays(d, 1);
  }
  wrap.appendChild(grid);
  main.appendChild(wrap);
}

// ───── عرض الجدول ─────
function renderAgenda() {
  const main = $('#main');
  main.innerHTML = '';
  const list = el('div', 'agenda');
  const evs = visibleEvents();
  let days;
  if (searchQuery) {
    const q = searchQuery;
    const matches = evs.filter((e) => e.title.includes(q) || (e.desc || '').includes(q));
    days = [...new Set(matches.map((e) => dateOf(e.start)))].sort();
    if (!days.length) list.appendChild(el('div', 'ag-day', `<div style="padding:20px;color:#70757a">لا نتائج للبحث «${esc(q)}»</div>`));
    for (const d of days) renderAgendaDay(list, d, matches.filter((e) => dateOf(e.start) === d));
  } else {
    const ws = weekStart(anchor);
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      renderAgendaDay(list, d, evs.filter((e) => dateOf(e.start) === d));
    }
  }
  main.appendChild(list);
}

function renderAgendaDay(list, d, dayEvs) {
  if (!dayEvs.length) return;
  const day = el('div', 'ag-day');
  const date = el('div', 'ag-date' + (d === todayIso() ? ' today' : ''));
  date.innerHTML = `<div class="n">${arab(parseIso(d).d)}</div><div class="w">${dayName(d)}، ${MONTH_NAMES[parseIso(d).m - 1]}</div>`;
  date.onclick = () => { anchor = d; setView('day'); };
  day.appendChild(date);
  const items = el('div', 'ag-list');
  for (const e of dayEvs.sort((a, b) => (a.start < b.start ? -1 : 1))) {
    const it = el('div', 'ag-item' + (e.done ? ' done' : ''));
    it.innerHTML = `<span class="dot" style="background:${colorOf(e)}"></span>` +
      `<span class="t">${fmt12(timeOf(e.start))} – ${fmt12(timeOf(e.end))}</span>` +
      `<span class="s">${(e.done ? '✓ ' : '') + esc(e.title)}</span>`;
    it.onclick = (ev2) => { ev2.stopPropagation(); openPopover(e, it); };
    items.appendChild(it);
  }
  day.appendChild(items);
  list.appendChild(day);
}

// ───── التقويم المصغر ─────
function renderMini() {
  const root = $('#miniCal');
  root.innerHTML = '';
  const p = parseIso(miniAnchor);
  const head = el('div', 'mini-head');
  head.appendChild(el('div', 'mini-title', `${MONTH_NAMES[p.m - 1]} ${arab(p.y)}`));
  const nav = el('div', 'mini-nav');
  const prev = el('button', '', '›'), next = el('button', '', '‹');
  prev.onclick = () => { miniAnchor = toIso(p.m === 1 ? p.y - 1 : p.y, p.m === 1 ? 12 : p.m - 1, 1); renderMini(); };
  next.onclick = () => { miniAnchor = toIso(p.m === 12 ? p.y + 1 : p.y, p.m === 12 ? 1 : p.m + 1, 1); renderMini(); };
  nav.append(prev, next);
  head.appendChild(nav);
  root.appendChild(head);
  const grid = el('div', 'mini-grid');
  for (let i = 0; i < 7; i++) grid.appendChild(el('div', 'dow', DAY_NAMES[(6 + i) % 7].slice(2, 3) === '' ? '' : 'سحنثرخج'[i] || ''));
  // أسماء مختصرة: س ح ن ث ر خ ج
  grid.querySelectorAll('.dow').forEach((n, i) => (n.textContent = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'][i]));
  let d = weekStart(toIso(p.y, p.m, 1));
  for (let i = 0; i < 42; i++) {
    const cp = parseIso(d);
    const cell = el('div', 'mini-day', arab(cp.d));
    if (cp.m !== p.m) cell.classList.add('other');
    if (d === todayIso()) cell.classList.add('today');
    if (d === anchor) cell.classList.add('selected');
    const dd = d;
    cell.onclick = () => { anchor = dd; render(); };
    grid.appendChild(cell);
    d = addDays(d, 1);
  }
  root.appendChild(grid);
}

// ───── لوحة اليوم الجانبية ─────
const NUMBERED = /^[٠-٩]+\.\s/;

// ملاحظات ملزمة تظهر دائمًا في اللوحة
const BINDING_NOTES = [
  'ملاحظات الصلاة: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة',
  'متعة الجوال ممنوعة',
  'الصلاة على النبي في الفراغ',
  'تحدث الإنجليزية أو سماع بودكاست في السيارة',
  'متابعة الأخبار في الخلاء',
];

// أهداف التغذية من الوزن — رجل نشيط: عمل طويل، نوم قليل، ٣ أيام تمرين ← صيانة ≈ ٣٤ سعرة/كجم
function nutritionTargets(w) {
  const kcal = Math.round(w * 34);
  const protein = Math.round(w * 2); // ٢ غ/كجم
  const fat = Math.round(w * 0.9); // ٠٫٩ غ/كجم
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4); // الباقي كربوهيدرات
  return { kcal, protein, fat, carbs };
}
const durMin = (e) => Math.round((new Date(e.end) - new Date(e.start)) / 60000);
function fmtDur(min) {
  if (min <= 0) return '٠ د';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${arab(h)} س${m ? ` ${arab(m)} د` : ''}` : `${arab(m)} د`;
}

function renderDashboard() {
  const root = $('#dashboard');
  if (!root) return;
  root.innerHTML = '';
  const d = anchor;
  const p = parseIso(d);
  root.appendChild(el('h3', '', `لوحة اليوم — ${dayName(d)} ${arab(p.d)} ${MONTH_NAMES[p.m - 1]}`));

  const evs = allEvents().filter((e) => e.unit === d);

  // ١) إنجاز اليوم: الأحداث الفعلية (بلا نوم وراحة) — ✅ أو نسبة بنودها المؤشَّرة
  const actionable = evs.filter((e) => !['sleep1', 'sleep2', 'nap', 'rest'].includes(e.slot));
  let score = 0;
  for (const e of actionable) {
    if (e.done) { score += 1; continue; }
    const lines = (e.desc || '').split('\n');
    const idx = [];
    lines.forEach((ln, i) => { if (NUMBERED.test(ln)) idx.push(i); });
    if (idx.length) {
      const marked = new Set(checksFor(e.id));
      score += idx.filter((i) => marked.has(i)).length / idx.length;
    }
  }
  const pct = actionable.length ? Math.round((score / actionable.length) * 100) : 0;
  const cDone = el('div', 'dash-card');
  cDone.innerHTML = `<div class="dash-title">إنجاز اليوم <span class="pct">${arab(pct)}٪</span></div>
    <div class="dash-bar green"><div style="width:${pct}%"></div></div>
    <div class="dash-row"><span>أحداث مكتملة ✅</span><span class="v">${arab(actionable.filter((e) => e.done).length)} من ${arab(actionable.length)}</span></div>`;
  root.appendChild(cDone);

  // ٢) متتبع القرآن
  const st = quranStateFor(d < SCHEDULE_START ? SCHEDULE_START : d);
  const hifzProg = Math.round((((st.hifzQuarter - 1) + (st.hifzMode === 'تكرار' ? 0.5 : 0)) / 8) * 100);
  const cQuran = el('div', 'dash-card');
  cQuran.innerHTML = `<div class="dash-title">القرآن</div>
    <div class="dash-row"><span>التسميع</span><span class="v">الجزء ${arab(st.reviewJuz)} (دورة ١–${arab(st.hifzJuz - 3)})</span></div>
    <div class="dash-row"><span>الحفظ</span><span class="v">${st.hifzMode} الربع ${arab(st.hifzQuarter)} من الجزء ${arab(st.hifzJuz)}</span></div>
    <div class="dash-row"><span>التثبيت</span><span class="v">الجزءان ${arab(st.hifzJuz - 2)} و${arab(st.hifzJuz - 1)}</span></div>
    <div class="dash-bar green"><div style="width:${hifzProg}%"></div></div>
    <div class="dash-row"><span>تقدّم جزء الحفظ</span><span class="v">${arab(hifzProg)}٪</span></div>`;
  root.appendChild(cQuran);

  // ٣) قوتك الآن (أهداف الجلسة القادمة)
  const snap = strengthSnapshot(d < SCHEDULE_START ? SCHEDULE_START : d);
  const cStr = el('div', 'dash-card');
  cStr.innerHTML = `<div class="dash-title">قوتك الآن</div>` + snap.map((s) =>
    s.seconds != null
      ? `<div class="dash-row"><span>${s.name}</span><span class="v">${arab(s.seconds)} ث</span></div>`
      : `<div class="dash-row"><span>${s.name}</span><span class="v">${arab(s.weight)} كجم × ${arab(s.reps)}</span></div>`
  ).join('');
  root.appendChild(cStr);

  // ٤) ساعات اليوم
  const sum = (slots) => evs.filter((e) => slots.includes(e.slot)).reduce((a, e) => a + durMin(e), 0);
  const cHrs = el('div', 'dash-card');
  cHrs.innerHTML = `<div class="dash-title">ساعات اليوم</div>
    <div class="dash-row"><span>${dow(d) === 5 ? 'عائلة' : 'عمل'}</span><span class="v">${fmtDur(sum(['work1', 'work2', 'work3']))}</span></div>
    <div class="dash-row"><span>نوم</span><span class="v">${fmtDur(sum(['sleep1', 'sleep2', 'nap']))}</span></div>
    <div class="dash-row"><span>${dow(d) === 5 || dow(d) === 6 ? 'راحة' : 'زوجة'}</span><span class="v">${fmtDur(sum(['rest']))}</span></div>
    <div class="dash-row"><span>أسرة</span><span class="v">${fmtDur(sum(['family']))}</span></div>`;
  root.appendChild(cHrs);

  // ٥) التغذية — الهدف من الوزن + تسجيل وجبات اليوم
  const w = settings.weight || 70;
  const tgt = nutritionTargets(w);
  const eaten = foodFor(d);
  const pctK = Math.min(100, Math.round((eaten.kcal / tgt.kcal) * 100) || 0);
  const pctP = Math.min(100, Math.round((eaten.p / tgt.protein) * 100) || 0);
  const cFood = el('div', 'dash-card');
  cFood.innerHTML = `<div class="dash-title">التغذية <span class="v">الوزن <input id="wtIn" type="number" min="30" max="200" value="${w}"> كجم</span></div>
    <div class="dash-row"><span>هدفك اليومي</span><span class="v">${arab(tgt.kcal)} سعرة</span></div>
    <div class="dash-row"><span>بروتين ${arab(tgt.protein)} غ</span><span class="v">كارب ${arab(tgt.carbs)} غ • دهون ${arab(tgt.fat)} غ</span></div>
    <div class="dash-row"><span>أكلت</span><span class="v">${arab(eaten.kcal)} / ${arab(tgt.kcal)} سعرة</span></div>
    <div class="dash-bar"><div style="width:${pctK}%"></div></div>
    <div class="dash-row"><span>بروتين</span><span class="v">${arab(eaten.p)} / ${arab(tgt.protein)} غ</span></div>
    <div class="dash-bar green"><div style="width:${pctP}%"></div></div>
    <div class="dash-food">
      <input id="fK" type="number" placeholder="سعرات"><input id="fP" type="number" placeholder="بروتين">
      <input id="fC" type="number" placeholder="كارب"><input id="fF" type="number" placeholder="دهون">
      <button id="fAdd" title="أضف الوجبة">＋</button><button id="fReset" title="تصفير اليوم">↺</button>
    </div>`;
  root.appendChild(cFood);
  cFood.querySelector('#wtIn').onchange = (ev2) => {
    settings.weight = Math.max(30, Math.min(200, +ev2.target.value || 70));
    saveSettings();
    renderDashboard();
  };
  cFood.querySelector('#fAdd').onclick = () => {
    addFood(d, {
      kcal: cFood.querySelector('#fK').value, p: cFood.querySelector('#fP').value,
      c: cFood.querySelector('#fC').value, f: cFood.querySelector('#fF').value,
    });
    renderDashboard();
  };
  cFood.querySelector('#fReset').onclick = () => { resetFood(d); renderDashboard(); };

  // ٦) ملاحظات ملزمة
  const cNotes = el('div', 'dash-card');
  cNotes.innerHTML = `<div class="dash-title">ملاحظات ملزمة</div>` +
    BINDING_NOTES.map((n) => `<div class="dash-note">${n}</div>`).join('');
  root.appendChild(cNotes);

  // ٧) إضافة مهمة إلى «عمل» اليوم — تصير بندًا قابلًا للتأشير
  const cTask = el('div', 'dash-card');
  cTask.innerHTML = `<div class="dash-title">مهام العمل</div><div class="dash-addtask">
    <input id="taskInput" placeholder="أضف مهمة إلى عمل اليوم">
    <button id="taskAdd" title="إضافة">＋</button></div>`;
  root.appendChild(cTask);
  const addTask = () => {
    const inp = cTask.querySelector('#taskInput');
    const text = inp.value.trim();
    if (!text) return;
    const work = evs.find((e) => e.slot === 'work1') || evs.find((e) => e.slot === 'work2') || evs.find((e) => e.slot === 'work3');
    if (!work) return toast('لا يوجد بلوك عمل في هذا اليوم');
    const count = (work.desc || '').split('\n').filter((ln) => NUMBERED.test(ln)).length;
    const newDesc = (work.desc ? work.desc + '\n' : '') + `${arab(count + 1)}. ${text}`;
    updateEvent(work.id, { desc: newDesc });
    render();
    toast(`أُضيفت المهمة إلى «عمل» ${dayName(d)}`);
  };
  cTask.querySelector('#taskAdd').onclick = addTask;
  cTask.querySelector('#taskInput').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') addTask(); });
}

// ───── النافذة المنبثقة ─────
function openPopover(e, anchorEl) {
  const po = $('#popover');
  po.innerHTML = '';
  const actions = el('div', 'po-actions');
  const edit = el('button', 'icon-btn', '✎'); edit.title = 'تحرير';
  const del = el('button', 'icon-btn', '🗑'); del.title = 'حذف';
  const close = el('button', 'icon-btn', '✕'); close.title = 'إغلاق';
  edit.onclick = () => { closePopover(); openEditor(e); };
  del.onclick = () => {
    if (e.external) return toast('أحداث Google تُحرَّر من تطبيق Google Calendar نفسه');
    closePopover(); deleteEvent(e.id); render(); toast('حُذف الحدث');
  };
  close.onclick = closePopover;
  if (!e.external) actions.append(edit, del);
  actions.append(close);
  po.appendChild(actions);
  po.appendChild(el('div', 'po-title', `<span class="sq" style="background:${colorOf(e)}"></span><span>${esc(e.title)}</span>`));
  const sameDay = dateOf(e.start) === dateOf(e.end);
  const when = sameDay
    ? `${fmtDateLong(dateOf(e.start))} ⋅ ${fmt12(timeOf(e.start))} – ${fmt12(timeOf(e.end))}`
    : `${fmtDateLong(dateOf(e.start))} ${fmt12(timeOf(e.start))} ← ${fmtDateLong(dateOf(e.end))} ${fmt12(timeOf(e.end))}`;
  po.appendChild(el('div', 'po-when', when));
  if (e.desc) po.appendChild(buildChecklist(e));
  if (!e.external) {
    const doneBtn = el('button', 'po-done' + (e.done ? ' on' : ''), e.done ? '✓ أُنجز — اضغط للتراجع' : 'وضع علامة إنجاز ✅');
    doneBtn.onclick = () => { toggleDone(e.id); closePopover(); render(); };
    po.appendChild(doneBtn);
  }
  po.hidden = false;
  const r = anchorEl.getBoundingClientRect();
  const pw = 400, ph = Math.min(po.scrollHeight, window.innerHeight * 0.7);
  let x = r.left - pw - 8;
  if (x < 8) x = r.right + 8;
  if (x + pw > window.innerWidth - 8) x = Math.max((window.innerWidth - pw) / 2, 8);
  let y = Math.min(r.top, window.innerHeight - ph - 16);
  po.style.left = `${x}px`;
  po.style.top = `${Math.max(y, 8)}px`;
}
// وصف الحدث كقائمة تأشير: كل سطر مرقّم (١. …) يصير بندًا قابلًا للتأشير، وحالته تُحفَظ
function buildChecklist(e) {
  const wrap = el('div', 'chk-list');
  const lines = e.desc.split('\n');
  const marked = new Set(checksFor(e.id));
  const numbered = [];
  lines.forEach((ln, i) => { if (/^[٠-٩]+\.\s/.test(ln)) numbered.push(i); });
  let progEl = null;
  if (numbered.length && !e.external) {
    progEl = el('div', 'chk-progress');
    wrap.appendChild(progEl);
  }
  const updateProg = () => {
    if (!progEl) return;
    const done2 = numbered.filter((i) => marked.has(i)).length;
    progEl.textContent = `أُنجز ${arab(done2)} من ${arab(numbered.length)}`;
  };
  lines.forEach((ln, i) => {
    if (/^[٠-٩]+\.\s/.test(ln) && !e.external) {
      const item = el('label', 'chk-item' + (marked.has(i) ? ' on' : ''));
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = marked.has(i);
      cb.onchange = () => {
        toggleCheck(e.id, i);
        if (marked.has(i)) marked.delete(i); else marked.add(i);
        item.classList.toggle('on', cb.checked);
        updateProg();
        checksDirty = true; // الأيام التالية قد تتأثر — يُعاد الرسم عند إغلاق المنبثقة
        renderDashboard(); // تحديث نسبة الإنجاز فورًا
      };
      item.appendChild(cb);
      item.appendChild(el('span', '', esc(ln)));
      wrap.appendChild(item);
    } else {
      wrap.appendChild(el('div', 'chk-plain', esc(ln)));
    }
  });
  updateProg();
  return wrap;
}

let checksDirty = false;
function closePopover() {
  $('#popover').hidden = true;
  if (checksDirty) {
    checksDirty = false;
    render(); // يلتقط أثر التأشير على الأيام التالية
  }
}
document.addEventListener('click', (ev) => {
  if (!$('#popover').hidden && !$('#popover').contains(ev.target)) closePopover();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { closePopover(); closeModal(); }
});

// ───── محرر الأحداث ─────
function openEditor(e, defaults = {}) {
  const isNew = !e;
  const start = e ? e.start : `${defaults.date || anchor}T${defaults.startTime || '09:00'}`;
  const end = e ? e.end : `${defaults.date || anchor}T${defaults.endTime || '10:00'}`;
  const modal = $('#modal');
  modal.innerHTML = '';
  modal.appendChild(el('h2', '', isNew ? 'إنشاء حدث' : 'تحرير الحدث'));
  const f = el('div');
  f.innerHTML = `
    <label class="fld">العنوان</label><input type="text" id="fTitle" value="${esc(e?.title || '')}">
    <div class="m-row">
      <div><label class="fld">تاريخ البداية</label><input type="date" id="fDate" value="${dateOf(start)}"></div>
      <div><label class="fld">من</label><input type="time" id="fStart" value="${timeOf(start)}"></div>
      <div><label class="fld">تاريخ النهاية</label><input type="date" id="fDateEnd" value="${dateOf(end)}"></div>
      <div><label class="fld">إلى</label><input type="time" id="fEnd" value="${timeOf(end)}"></div>
    </div>
    <label class="fld">اللون</label><div class="color-opts" id="fColors"></div>
    <label class="fld">الوصف</label><textarea id="fDesc">${esc(e?.desc || '')}</textarea>
  `;
  modal.appendChild(f);
  let colorId = e?.colorId || 6;
  const colorNames = { 9: 'الصلوات (أزرق)', 10: 'القرآن والتمرين (أخضر)', 6: 'العمل (برتقالي)', 8: 'الراحة (رمادي)' };
  const opts = f.querySelector('#fColors');
  for (const cid of [9, 10, 6, 8]) {
    const o = el('div', 'color-opt' + (cid === colorId ? ' sel' : ''));
    o.style.background = COLOR_HEX[cid];
    o.title = colorNames[cid];
    o.onclick = () => { colorId = cid; opts.querySelectorAll('.color-opt').forEach((n) => n.classList.remove('sel')); o.classList.add('sel'); };
    opts.appendChild(o);
  }
  const actions = el('div', 'm-actions');
  if (!isNew && !e.custom) {
    const note = el('div', 'hint', 'هذا حدث مولَّد من جدولك — تعديلاتك تُحفَظ فوقه وتبقى بعد إعادة التوليد.');
    modal.insertBefore(note, f);
  }
  const cancel = el('button', 'btn-outline', 'إلغاء');
  cancel.onclick = closeModal;
  const save = el('button', 'btn-primary', 'حفظ');
  save.onclick = () => {
    const title = f.querySelector('#fTitle').value.trim() || '(بلا عنوان)';
    const ns = `${f.querySelector('#fDate').value}T${f.querySelector('#fStart').value}`;
    const ne = `${f.querySelector('#fDateEnd').value}T${f.querySelector('#fEnd').value}`;
    if (ne <= ns) return toast('وقت النهاية يجب أن يكون بعد البداية');
    const desc = f.querySelector('#fDesc').value;
    if (isNew) createEvent({ title, start: ns, end: ne, colorId, desc });
    else updateEvent(e.id, { title, start: ns, end: ne, colorId, desc });
    closeModal(); render(); toast('حُفظ الحدث');
  };
  actions.append(cancel, save);
  modal.appendChild(actions);
  $('#modalOverlay').hidden = false;
}
function closeModal() { $('#modalOverlay').hidden = true; }
$('#modalOverlay').addEventListener('click', (ev) => { if (ev.target.id === 'modalOverlay') closeModal(); });

// ───── الإعدادات والمزامنة ─────
function openSettings() {
  const modal = $('#modal');
  modal.innerHTML = '';
  modal.appendChild(el('h2', '', 'الإعدادات والمزامنة'));

  const sync = el('div');
  sync.innerHTML = `
    <h3 style="font-size:15px;margin-bottom:6px">مزامنة Google Calendar</h3>
    <div class="hint">لتفعيل المزامنة المباشرة (مرة واحدة فقط):
      <ol>
        <li>افتح <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console ← Credentials</a></li>
        <li>أنشئ مشروعًا، فعّل <b>Google Calendar API</b>، وأنشئ <b>OAuth client ID</b> من نوع Web application</li>
        <li>أضف <code>http://localhost:8080</code> في Authorized JavaScript origins</li>
        <li>الصق الـ Client ID هنا واضغط «اتصال»</li>
      </ol>
      أو استخدم زر «تنزيل ملف ‎.ics» بالأسفل واستورده في Google Calendar مباشرة — بلا أي إعداد.
    </div>
    <label class="fld">Google OAuth Client ID</label>
    <input type="text" id="fClientId" dir="ltr" placeholder="xxxxx.apps.googleusercontent.com" value="${settings.clientId || ''}">
    <div class="sync-status" id="syncStatus">${gcal.isConnected() ? '✅ متصل بحساب Google' : 'غير متصل'}</div>
    <div class="progress" id="syncProg" hidden><div></div></div>
    <div class="m-actions" style="justify-content:flex-start;flex-wrap:wrap">
      <button class="btn-primary" id="bConnect">اتصال بحساب Google</button>
      <button class="btn-outline" id="bPushWeek">دفع هذا الأسبوع</button>
      <button class="btn-outline" id="bPushAll">دفع الجدول كاملًا</button>
      <button class="btn-outline" id="bPull">سحب أحداث Google للعرض</button>
    </div>
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    <h3 style="font-size:15px;margin-bottom:6px">التصدير والجدول</h3>
    <div class="m-actions" style="justify-content:flex-start;flex-wrap:wrap">
      <button class="btn-outline" id="bIcs">تنزيل ملف ‎.ics (الجدول كاملًا)</button>
      <button class="btn-outline" id="bExtend">تمديد الجدول أسبوعًا</button>
      <button class="btn-danger" id="bReset">استرجاع الأحداث الأصلية</button>
    </div>
    <div class="sync-status">الجدول مولَّد من ${arab(SCHEDULE_START)} إلى ${arab(settings.endDate)} — يتمدد تلقائيًا شهرًا بشهر (كتل ٢٨ يومًا من ١ أغسطس) مع استمرار تقدّم التمرين والقرآن، والمواقيت تُحسب فلكيًا لأي مدى.</div>
  `;
  modal.appendChild(sync);

  const status = (m) => { sync.querySelector('#syncStatus').textContent = m; };
  const prog = sync.querySelector('#syncProg');
  const onProgress = (i, n) => {
    prog.hidden = false;
    prog.firstElementChild.style.width = `${Math.round((i / n) * 100)}%`;
    status(`جارٍ الدفع… ${arab(i)} / ${arab(n)}`);
  };

  const needConnect = async () => {
    const cid = sync.querySelector('#fClientId').value.trim();
    if (!cid) { status('⚠️ الصق الـ Client ID أولًا (أو استخدم ملف ‎.ics)'); throw new Error('no-client'); }
    if (cid !== settings.clientId) { settings.clientId = cid; saveSettings(); }
    if (!gcal.isConnected()) {
      status('جارٍ فتح نافذة تسجيل الدخول…');
      await gcal.connect(cid);
      status('✅ متصل بحساب Google');
    }
  };
  sync.querySelector('#bConnect').onclick = async () => {
    try { await needConnect(); } catch (e2) { if (e2.message !== 'no-client') status(`❌ ${e2.message}`); }
  };
  const doPush = async (fromIso, toIso2) => {
    try {
      await needConnect();
      const evs = allEvents()
        .filter((e) => dateOf(e.start) >= addDays(fromIso, -1) && dateOf(e.start) <= toIso2)
        .map((e) => ({ ...e, desc: decorateDesc(e) }));
      const res = await gcal.pushEvents(evs, addDays(fromIso, -1), addDays(toIso2, 1), onProgress);
      prog.hidden = true;
      status(`✅ تم: ${arab(res.inserted)} جديد، ${arab(res.updated)} محدَّث، ${arab(res.skipped)} مطابق`);
      toast('تمت المزامنة مع Google Calendar');
    } catch (e2) { if (e2.message !== 'no-client') { prog.hidden = true; status(`❌ ${e2.message}`); } }
  };
  sync.querySelector('#bPushWeek').onclick = () => {
    const ws = weekStart(anchor);
    doPush(ws, addDays(ws, 6));
  };
  sync.querySelector('#bPushAll').onclick = () => doPush(SCHEDULE_START, settings.endDate);
  sync.querySelector('#bPull').onclick = async () => {
    try {
      await needConnect();
      status('جارٍ السحب…');
      pulled = await gcal.pullEvents(SCHEDULE_START, settings.endDate);
      status(`✅ سُحب ${arab(pulled.length)} حدثًا من Google (للعرض)`);
      render();
    } catch (e2) { if (e2.message !== 'no-client') status(`❌ ${e2.message}`); }
  };
  sync.querySelector('#bIcs').onclick = () => {
    downloadIcs(allEvents().map((e) => ({ ...e, desc: decorateDesc(e) })), 'جدول-هيثم.ics');
    toast('نُزّل الملف — استورده في Google Calendar: الإعدادات ← استيراد');
  };
  sync.querySelector('#bExtend').onclick = () => {
    const end = extendSchedule(7);
    toast(`مُدِّد الجدول حتى ${arab(end)}`);
    openSettings();
    render();
  };
  sync.querySelector('#bReset').onclick = () => {
    if (confirm('سيمحو كل تعديلاتك على الأحداث المولّدة (لا يمس أحداثك المخصصة). متابعة؟')) {
      resetAllEdits(); render(); toast('استُرجعت الأحداث الأصلية');
    }
  };

  const actions = el('div', 'm-actions');
  const close = el('button', 'btn-primary', 'إغلاق');
  close.onclick = closeModal;
  actions.appendChild(close);
  modal.appendChild(actions);
  $('#modalOverlay').hidden = false;
}

// ───── البحث ─────
$('#search').addEventListener('input', (ev) => {
  const q = ev.target.value.trim();
  const box = $('#searchResults');
  if (!q) { box.hidden = true; searchQuery = ''; if (view === 'agenda') render(); return; }
  const matches = [...allEvents(), ...pulled]
    .filter((e) => e.title.includes(q) || (e.desc || '').includes(q))
    .slice(0, 12);
  box.innerHTML = '';
  for (const e of matches) {
    const it = el('div', 'sr-item',
      `<span class="dot" style="background:${colorOf(e)}"></span><span>${esc(e.title)}</span>` +
      `<span class="sr-time">${arab(parseIso(dateOf(e.start)).d)} ${MONTH_NAMES[parseIso(dateOf(e.start)).m - 1]} ⋅ ${fmt12(timeOf(e.start))}</span>`);
    it.onclick = () => { box.hidden = true; anchor = dateOf(e.start); setView('day'); };
    box.appendChild(it);
  }
  if (!matches.length) box.innerHTML = '<div class="sr-item">لا نتائج</div>';
  box.hidden = false;
});
$('#search').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    searchQuery = ev.target.value.trim();
    $('#searchResults').hidden = true;
    setView('agenda');
  }
});
document.addEventListener('click', (ev) => {
  if (!ev.target.closest('.search-wrap')) $('#searchResults').hidden = true;
});

// ───── أدوات ─────
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// ───── التنقل ─────
function setView(v) {
  view = v;
  settings.view = v;
  saveSettings();
  $('#viewSel').value = v;
  render();
}
function nav(dir) {
  if (view === 'day') anchor = addDays(anchor, dir);
  else if (view === 'month') {
    const p = parseIso(anchor);
    const m = p.m + dir;
    anchor = toIso(m < 1 ? p.y - 1 : m > 12 ? p.y + 1 : p.y, m < 1 ? 12 : m > 12 ? 1 : m, 1);
  } else anchor = addDays(anchor, dir * 7);
  miniAnchor = anchor;
  render();
}

function render() {
  closePopover();
  lastRenderDay = todayIso();
  updateTitle();
  renderMini();
  renderDashboard();
  if (view === 'day') renderTimeGrid([anchor]);
  else if (view === 'week') {
    const ws = weekStart(anchor);
    renderTimeGrid([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i)));
  } else if (view === 'month') renderMonth();
  else renderAgenda();
}

$('#btnToday').onclick = () => { anchor = todayIso(); miniAnchor = anchor; render(); };
$('#btnPrev').onclick = () => nav(-1);
$('#btnNext').onclick = () => nav(1);
$('#viewSel').onchange = (ev) => setView(ev.target.value);
$('#btnCreate').onclick = () => openEditor(null, { date: anchor });
$('#btnSettings').onclick = openSettings;
$('#btnSync').onclick = openSettings;
$('#btnMenu').onclick = () => {
  // على الشاشات الصغيرة يفتح الشريط كطبقة عائمة، وعلى الكبيرة يخفيه
  if (window.innerWidth <= 860) $('#sidebar').classList.toggle('open');
  else $('#sidebar').classList.toggle('hidden');
};
document.querySelectorAll('.cal-item input').forEach((cb) => {
  if (hidden.has(cb.dataset.group)) cb.checked = false;
  cb.addEventListener('change', () => {
    if (cb.checked) hidden.delete(cb.dataset.group);
    else hidden.add(cb.dataset.group);
    settings.hiddenGroups = [...hidden];
    saveSettings();
    render();
  });
});

// ───── البدء ─────
$('#viewSel').value = view;
render();
