// خطة التمرين — التقدّم المزدوج: +١ عدة كل جلسة عبر النطاق، ثم زيادة الوزن والعودة لأدناه
// دورة متتابعة لا علاقة لها بأيام الأسبوع (تبدأ الجمعة ١٤ أغسطس ٢٠٢٦، وهو يوم التمرين الأول):
// تمرين ثم تطوير بالتناوب، والتمارين الثلاثة تدور: الأول (أ) ← الثاني (ب) ← الثالث (جري)
import { addDays, daysBetween, arab } from './dates.js';

export const GYM_START = '2026-08-21';

// 0 = تطوير، 1/2/3 = أيام التمرين الثلاثة بالتناوب يومًا بعد يوم
export function workoutDayType(dateIso) {
  if (dateIso < GYM_START) return 0;
  const off = daysBetween(GYM_START, dateIso);
  if (off % 2 === 1) return 0; // يوم تطوير بين كل تمرينين
  return ((off / 2) % 3) + 1;
}

// التمارين ذات التقدّم الرقمي. days: أيام الظهور (١ و/أو ٢)
const EXERCISES = {
  press:  { name: 'الدفع العلوي (بريس مائل)', sets: 4, lo: 6, hi: 9,  w0: 40,   inc: 5,   rest: 120, days: [1, 2] },
  row:    { name: 'السحب الأفقي',             sets: 4, lo: 6, hi: 9,  w0: 50,   inc: 5,   rest: 120, days: [1, 2] },
  pullup: { name: 'السحب العلوي',             sets: 3, lo: 6, hi: 9,  w0: 40,   inc: 5,   rest: 120, days: [1, 2] },
  rear:   { name: 'كتف خلفي',                 sets: 2, lo: 8, hi: 11, w0: 10,   inc: 2.5, rest: 60,  days: [1] },
  lat:    { name: 'كتف جانبي',                sets: 2, lo: 8, hi: 11, w0: 10,   inc: 2.5, rest: 60,  days: [1, 2] },
  bi:     { name: 'باي',                      sets: 2, lo: 8, hi: 11, w0: 15,   inc: 2.5, rest: 60,  days: [1] },
  tri:    { name: 'تراي',                     sets: 2, lo: 8, hi: 11, w0: 15,   inc: 2.5, rest: 60,  days: [1, 2] },
  hammer: { name: 'هامر',                     sets: 2, lo: 8, hi: 11, w0: 15,   inc: 2.5, rest: 60,  days: [2] },
  fly:    { name: 'فراشة صدر',                sets: 2, lo: 8, hi: 11, w0: null, inc: 2.5, rest: 60,  days: [2] },
};

// مصدر الإنجاز: دالة (dateIso, exKey) => boolean هل أُدّي هذا التمرين ذلك اليوم فعلًا.
// الافتراضي: الكل مؤدّى. والتمرين الفائت وحده يتجمّد تقدّمه — لا يؤثر في بقية التمارين.
let completionSource = null;
export function setWorkoutCompletion(fn) {
  completionSource = fn;
}

// عدد جلسات هذا التمرين المؤدّاة منذ البداية (لا يشمل اليوم نفسه)
function sessionsBefore(ex, dateIso, exKey) {
  if (dateIso <= GYM_START) return 0;
  let n = 0;
  for (let d = GYM_START; d < dateIso; d = addDays(d, 1)) {
    const t = workoutDayType(d);
    if (t && ex.days.includes(t) && (!completionSource || completionSource(d, exKey))) n++;
  }
  return n;
}

function target(exKey, dateIso) {
  const ex = EXERCISES[exKey];
  const n = sessionsBefore(ex, dateIso, exKey);
  const span = ex.hi - ex.lo + 1;
  return {
    reps: ex.lo + (n % span),
    weight: ex.w0 == null ? null : ex.w0 + ex.inc * Math.floor(n / span),
  };
}

const W = (w) => (w == null ? '(حدّد الوزن أول جلسة)' : `${arab(w)} كجم`);

