// نظام القرآن الثلاثي، ومدارُه الحزبُ لا الجزء. والقرآن ستون حزبًا، والحزبُ أربعة أرباع:
//
//   الحفظ    — ربعٌ في بلوك الروتين يوم القرآن: يومَ حفظٍ وتكرار، ثم يومَ قراءةٍ
//              للأرباع المحفوظة من الحزب من أوله إلى موضعه.
//   التثبيت  — الأحزاب الأربعة التي قبل حزب الحفظ (جزءان)، موزَّعةً نصفَ حزبٍ
//              على كل سنّة من السنن الثماني.
//   المراجعة — ما قبل التثبيت كلُّه، حزبان كل ليلة، تُقرأ في صلاة الوتر من القيام.
//
// فإذا تمّ حزبُ الحفظ دخل التثبيت، وخرج من التثبيت أقدمُ أحزابه إلى المراجعة —
// سيرٌ واحد لا يفلت منه موضع. مصحف المدينة 604 صفحات.
import { addDays, arab } from './dates.js';
import { workoutDayType } from './workout.js';

// إعداد المستخدم: موضع البداية، وعدد مرات التكرار، ونمط النظام.
// 'managed' نظام مُدار يتقدّم وحده ويطالبك بموضع بعينه، و'free' نصٌّ حرّ تكتبه بلا مطالبة.
export const DEFAULT_QURAN = {
  mode: 'managed',
  date: '2026-08-24',
  reviewJuz: 1, // موضع بدء المراجعة — يُقرأ حزبًا: أولُ أحزاب هذا الجزء
  hifzJuz: 10,
  hifzQuarter: 1, // ١..٨ داخل الجزء — وهو موضع البداية كما يكتبه صاحبُه
  hifzMode: 'حفظ', // 'حفظ' أو 'قراءة'
  repeats: 5, // مرات تكرار ربع الحفظ في يوم الحفظ نفسِه
  enabled: true, // نظام الحفظ والمراجعة كلّه — من أطفأه خلا بلوكه منه
  // مكوّنات النظام المُدار — يركّبها المستخدم كما شاء: حفظٌ وحده، أو حفظٌ ومراجعة
  components: { review: true, hifz: true },
  // الورد في السنن: 'tathbeet' مربوط بالحفظ (يقرأ ما حول موضعه)، أو 'reading'
  // قراءةٌ حرّة بمقدار يحدّده صاحبها لكل سنّة
  wirdMode: 'tathbeet',
  wirdAmount: 'ربع حزب',
  // السنن التي يُوزَّع عليها ورد التثبيت بترتيبها الزمني: [بلوك، بند]
  wird: [
    ['fajr', 'sunnah'],
    ['fajr', 'duha'],
    ['dhuhr', 'sunnahBefore'],
    ['dhuhr', 'sunnahAfter'],
    ['asr', 'sunnah'],
    ['maghrib', 'sunnah'],
    ['isha', 'sunnahBefore'],
    ['isha', 'sunnahAfter'],
  ],
  wirdSlots: 8, // عدد السنن (يُشتقّ من طول wird)
  reviewHizbs: 2, // كم حزبًا يُراجَع كل ليلة في الوتر
};

export let QURAN_SEED = DEFAULT_QURAN;

export function setQuranConfig(next) {
  QURAN_SEED = { ...DEFAULT_QURAN, ...(next || {}) };
  stateCache.clear();
}
export function quranConfig() {
  return QURAN_SEED;
}

// ── مواضع الصفحات ───────────────────────────────────────────────────────────
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

// ── الحزب أصلُ الحساب: ستون حزبًا، والجزء حزبان، والحزب أربعة أرباع ─────────
export const HIZB_COUNT = 60;
export const juzOfHizb = (h) => Math.ceil(h / 2);
// أرباعُ الحزب تقع في النصف الأول من أرباع الجزء الثمانية أو في نصفها الثاني
const quarterBase = (h) => (h % 2 === 1 ? 0 : 4);

