// المخزن المحلي: الأحداث المولّدة + تعديلات المستخدم فوقها + أحداث مخصصة + الإعدادات
import { buildRange } from './schedule.js';
import { addDays, daysBetween, toIso } from './dates.js';
import { setQuranCompletion, clearQuranCache } from './quran.js';
import { setWorkoutCompletion } from './workout.js';

export const SCHEDULE_START = '2026-07-31'; // أول يوم مبني (الجمعة)
const DEFAULT_END = '2026-08-28'; // نهاية الشهر الأول للتمرين (الجمعة الرابعة)

const K = {
  settings: 'hc.settings.v1',
  edits: 'hc.edits.v1',
  done: 'hc.done.v1',
  custom: 'hc.custom.v1',
  checks: 'hc.checks.v1',
  food: 'hc.food.v1',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export const settings = Object.assign(
  { endDate: DEFAULT_END, clientId: '', view: '', anchor: null, hiddenGroups: [], weight: 70 },
  load(K.settings, {})
);
export function saveSettings() {
  save(K.settings, settings);
}

let edits = load(K.edits, {});
let done = load(K.done, {});
let custom = load(K.custom, []);
let checks = load(K.checks, {});

// توليد تلقائي شهرًا بشهر: «شهر التمرين» كتلة ٢٨ يومًا (سبت←جمعة ×٤) تبدأ من ١ أغسطس ٢٠٢٦.
// عند دخول كتلة جديدة يتمدد الجدول ليغطيها كاملة، والتقدّم (التمرين والقرآن) يستمر حتميًا بلا انقطاع.
const BLOCK_START = '2026-08-01';
(function autoExtend() {
  const t = new Date();
  const today = toIso(t.getFullYear(), t.getMonth() + 1, t.getDate());
  const off = Math.max(0, daysBetween(BLOCK_START, today));
  const need = addDays(BLOCK_START, (Math.floor(off / 28) + 1) * 28 - 1);
  if (settings.endDate < need) {
    settings.endDate = need;
    saveSettings();
  }
})();

// المجموعات (تقاويم جانبية) حسب اللون
export function groupOf(ev) {
  if (ev.external) return 'external';
  return { 9: 'prayers', 10: 'growth', 6: 'work', 8: 'rest' }[ev.colorId] || 'work';
}

// ── التقدّم مشروط بالإنجاز ──
// الأيام الماضية غير المعلَّمة لا تتقدم (تُعاد مهمتها في اليوم التالي)،
// واليوم فصاعدًا يُفترض إنجازه حتى تُعرض الخطة المثالية من موضعك الحقيقي.
function localToday() {
  const t = new Date();
  return toIso(t.getFullYear(), t.getMonth() + 1, t.getDate());
}
setQuranCompletion((d) => {
  if (d >= localToday()) return { review: true, hifz: true };
  const dn = !!done[`${d}#quran`];
  const arr = checks[`${d}#quran`] || [];
  // البند ١ = التسميع، البند ٢ = الحفظ/التكرار (فهرسا السطرين ٠ و١)
  return { review: dn || arr.includes(0), hifz: dn || arr.includes(1) };
});
setWorkoutCompletion((d) => {
  if (d >= localToday()) return true;
  return !!done[`${d}#train`] || (checks[`${d}#train`] || []).length > 0;
});

let cache = null;
export function invalidate() {
  cache = null;
  clearQuranCache(); // حالة القرآن تعتمد على الإنجاز فتُعاد محاكاتها
}

export function allEvents() {
  if (cache) return cache;
  const base = buildRange(SCHEDULE_START, settings.endDate);
  const out = [];
  for (const ev of base) {
    const patch = edits[ev.id];
    if (patch?.deleted) continue;
    const merged = patch ? { ...ev, ...patch } : ev;
    merged.done = !!done[ev.id];
    out.push(merged);
  }
  for (const c of custom) out.push({ ...c, custom: true, done: !!done[c.id] });
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  cache = out;
  return out;
}

export function eventById(id) {
  return allEvents().find((e) => e.id === id);
}

export function updateEvent(id, patch) {
  const idx = custom.findIndex((c) => c.id === id);
  if (idx >= 0) {
    custom[idx] = { ...custom[idx], ...patch };
    save(K.custom, custom);
  } else {
    edits[id] = { ...(edits[id] || {}), ...patch };
    save(K.edits, edits);
  }
  invalidate();
}

export function deleteEvent(id) {
  const idx = custom.findIndex((c) => c.id === id);
  if (idx >= 0) {
    custom.splice(idx, 1);
    save(K.custom, custom);
  } else {
    edits[id] = { ...(edits[id] || {}), deleted: true };
    save(K.edits, edits);
  }
  invalidate();
}

let customSeq = load('hc.seq.v1', 1);
export function createEvent(ev) {
  const id = `c${customSeq++}`;
  save('hc.seq.v1', customSeq);
  custom.push({ ...ev, id });
  save(K.custom, custom);
  invalidate();
  return id;
}

// سجل الطعام اليومي (سعرات وماكروز لكل تاريخ)
let food = load(K.food, {});
export function foodFor(d) {
  return food[d] || { kcal: 0, p: 0, c: 0, f: 0 };
}
export function addFood(d, add) {
  const cur = foodFor(d);
  food[d] = {
    kcal: cur.kcal + (+add.kcal || 0),
    p: cur.p + (+add.p || 0),
    c: cur.c + (+add.c || 0),
    f: cur.f + (+add.f || 0),
  };
  save(K.food, food);
}
export function resetFood(d) {
  delete food[d];
  save(K.food, food);
}

// قائمة التأشير داخل وصف الحدث: أرقام الأسطر المؤشَّرة لكل حدث
export function checksFor(id) {
  return checks[id] || [];
}

export function toggleCheck(id, lineIdx) {
  const set = new Set(checks[id] || []);
  if (set.has(lineIdx)) set.delete(lineIdx);
  else set.add(lineIdx);
  if (set.size) checks[id] = [...set];
  else delete checks[id];
  save(K.checks, checks);
  invalidate(); // التأشير قد يغيّر تقدّم الأيام التالية
}

// الوصف مع علامات ✔ على الأسطر المؤشَّرة — يُستخدم عند الدفع إلى Google والتصدير
export function decorateDesc(ev) {
  const marked = new Set(checksFor(ev.id));
  if (!ev.desc || !marked.size) return ev.desc || '';
  return ev.desc.split('\n').map((ln, i) => (marked.has(i) ? `✔ ${ln}` : ln)).join('\n');
}

export function toggleDone(id) {
  if (done[id]) delete done[id];
  else done[id] = true;
  save(K.done, done);
  invalidate();
}

export function resetAllEdits() {
  edits = {};
  save(K.edits, edits);
  invalidate();
}

export function extendSchedule(days = 7) {
  settings.endDate = addDays(settings.endDate, days);
  saveSettings();
  invalidate();
  return settings.endDate;
}