function line(exKey, dateIso) {
  const ex = EXERCISES[exKey];
  const t = target(exKey, dateIso);
  return `${ex.name} — ${arab(ex.sets)} جلسات × ${arab(t.reps)} عدات @ ${W(t.weight)} — راحة ${arab(ex.rest)}ث`;
}

function supersetLine(aKey, bKey, dateIso) {
  const a = EXERCISES[aKey], b = EXERCISES[bKey];
  const ta = target(aKey, dateIso), tb = target(bKey, dateIso);
  return `${a.name} + ${b.name} (سوبر ست) — جلستان لكلٍّ: ${a.name} × ${arab(ta.reps)} @ ${W(ta.weight)} • ${b.name} × ${arab(tb.reps)} @ ${W(tb.weight)} — راحة ٦٠ث`;
}

function plankSeconds(dateIso) {
  // بلانك: البداية ٤٠ ث، +٢٫٥ ث كل جلسة (يظهر في اليومين الأول والثاني)
  const n = sessionsBefore({ days: [1, 2] }, dateIso, 'plank');
  return 40 + 2.5 * n;
}

const SQUAT_LINE =
  'سكوات — ٥ جلسات حتى الفشل العضلي — راحة ١٢٠ث\n' +
  '   التدرّج نحو سكوات الرجل الواحدة: ١) سكوات قافز ٢) نزول برجل وصعود بقدمين ٣) نزول برجل وصعود بقدمين مع قفز ٤) نزول وصعود برجل واحدة ٥) برجل واحدة مع قفز — انتقل للمستوى التالي عند إتقان الحالي';

const FRONT_DELT_LINE =
  'كتف أمامي بوزن الجسم — ٣ جلسات حتى الفشل العضلي — راحة ١٢٠ث\n' +
  '   التدرّج: وقوف على اليدين مستندًا إلى الجدار ← ثم دون جدار عند التمكن';

const HEADER = 'التقدّم المزدوج: زد عدة كل جلسة حتى أعلى النطاق، ثم زد الوزن وارجع إلى أدنى النطاق.';
const FOOTER = 'سجّل ما أنجزته فعليًا هنا بعد التمرين ✅';

// ── الخطة المُهيكلة للواجهة التفاعلية ──
// أنواع البنود: reps (عدات ووزن)، superset (طرفان)، failure (حتى الفشل)، hold (ثوانٍ)
const SQUAT_STEPS =
  'التدرّج نحو سكوات الرجل الواحدة: ١) سكوات قافز ٢) نزول برجل وصعود بقدمين ٣) نزول برجل وصعود بقدمين مع قفز ٤) نزول وصعود برجل واحدة ٥) برجل واحدة مع قفز — انتقل للمستوى التالي عند إتقان الحالي';
const FRONT_DELT_STEPS = 'التدرّج: وقوف على اليدين مستندًا إلى الجدار ← ثم دون جدار عند التمكن';

function repsItem(key, dateIso) {
  const ex = EXERCISES[key];
  const t = target(key, dateIso);
  return { key, kind: 'reps', name: ex.name, sets: ex.sets, rest: ex.rest, reps: t.reps, weight: t.weight, lo: ex.lo, hi: ex.hi, inc: ex.inc };
}

