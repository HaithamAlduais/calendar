// محرك التمرين — التمارين والدورة كلها بيانات يعرّفها المستخدم.
//
// التقدّم المزدوج: زد عدة كل جلسة حتى أعلى النطاق، ثم زد الوزن وارجع إلى أدناه.
// والدورة متتابعة لا علاقة لها بأيام الأسبوع: يوم تمرين ثم يوم راحة/تطوير بالتناوب،
// وأيام التمرين تدور بالترتيب — فلا يتعلّق صاحبها بيومٍ من الأسبوع بعينه.
import { addDays, daysBetween, arab } from './dates.js';

const SQUAT_STEPS =
  'التدرّج نحو سكوات الرجل الواحدة: ١) سكوات قافز ٢) نزول برجل وصعود بقدمين ٣) نزول برجل وصعود بقدمين مع قفز ٤) نزول وصعود برجل واحدة ٥) برجل واحدة مع قفز — انتقل للمستوى التالي عند إتقان الحالي';
const FRONT_DELT_STEPS = 'التدرّج: وقوف على اليدين مستندًا إلى الجدار ← ثم دون جدار عند التمكن';
const PROGRESS_HEADER =
  'التقدّم المزدوج: زد عدة كل جلسة حتى أعلى النطاق، ثم زد الوزن وارجع إلى أدنى النطاق.';
const FOOTER = 'سجّل ما أنجزته فعليًا هنا بعد التمرين ✅';

// الإعداد الافتراضي — خطة هيثم. المستخدم يستبدله كلَّه من الواجهة.
export const DEFAULT_WORKOUT = {
  start: '2026-08-24',
  offTitle: 'تطوير', // اسم اليوم بين التمرينين
  restBetween: true, // يوم راحة بين كل تمرينين
  // كل تمرين: جلسات، ونطاق عدات (lo→hi)، ووزن البداية ومقدار الزيادة، وراحة بالثواني
  exercises: {
    press: { name: 'الدفع العلوي (بريس مائل)', sets: 4, lo: 6, hi: 9, w0: 40, inc: 5, rest: 120 },
    row: { name: 'السحب الأفقي', sets: 4, lo: 6, hi: 9, w0: 50, inc: 5, rest: 120 },
    pullup: { name: 'السحب العلوي', sets: 3, lo: 6, hi: 9, w0: 40, inc: 5, rest: 120 },
    rear: { name: 'كتف خلفي', sets: 2, lo: 8, hi: 11, w0: 10, inc: 2.5, rest: 60 },
    lat: { name: 'كتف جانبي', sets: 2, lo: 8, hi: 11, w0: 10, inc: 2.5, rest: 60 },
    bi: { name: 'باي', sets: 2, lo: 8, hi: 11, w0: 15, inc: 2.5, rest: 60 },
    tri: { name: 'تراي', sets: 2, lo: 8, hi: 11, w0: 15, inc: 2.5, rest: 60 },
    hammer: { name: 'هامر', sets: 2, lo: 8, hi: 11, w0: 15, inc: 2.5, rest: 60 },
    fly: { name: 'فراشة صدر', sets: 2, lo: 8, hi: 11, w0: null, inc: 2.5, rest: 60 },
  },
  days: [
    {
      title: 'تمرين — اليوم الأول',
      header: PROGRESS_HEADER,
      items: [
        { kind: 'reps', ex: 'press' },
        { kind: 'reps', ex: 'row' },
        { kind: 'reps', ex: 'pullup' },
        { kind: 'failure', key: 'squat', name: 'سكوات', sets: 5, rest: 120, note: SQUAT_STEPS },
        { kind: 'reps', ex: 'rear' },
        { kind: 'reps', ex: 'lat' },
        { kind: 'superset', key: 'bi+tri', name: 'باي + تراي', sets: 2, rest: 60, parts: ['bi', 'tri'] },
        { kind: 'hold', key: 'plank', name: 'بلانك', sets: 2, rest: 60, sec0: 40, secInc: 2.5 },
      ],
    },
    {
      title: 'تمرين — اليوم الثاني',
      header: PROGRESS_HEADER,
      items: [
        { kind: 'reps', ex: 'press' },
        { kind: 'reps', ex: 'fly' },
        { kind: 'reps', ex: 'row' },
        { kind: 'reps', ex: 'pullup' },
        { kind: 'failure', key: 'squat', name: 'سكوات', sets: 5, rest: 120, note: SQUAT_STEPS },
        { kind: 'failure', key: 'frontdelt', name: 'كتف أمامي بوزن الجسم', sets: 3, rest: 120, note: FRONT_DELT_STEPS },
        { kind: 'reps', ex: 'lat' },
        { kind: 'superset', key: 'hammer+tri', name: 'هامر + تراي', sets: 2, rest: 60, parts: ['hammer', 'tri'] },
        { kind: 'hold', key: 'plank', name: 'بلانك', sets: 2, rest: 60, sec0: 40, secInc: 2.5 },
      ],
    },
    {
      title: 'تمرين — اليوم الثالث (جري)',
      header: 'جري تدرّجي (سبرنت متقطع):',
      items: [
        { kind: 'failure', key: 'warmup', name: 'إحماء — هرولة خفيفة', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'إحماء — ٥ دقائق هرولة خفيفة' },
        { kind: 'failure', key: 'sprint', name: 'عدو ١٠–٢٠ ث ثم هرولة ٩٠ ث', sets: 4, rest: 90, note: 'زد جولة أو ١٠ ثوانٍ كل أسبوع', descLine: 'عدو ١٠–٢٠ ثانية ثم هرولة ٩٠ ثانية — ٤ جولات (زد جولة أو ١٠ ثوانٍ كل أسبوع)' },
        { kind: 'failure', key: 'cool', name: 'تهدئة — مشي', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'تهدئة — ٥ دقائق مشي' },
      ],
    },
  ],
};