// الربع q (١..٤) من الحزب h
export function hizbQuarterPages(h, q) {
  return quarterPages(juzOfHizb(h), quarterBase(h) + q);
}

// الحزب h كاملًا
export function hizbPages(h) {
  const j = juzOfHizb(h);
  const b = quarterBase(h);
  return { s: quarterPages(j, b + 1).s, e: quarterPages(j, b + 4).e };
}

// نصف الحزب h: half ١ الأول، ٢ الثاني
export function hizbHalfPages(h, half) {
  return halfHizbPages(juzOfHizb(h), (h % 2 === 1 ? 0 : 2) + half);
}

// موضعُ الحفظ رقمٌ واحد: الربع المطلق ١..٢٤٠ عبر المصحف كلِّه.
// فمنه يُشتقّ الجزءُ والحزبُ والربعُ داخله، ولا تبقى حالتان تتخالفان.
const absQuarter = (juz, qInJuz) => (juz - 1) * 8 + qInJuz;
function spread(q) {
  const hizb = Math.ceil(q / 4);
  return {
    hifzQ: q,
    hifzHizb: hizb,
    hifzJuz: juzOfHizb(hizb),
    hifzQuarter: ((q - 1) % 4) + 1, // الربع داخل الحزب ١..٤
  };
}

// نافذة التثبيت: الأحزاب الأربعة قبل حزب الحفظ (جزءان)
export const tathbeetWindow = (st) => ({ from: Math.max(1, st.hifzHizb - 4), to: st.hifzHizb - 1 });
// آخر أحزاب المراجعة: ما قبل نافذة التثبيت — فمن لم يبلغ حفظُه الحزبَ السادس فلا مراجعة له
export const reviewMax = (st) => st.hifzHizb - 5;

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

// أيامُ الحفظ هي أيامُ القرآن من دورة الروتين — فيومُ التمرين لا يتقدّم فيه الحفظ.
// وهي دالةٌ تُبدَّل عند الحاجة، وأصلُها دورةُ التمرين نفسها.
let hifzDay = (dIso) => workoutDayType(dIso) === 0;
export function setHifzDayPredicate(fn) {
  hifzDay = fn || ((dIso) => workoutDayType(dIso) === 0);
  stateCache.clear();
}

function stepQuran(st, flags, dIso) {
  let { hifzQ, hifzMode, reviewHizb } = st;
  // الحفظ يتقدّم في أيام القرآن وحدها: يومَ حفظٍ وتكرار، ثم يومَ قراءةٍ للأرباع،
  // ثم الربعُ التالي — وإذا تمّ الربعُ الرابع انتقل من نفسه إلى الحزب الذي يليه.
  if (flags.hifz && hifzDay(dIso)) {
    if (hifzMode === 'حفظ') hifzMode = 'قراءة';
    else {
      hifzMode = 'حفظ';
      hifzQ = Math.min(HIZB_COUNT * 4, hifzQ + 1);
    }
  }
  // المراجعة تدور كل ليلة على أحزاب ما قبل التثبيت، حزبين حزبين، ثم تعود إلى أولها.
  // ونافذتُها تتّسع كلما تقدّم الحفظ، فيدخلها الحزبُ الخارج من التثبيت في موضعه.
  if (flags.review) {
    const max = reviewMax(spread(hifzQ));
    const step = QURAN_SEED.reviewHizbs || 2;
    if (max >= 1) for (let i = 0; i < step; i++) reviewHizb = reviewHizb >= max ? 1 : reviewHizb + 1;
  }
  return { hifzQ, hifzMode, reviewHizb };
}