export function workoutPlan(dateIso) {
  const t = workoutDayType(dateIso);
  if (t === 0) return null;
  if (t === 3) {
    return {
      type: 3,
      title: workoutTitle(dateIso),
      items: [
        { key: 'warmup', kind: 'failure', name: 'إحماء — هرولة خفيفة', sets: 1, rest: 0, note: '٥ دقائق' },
        { key: 'sprint', kind: 'failure', name: 'عدو ١٠–٢٠ ث ثم هرولة ٩٠ ث', sets: 4, rest: 90, note: 'زد جولة أو ١٠ ثوانٍ كل أسبوع' },
        { key: 'cool', kind: 'failure', name: 'تهدئة — مشي', sets: 1, rest: 0, note: '٥ دقائق' },
      ],
    };
  }
  const items = [];
  if (t === 1) {
    items.push(repsItem('press', dateIso), repsItem('row', dateIso), repsItem('pullup', dateIso));
    items.push({ key: 'squat', kind: 'failure', name: 'سكوات', sets: 5, rest: 120, note: SQUAT_STEPS });
    items.push(repsItem('rear', dateIso), repsItem('lat', dateIso));
    items.push({ key: 'bi+tri', kind: 'superset', name: 'باي + تراي', sets: 2, rest: 60, parts: [repsItem('bi', dateIso), repsItem('tri', dateIso)] });
  } else {
    items.push(repsItem('press', dateIso), repsItem('fly', dateIso), repsItem('row', dateIso), repsItem('pullup', dateIso));
    items.push({ key: 'squat', kind: 'failure', name: 'سكوات', sets: 5, rest: 120, note: SQUAT_STEPS });
    items.push({ key: 'frontdelt', kind: 'failure', name: 'كتف أمامي بوزن الجسم', sets: 3, rest: 120, note: FRONT_DELT_STEPS });
    items.push(repsItem('lat', dateIso));
    items.push({ key: 'hammer+tri', kind: 'superset', name: 'هامر + تراي', sets: 2, rest: 60, parts: [repsItem('hammer', dateIso), repsItem('tri', dateIso)] });
  }
  items.push({ key: 'plank', kind: 'hold', name: 'بلانك', sets: 2, rest: 60, seconds: plankSeconds(dateIso) });
  return { type: t, title: workoutTitle(dateIso), items };
}

// لقطة القوة الحالية: أهداف الجلسة القادمة للرفعات الرئيسية + البلانك
export function strengthSnapshot(dateIso) {
  const out = [];
  for (const k of ['press', 'row', 'pullup']) {
    const ex = EXERCISES[k];
    const t = target(k, dateIso);
    out.push({ name: ex.name, reps: t.reps, weight: t.weight });
  }
  out.push({ name: 'بلانك', seconds: plankSeconds(dateIso) });
  return out;
}

export function workoutTitle(dateIso) {
  const t = workoutDayType(dateIso);
  return t === 1 ? 'تمرين — اليوم الأول' : t === 2 ? 'تمرين — اليوم الثاني' : t === 3 ? 'تمرين — اليوم الثالث (جري)' : 'تطوير';
}

export function workoutDesc(dateIso) {
  const t = workoutDayType(dateIso);
  if (t === 0) return '';
  if (t === 3) {
    return [
      'جري تدرّجي (سبرنت متقطع):',
      '١. إحماء — ٥ دقائق هرولة خفيفة',
      '٢. عدو ١٠–٢٠ ثانية ثم هرولة ٩٠ ثانية — ٤ جولات (زد جولة أو ١٠ ثوانٍ كل أسبوع)',
      '٣. تهدئة — ٥ دقائق مشي',
      FOOTER,
    ].join('\n');
  }
  const rows = [];
  if (t === 1) {
    rows.push(line('press', dateIso));
    rows.push(line('row', dateIso));
    rows.push(line('pullup', dateIso));
    rows.push(SQUAT_LINE);
    rows.push(line('rear', dateIso));
    rows.push(line('lat', dateIso));
    rows.push(supersetLine('bi', 'tri', dateIso));
  } else {
    rows.push(line('press', dateIso));
    rows.push(line('fly', dateIso));
    rows.push(line('row', dateIso));
    rows.push(line('pullup', dateIso));
    rows.push(SQUAT_LINE);
    rows.push(FRONT_DELT_LINE);
    rows.push(line('lat', dateIso));
    rows.push(supersetLine('hammer', 'tri', dateIso));
  }
  rows.push(`بلانك — جلستان × ${arab(plankSeconds(dateIso))} ث (+٢٫٥ ث كل جلسة) — راحة ٦٠ث`);
  const numbered = rows.map((r, i) => `${arab(i + 1)}. ${r}`);
  return [HEADER, ...numbered, FOOTER].join('\n');
}