let cfg = DEFAULT_WORKOUT;
let appearsIn = new Map(); // مفتاح التمرين ← أرقام أيام التمرين التي يظهر فيها

// أي التمارين يظهر في أي يوم — مشتقّ من الخطة نفسها فلا يُكتب مرتين
function indexDays() {
  appearsIn = new Map();
  const add = (key, t) => {
    if (!appearsIn.has(key)) appearsIn.set(key, []);
    if (!appearsIn.get(key).includes(t)) appearsIn.get(key).push(t);
  };
  cfg.days.forEach((day, i) => {
    for (const item of day.items) {
      if (item.kind === 'reps') add(item.ex, i + 1);
      else if (item.kind === 'superset') for (const p of item.parts) add(p, i + 1);
      else add(item.key, i + 1);
    }
  });
}
indexDays();

export function setWorkoutConfig(next) {
  cfg = next || DEFAULT_WORKOUT;
  indexDays();
}
export function workoutConfig() {
  return cfg;
}

// يبقى مُصدَّرًا للتوافق: يوم بدء الدورة
export const GYM_START = DEFAULT_WORKOUT.start;

// 0 = يوم راحة/تطوير، و1..N أيام التمرين بالتناوب
export function workoutDayType(dateIso) {
  if (dateIso < cfg.start) return 0;
  const off = daysBetween(cfg.start, dateIso);
  const step = cfg.restBetween ? 2 : 1;
  if (cfg.restBetween && off % 2 === 1) return 0;
  return ((off / step) % cfg.days.length) + 1;
}

export function workoutTitle(dateIso) {
  const t = workoutDayType(dateIso);
  return t === 0 ? cfg.offTitle : cfg.days[t - 1].title;
}

// مصدر الإنجاز: دالة (dateIso, exKey) => boolean هل أُدّي هذا التمرين ذلك اليوم فعلًا.
// الافتراضي: الكل مؤدّى. والتمرين الفائت وحده يتجمّد تقدّمه — لا يؤثر في بقية التمارين.
let completionSource = null;
export function setWorkoutCompletion(fn) {
  completionSource = fn;
}

// عدد جلسات هذا التمرين المؤدّاة منذ البداية (لا يشمل اليوم نفسه)
function sessionsBefore(dateIso, exKey) {
  if (dateIso <= cfg.start) return 0;
  const days = appearsIn.get(exKey) || [];
  let n = 0;
  for (let d = cfg.start; d < dateIso; d = addDays(d, 1)) {
    const t = workoutDayType(d);
    if (t && days.includes(t) && (!completionSource || completionSource(d, exKey))) n++;
  }
  return n;
}

// هدف الجلسة القادمة: العدات تدور في النطاق، وكلما اكتمل النطاق زاد الوزن
function target(exKey, dateIso) {
  const ex = cfg.exercises[exKey];
  const n = sessionsBefore(dateIso, exKey);
  const span = ex.hi - ex.lo + 1;
  return {
    reps: ex.lo + (n % span),
    weight: ex.w0 == null ? null : ex.w0 + ex.inc * Math.floor(n / span),
  };
}