const stateCache = new Map();
export function quranStateFor(dateIso) {
  // قبل تاريخ البذرة نعيد حالة البذرة نفسها (التثبيت لم يتغير)
  if (dateIso < QURAN_SEED.date) dateIso = QURAN_SEED.date;
  if (stateCache.has(dateIso)) return stateCache.get(dateIso);
  let core = {
    hifzQ: absQuarter(QURAN_SEED.hifzJuz, QURAN_SEED.hifzQuarter),
    hifzMode: QURAN_SEED.hifzMode === 'تكرار' ? 'قراءة' : QURAN_SEED.hifzMode,
    reviewHizb: Math.max(1, 2 * QURAN_SEED.reviewJuz - 1),
  };
  let d = QURAN_SEED.date;
  while (d < dateIso) {
    core = stepQuran(core, completionSource ? completionSource(d) : { review: true, hifz: true }, d);
    d = addDays(d, 1);
  }
  const st = { ...spread(core.hifzQ), hifzMode: core.hifzMode, reviewHizb: core.reviewHizb };
  stateCache.set(dateIso, st);
  return st;
}

// ── أحزاب مراجعة الليلة ─────────────────────────────────────────────────────
// حزبان متتاليان من نافذة المراجعة، يلتفّان إلى أولها إذا بلغا آخرها
export function reviewHizbs(st) {
  const max = reviewMax(st);
  if (max < 1) return [];
  const out = [];
  let h = Math.min(st.reviewHizb, max);
  for (let i = 0; i < (QURAN_SEED.reviewHizbs || 2); i++) {
    out.push(h);
    h = h >= max ? 1 : h + 1;
  }
  return out;
}

const hizbText = (h) => {
  const { s, e } = hizbPages(h);
  return `الحزب ${arab(h)} من الجزء ${arab(juzOfHizb(h))} (ص ${arab(s)}–${arab(e)} تقريبًا)`;
};

export function reviewLine(st) {
  const hs = reviewHizbs(st);
  if (!hs.length) return null;
  return `تسميع المراجعة: ${hs.map(hizbText).join('، و')}`;
}

export function hifzLine(st) {
  const { s, e } = hizbQuarterPages(st.hifzHizb, st.hifzQuarter);
  return `حفظ الربع ${arab(st.hifzQuarter)} من الحزب ${arab(st.hifzHizb)} — الجزء ${arab(st.hifzJuz)} (ص ${arab(s)}–${arab(e)} تقريبًا)`;
}

// مفتاح مجمع أخطاء لكل «موضع» يُقرأ فيه القرآن — ثابت طالما الموضع نفسه،
// فتتراكم عليه الأخطاء عبر الزمن بصرف النظر عن السياق (حفظ/قراءة/مراجعة/تثبيت)
export const reviewPoolKey = (hizb) => `rv:h${hizb}`;
export const hifzPoolKey = (hizb, quarter) => `hz:h${hizb}:${quarter}`;
export function tathbeetPoolKey(st, slotIndex, count = QURAN_SEED.wirdSlots) {
  const { from, to } = tathbeetWindow(st);
  const span = Math.max(1, to - from + 1);
  const per = Math.max(1, Math.round(count / span));
  const h = Math.min(to, from + Math.floor(slotIndex / per));
  return `tb:h${h}:${(slotIndex % per) + 1}`;
}

