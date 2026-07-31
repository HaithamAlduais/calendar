// خطة التمرين الشهرية — التقدّم المزدوج: +١ عدة كل جلسة عبر النطاق، ثم زيادة الوزن والعودة لأدناه
// الشهر الأول: من السبت ١ أغسطس ٢٠٢٦، أربعة أسابيع (سبت→جمعة)
// الأحد: اليوم الأول (كامل الجسم أ) • الثلاثاء: اليوم الثاني (كامل الجسم ب) • الخميس: اليوم الثالث (جري)
import { addDays, dow, arab } from './dates.js';

export const GYM_START = '2026-08-01';

const WDAY = { 0: 1, 2: 2, 4: 3 }; // الأحد→١، الثلاثاء→٢، الخميس→٣

export function workoutDayType(dateIso) {
  return WDAY[dow(dateIso)] || 0;
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

// مصدر الإنجاز: دالة (dateIso) => boolean هل أُدّي تمرين ذلك اليوم فعلًا.
// الافتراضي: كل الجلسات مؤداة. الجلسة الفائتة لا تُحتسب فتبقى أهدافها للجلسة التالية.
let completionSource = null;
export function setWorkoutCompletion(fn) {
  completionSource = fn;
}

// عدد جلسات التمرين المؤدّاة لهذا التمرين منذ بداية الشهر (لا يشمل اليوم نفسه)
function sessionsBefore(ex, dateIso) {
  if (dateIso <= GYM_START) return 0;
  let n = 0;
  for (let d = GYM_START; d < dateIso; d = addDays(d, 1)) {
    const t = WDAY[dow(d)];
    if (t && ex.days.includes(t) && (!completionSource || completionSource(d))) n++;
  }
  return n;
}

function target(exKey, dateIso) {
  const ex = EXERCISES[exKey];
  const n = sessionsBefore(ex, dateIso);
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
  const n = sessionsBefore({ days: [1, 2] }, dateIso);
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
