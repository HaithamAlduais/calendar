// نظام القرآن الثلاثي: التسميع (مراجعة جزء يوميًا)، التثبيت (الجزءان قبل جزء الحفظ)،
// الحفظ (ربع حزب: يوم حفظ ويوم تكرار). مصحف المدينة 604 صفحات.
import { addDays, arab } from './dates.js';

// إعداد المستخدم: موضع البداية، وعدد مرات التكرار، ونمط النظام.
// 'managed' نظام مُدار يتقدّم وحده ويطالبك بموضع بعينه، و'free' نصٌّ حرّ تكتبه بلا مطالبة.
export const DEFAULT_QURAN = {
  mode: 'managed',
  date: '2026-08-24',
  reviewJuz: 1,
  hifzJuz: 10,
  hifzQuarter: 1, // ١..٨ داخل الجزء
  hifzMode: 'حفظ', // 'حفظ' أو 'تكرار'
  repeats: 5, // مرات تكرار ربع الحفظ في يوم التكرار
  wirdSlots: 8, // عدد السنن التي يُوزَّع عليها ورد التثبيت
};

export let QURAN_SEED = DEFAULT_QURAN;

export function setQuranConfig(next) {
  QURAN_SEED = { ...DEFAULT_QURAN, ...(next || {}) };
  stateCache.clear();
}
export function quranConfig() {
  return QURAN_SEED;
}

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

// مفتاح مجمع أخطاء لكل «مكان» يُقرأ فيه القرآن — ثابت طالما النص نفسه لم يتغير،
// فتتراكم عليه الأخطاء عبر الزمن بصرف النظر عن السياق (حفظ/تكرار/مراجعة/تثبيت)
export const reviewPoolKey = (juz) => `rv:${juz}`;
export const hifzPoolKey = (juz, quarter) => `hz:${juz}:${quarter}`;
export function tathbeetPoolKey(st, slotIndex, count = QURAN_SEED.wirdSlots) {
  const perJuz = Math.max(1, Math.round(count / 2));
  const juz = slotIndex < perJuz ? st.hifzJuz - 2 : st.hifzJuz - 1;
  const half = (slotIndex % perJuz) + 1;
  return `tb:${juz}:${half}`;
}

// بنود بلوك «قرآن وسنة الضحى» (بلا سنة الضحى نفسها): التسميع، ثم الحفظ أو —
// في يوم التكرار — تكرار الربع الحالي ×٥ مرات مع مراجعة الأرباع ١..(n−1) من جزء الحفظ نفسه،
// كل بند بمجمع أخطائه الخاص (نفس المجمع يُعاد استخدامه كل مرة يُقرأ فيه هذا الربع لاحقًا)
// لكل بند مفتاح ثابت (key) تتعلّق به علامات التأشير، فلا تنزاح بتغيّر عدد البنود
export function quranTaskLines(st) {
  // النظام الحرّ: بندان بلا موضع ولا تتبّع — تكتب ما قرأته بنفسك
  if (QURAN_SEED.mode === 'free')
    return [
      { key: 'review', text: 'تسميع المراجعة', pool: null },
      { key: 'hifz', text: 'الحفظ', pool: null },
    ];
  const lines = [{ key: 'review', text: reviewLine(st), pool: reviewPoolKey(st.reviewJuz) }];
  if (st.hifzMode === 'تكرار') {
    lines.push({ key: 'hifz', text: `${hifzLine(st)} × ${arab(QURAN_SEED.repeats)} مرات`, pool: hifzPoolKey(st.hifzJuz, st.hifzQuarter) });
    for (let k = 1; k < st.hifzQuarter; k++) {
      const hizb = k <= 4 ? 2 * st.hifzJuz - 1 : 2 * st.hifzJuz;
      const { s, e } = quarterPages(st.hifzJuz, k);
      lines.push({
        key: `rev${k}`,
        text: `مراجعة الربع ${arab(k)} من الجزء ${arab(st.hifzJuz)} — الحزب ${arab(hizb)} (ص ${arab(s)}–${arab(e)} تقريبًا)`,
        pool: hifzPoolKey(st.hifzJuz, k),
      });
    }
  } else {
    lines.push({ key: 'hifz', text: hifzLine(st), pool: null }); // يوم الحفظ نفسه بلا تتبّع أخطاء
  }
  return lines;
}

// أنصاف أحزاب التثبيت الثمانية بترتيب السنن:
// [الفجر، الضحى، الظهر القبلية، الظهر البعدية، العصر، المغرب، العشاء القبلية، العشاء البعدية]
export function tathbeetLabels(st, count = QURAN_SEED.wirdSlots) {
  const [a, b] = [st.hifzJuz - 2, st.hifzJuz - 1];
  const perJuz = Math.max(1, Math.round(count / 2));
  const out = [];
  for (let i = 0; i < count; i++) {
    const j = i < perJuz ? a : b;
    const k = (i % perJuz) + 1;
    const hizb = k <= 2 ? 2 * j - 1 : 2 * j;
    const half = k % 2 === 1 ? 'النصف الأول' : 'النصف الثاني';
    const { s, e } = halfHizbPages(j, k);
    out.push(`الجزء ${arab(j)} — الحزب ${arab(hizb)} (${half})، ص ${arab(s)}–${arab(e)} تقريبًا`);
  }
  return out;
}