// ── بنود بلوك الروتين يوم القرآن ────────────────────────────────────────────
// يومَ الحفظ: الربعُ ثم تكرارُه إلى آخر البلوك — فقد خلا الوقتُ بانتقال المراجعة
// إلى القيام. ويومَ القراءة: أرباعُ الحزب من أوله إلى موضعه، كلُّ ربعٍ ببنده.
// ولكل بند مفتاح ثابت (key) تتعلّق به علامات التأشير، فلا تنزاح بتغيّر عددها.
export function quranTaskLines(st) {
  // من أطفأ نظام الحفظ خلا بلوكُه منه — ولم يبقَ يطالبه بموضعٍ لا يريده
  if (QURAN_SEED.enabled === false) return [];
  // النظام الحرّ: بندٌ بلا موضع ولا تتبّع — تكتب ما قرأته بنفسك
  if (QURAN_SEED.mode === 'free') return [{ key: 'hifz', text: 'الحفظ', pool: null }];
  const comp = QURAN_SEED.components || { review: true, hifz: true };
  if (!comp.hifz) return [];
  const { hifzHizb: h, hifzQuarter: q } = st;
  if (st.hifzMode === 'حفظ')
    return [
      { key: 'hifz', text: hifzLine(st), pool: null }, // الحفظ نفسه بلا تتبّع أخطاء
      {
        key: 'repeat',
        text: `تكرار الربع ${arab(q)} × ${arab(QURAN_SEED.repeats)} مرات إلى آخر البلوك`,
        pool: hifzPoolKey(h, q),
      },
    ];
  // يوم القراءة: من الربع الأول إلى الربع الذي بلغه الحفظ
  const lines = [];
  for (let k = 1; k <= q; k++) {
    const { s, e } = hizbQuarterPages(h, k);
    lines.push({
      key: `read${k}`,
      text: `قراءة الربع ${arab(k)} من الحزب ${arab(h)} (ص ${arab(s)}–${arab(e)} تقريبًا)`,
      pool: hifzPoolKey(h, k),
    });
  }
  return lines;
}

// ── بند المراجعة في صلاة الوتر ──────────────────────────────────────────────
// المراجعةُ تُقرأ في الوتر كما يُقرأ التثبيت في السنن — صلاةٌ وقرآنٌ معًا
export function reviewItem(st) {
  if (QURAN_SEED.enabled === false) return null;
  if (QURAN_SEED.mode === 'free') return { text: 'تسميع المراجعة', pool: null };
  const comp = QURAN_SEED.components || { review: true, hifz: true };
  if (!comp.review) return null;
  const hs = reviewHizbs(st);
  if (!hs.length) return null;
  return { text: reviewLine(st), pool: reviewPoolKey(hs[0]) };
}

// ── أنصاف أحزاب التثبيت بترتيب السنن ────────────────────────────────────────
// [الفجر، الضحى، الظهر القبلية، الظهر البعدية، العصر، المغرب، العشاء القبلية، العشاء البعدية]
// ولها `at(slot, itemId)` تقرأ الموضع من قائمة السنن المُعدّة لا من رقمٍ مكتوب في
// مولّد البلوك — فمن حذف سنّةً من ورده أو أعاد ترتيبها لم يقرأ «سنة العصر — undefined»،
// وإنما اسمَ سنّته وحده.
export function tathbeetLabels(st, count = QURAN_SEED.wirdSlots) {
  const withAt = (out) => {
    out.at = (slot, itemId) => {
      const i = (QURAN_SEED.wird || []).findIndex((w) => w[0] === slot && w[1] === itemId);
      return i < 0 ? null : out[i];
    };
    return out;
  };
  if (QURAN_SEED.wirdMode === 'reading')
    return withAt(Array.from({ length: count }, () => `قراءة: ${QURAN_SEED.wirdAmount || 'ورد'}`));
  const { from, to } = tathbeetWindow(st);
  const span = Math.max(1, to - from + 1); // أربعة أحزاب
  const per = Math.max(1, Math.round(count / span)); // نصفان لكل حزب
  const out = [];
  for (let i = 0; i < count; i++) {
    const h = Math.min(to, from + Math.floor(i / per));
    const part = (i % per) + 1;
    const { s, e } = hizbHalfPages(h, Math.min(2, part));
    const name = per === 2 ? (part === 1 ? 'النصف الأول' : 'النصف الثاني') : `الجزء ${arab(part)}`;
    out.push(`الحزب ${arab(h)} من الجزء ${arab(juzOfHizb(h))} (${name})، ص ${arab(s)}–${arab(e)} تقريبًا`);
  }
  return withAt(out);
}