function holdSeconds(item, dateIso) {
  return item.sec0 + item.secInc * sessionsBefore(dateIso, item.key);
}

const W = (w) => (w == null ? '(حدّد الوزن أول جلسة)' : `${arab(w)} كجم`);

function repsItem(key, dateIso) {
  const ex = cfg.exercises[key];
  const t = target(key, dateIso);
  return { key, kind: 'reps', name: ex.name, sets: ex.sets, rest: ex.rest, reps: t.reps, weight: t.weight, lo: ex.lo, hi: ex.hi, inc: ex.inc };
}

// ── الخطة المُهيكلة للواجهة التفاعلية ──
// أنواع البنود: reps (عدات ووزن)، superset (طرفان)، failure (حتى الفشل)، hold (ثوانٍ)
export function workoutPlan(dateIso) {
  const t = workoutDayType(dateIso);
  if (t === 0) return null;
  const day = cfg.days[t - 1];
  const items = day.items.map((it) => {
    if (it.kind === 'reps') return repsItem(it.ex, dateIso);
    if (it.kind === 'superset')
      return { key: it.key, kind: 'superset', name: it.name, sets: it.sets, rest: it.rest, parts: it.parts.map((p) => repsItem(p, dateIso)) };
    if (it.kind === 'hold')
      return { key: it.key, kind: 'hold', name: it.name, sets: it.sets, rest: it.rest, seconds: holdSeconds(it, dateIso) };
    return { key: it.key, kind: 'failure', name: it.name, sets: it.sets, rest: it.rest, note: it.note };
  });
  return { type: t, title: day.title, items };
}

// ── النص المقروء (يُستعمل في الاختبارات وفي نسخة الخادم) ──
function descLine(it, dateIso) {
  if (it.kind === 'reps') {
    const ex = cfg.exercises[it.ex];
    const t = target(it.ex, dateIso);
    return `${ex.name} — ${arab(ex.sets)} جلسات × ${arab(t.reps)} عدات @ ${W(t.weight)} — راحة ${arab(ex.rest)}ث`;
  }
  if (it.kind === 'superset') {
    const [aKey, bKey] = it.parts;
    const a = cfg.exercises[aKey], b = cfg.exercises[bKey];
    const ta = target(aKey, dateIso), tb = target(bKey, dateIso);
    return `${a.name} + ${b.name} (سوبر ست) — جلستان لكلٍّ: ${a.name} × ${arab(ta.reps)} @ ${W(ta.weight)} • ${b.name} × ${arab(tb.reps)} @ ${W(tb.weight)} — راحة ${arab(it.rest)}ث`;
  }
  if (it.kind === 'hold')
    return `${it.name} — جلستان × ${arab(holdSeconds(it, dateIso))} ث (+${arab(it.secInc)} ث كل جلسة) — راحة ${arab(it.rest)}ث`;
  if (it.descLine) return it.descLine;
  return `${it.name} — ${arab(it.sets)} جلسات حتى الفشل العضلي — راحة ${arab(it.rest)}ث\n   ${it.note}`;
}

export function workoutDesc(dateIso) {
  const t = workoutDayType(dateIso);
  if (t === 0) return '';
  const day = cfg.days[t - 1];
  const rows = day.items.map((it) => descLine(it, dateIso));
  return [day.header, ...rows.map((r, i) => `${arab(i + 1)}. ${r}`), FOOTER].join('\n');
}

// لقطة القوة الحالية: أهداف الجلسة القادمة للرفعات الرئيسية وما يُقاس بالثواني
export function strengthSnapshot(dateIso) {
  const out = [];
  const seen = new Set();
  for (const day of cfg.days)
    for (const it of day.items) {
      if (it.kind === 'reps' && !seen.has(it.ex) && cfg.exercises[it.ex].w0 != null) {
        seen.add(it.ex);
        const t = target(it.ex, dateIso);
        if (out.length < 3) out.push({ name: cfg.exercises[it.ex].name, reps: t.reps, weight: t.weight });
      } else if (it.kind === 'hold' && !seen.has(it.key)) {
        seen.add(it.key);
        out.push({ name: it.name, seconds: holdSeconds(it, dateIso) });
      }
    }
  return out;
}
