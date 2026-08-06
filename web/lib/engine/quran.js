// نظام القرآن الثلاثي: التسميع (مراجعة جزء يوميًا)، التثبيت (الجزءان قبل جزء الحفظ)،
// الحفظ (ربع حزب: يوم حفظ ويوم تكرار). مصحف المدينة 604 صفحات.
import { addDays, arab } from './dates.js';

// بداية جديدة حدّدها هيثم يوم الخميس ٦ أغسطس ٢٠٢٦ (نسينا ما قبلها):
// المراجعة من الجزء ١، والحفظ من الربع الأول من الجزء ١٠ يوم حفظ
export const QURAN_SEED = {
  date: '2026-08-06',
  reviewJuz: 1,
  hifzJuz: 10,
  hifzQuarter: 1, // ١..٨ داخل الجزء
  hifzMode: 'حفظ', // 'حفظ' أو 'تكرار'
};

export function juzPages(j) {
  const start = j === 1 ? 1 : 20 * j - 18;
  const end = j === 30 ? 604 : 20 * j + 1;
  return { start, end };
}

// الربع q من 8 أرباع الجزء (تقريبي)
export function quarterPages(j, q) {
  const { start, end } = juzPages(j);
  const len = end - start + 1;
  return {
    s: start + Math.floor(((q - 1) * len) / 8),
    e: start + Math.ceil((q * len) / 8) - 1,
  };
}

// نصف الحزب k من 4 أنصاف الجزء (تقريبي)
export function halfHizbPages(j, k) {
  const { start, end } = juzPages(j);
  const len = end - start + 1;
  return {
    s: start + Math.floor(((k - 1) * len) / 4),
    e: start + Math.ceil((k * len) / 4) - 1,
  };
}

// مصدر الإنجاز: دالة (dateIso) => {review, hifz} تقول هل أُنجز مسارا ذلك اليوم.
// الافتراضي (بلا مصدر): كل يوم منجز — الخطة المثالية. اليوم غير المنجز لا يتقدم بعده المسار
// بل تُعاد المهمة نفسها في اليوم التالي.
let completionSource = null;
export function setQuranCompletion(fn) {
  completionSource = fn;
  stateCache.clear();
}
export function clearQuranCache() {
  stateCache.clear();
}

function stepQuran(st, flags) {
  let { reviewJuz, hifzJuz, hifzQuarter, hifzMode } = st;
  // الحفظ: يوم حفظ ← يوم تكرار للربع نفسه ← الربع التالي (فقط إن أُنجز يومه)
  if (flags.hifz) {
    if (hifzMode === 'حفظ') {
      hifzMode = 'تكرار';
    } else {
      if (hifzQuarter === 8) {
        hifzJuz += 1; // اكتمل جزء الحفظ: يدخل التثبيت وتتوسع دورة المراجعة
        hifzQuarter = 1;
      } else {
        hifzQuarter += 1;
      }
      hifzMode = 'حفظ';
    }
  }
  // التسميع: دورة من ١ إلى (جزء الحفظ − ٣) ثم تعود إلى ١ (فقط إن أُنجز يومه)
  if (flags.review) {
    const cycleMax = hifzJuz - 3;
    reviewJuz = reviewJuz + 1 > cycleMax ? 1 : reviewJuz + 1;
  }
  return { reviewJuz, hifzJuz, hifzQuarter, hifzMode };
}

const stateCache = new Map();
export function quranStateFor(dateIso) {
  // قبل تاريخ البذرة نعيد حالة البذرة نفسها (التثبيت لم يتغير: الجزءان ٨ و٩)
  if (dateIso < QURAN_SEED.date) dateIso = QURAN_SEED.date;
  if (stateCache.has(dateIso)) return stateCache.get(dateIso);
  let st = { reviewJuz: QURAN_SEED.reviewJuz, hifzJuz: QURAN_SEED.hifzJuz, hifzQuarter: QURAN_SEED.hifzQuarter, hifzMode: QURAN_SEED.hifzMode };
  let d = QURAN_SEED.date;
  while (d < dateIso) {
    st = stepQuran(st, completionSource ? completionSource(d) : { review: true, hifz: true });
    d = addDays(d, 1);
  }
  stateCache.set(dateIso, st);
  return st;
}

export function reviewLine(st) {
  const { start, end } = juzPages(st.reviewJuz);
  return `تسميع المراجعة: الجزء ${arab(st.reviewJuz)} (ص ${arab(start)}–${arab(end)})`;
}

export function hifzLine(st) {
  const j = st.hifzJuz, q = st.hifzQuarter;
  const hizb = q <= 4 ? 2 * j - 1 : 2 * j;
  const { s, e } = quarterPages(j, q);
  return `${st.hifzMode} الربع ${arab(q)} من الجزء ${arab(j)} — الحزب ${arab(hizb)} (ص ${arab(s)}–${arab(e)} تقريبًا)`;
}

// أنصاف أحزاب التثبيت الثمانية بترتيب السنن:
// [الفجر، الضحى، الظهر القبلية، الظهر البعدية، العصر، المغرب، العشاء القبلية، العشاء البعدية]
export function tathbeetLabels(st) {
  const [a, b] = [st.hifzJuz - 2, st.hifzJuz - 1];
  const out = [];
  for (let i = 0; i < 8; i++) {
    const j = i < 4 ? a : b;
    const k = (i % 4) + 1;
    const hizb = k <= 2 ? 2 * j - 1 : 2 * j;
    const half = k % 2 === 1 ? 'النصف الأول' : 'النصف الثاني';
    const { s, e } = halfHizbPages(j, k);
    out.push(`الجزء ${arab(j)} — الحزب ${arab(hizb)} (${half})، ص ${arab(s)}–${arab(e)} تقريبًا`);
  }
  return out;
}
