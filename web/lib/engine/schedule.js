// باني وحدة اليوم — تبدأ بنومة الثلث الأخير التي تسبق الفجر وتنتهي بنهاية قيام ليلتها
// القاعدة (٢٢ أغسطس ٢٠٢٦): «أول مهمة في اليوم هي النوم» — فمن أخلّ بنومة الثلث الأخير
// خرب يومه كله، فجُعلت أول بلوك في الوحدة لا آخرها.
// ترتيب الوحدة: نوم (الثلث الأخير) ← الفجر ← مهام ← نوم الضحى ← نهار ← المغرب ← ليل ← القيام
//
// بنود البلوك مصفوفة كائنات لا نصًّا مرقّمًا: لكل بند معرّف ثابت، فالتأشير والقضاء
// والتقديم ومجمعات الأخطاء تُمسك بالمعرّف لا بموضع السطر — فلا تنزاح بحذف مهمة أو إضافتها.
import { addDays, dow, minToDateTime } from './dates.js';
import { prayerTimes } from './prayers.js';
import { quranStateFor, quranTaskLines, tathbeetLabels } from './quran.js';

const PRAYER_NOTE =
  'ملاحظات: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة.';

// مجموع نوم اليوم المستهدف: نومة الضحى تكمّل ما نقص من نوم الليل
const SLEEP_TARGET = 395; // ٦ س ٣٥ د
const NAP_MIN = 45; // حدّا نومة الضحى
const NAP_MAX = 240;
const WORK_MIN = 45; // أقل فترة عمل صباحية
const QIYAM_MINUTES = 45; // القيام: آخر ٤٥ دقيقة من الثلث الثاني من الليل

// الألوان (لوحة Google Calendar): 10 ريحان أخضر، 9 توت أزرق، 6 يوسفي برتقالي، 8 غرافيت رمادي
export const COLOR_HEX = {
  6: '#f4511e',
  8: '#616161',
  9: '#3f51b5',
  10: '#0b8043',
};

// بند قابل للتأشير، وسطر شرح لا يُؤشَّر
const it = (id, text, extra) => ({ id, text, ...extra });
const note = (text) => ({ id: 'note', text, note: true });

// ما بين الأذان والإقامة: شعر في كل الصلوات، وسورة الكهف في صلاة الجمعة وحدها
const POETRY_LINE = 'بين الأذان والإقامة: كتابة شعر';
const KAHF_LINE = 'بين الأذان والإقامة: قراءة سورة الكهف';

function fajrItems(t) {
  return [
    it('adhan', 'ترديد الأذان ودعاء ما بعد الأذان'),
    it('sunnah', `سنة الفجر — ${t[0]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة الفجر'),
    it('dhikr', 'أذكار الصلاة'),
    it('morning', 'أذكار الصباح'),
    it('tahlil', 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (١٠٠ مرة)'),
    it('duha', `سنة الضحى — ${t[1]}`),
    note(PRAYER_NOTE),
  ];
}

// بلوك «مهام» الصباحي: بنود القرآن وحدها — والتمرين مهمة يومية عائمة تُعرض في كل بلوك مهام
function quranItems(st) {
  return quranTaskLines(st).map((l) => it(l.key, l.text, { pool: l.pool || undefined, quran: true }));
}

function dhuhrItems(t, friday) {
  return [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', `سنة الظهر القبلية — ${t[2]}`),
    it('between', friday ? KAHF_LINE : POETRY_LINE),
    it('pray', friday ? 'صلاة الجمعة' : 'صلاة الظهر'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', `سنة الظهر البعدية — ${t[3]}`),
    note(PRAYER_NOTE),
  ];
}

function asrItems(t) {
  return [
    it('adhan', 'ترديد الأذان'),
    it('sunnah', `سنة العصر — ${t[4]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة العصر'),
    it('dhikr', 'أذكار الصلاة'),
    it('sadaqah', 'صدقة أو صلاة على ميت'),
    note(PRAYER_NOTE),
  ];
}

function maghribItems(t, weekend) {
  // لا سنة قبلية للمغرب — وبين الأذان والإقامة وجبة رقم ٢ (وفي الجمعة والسبت شعر، فالوجبة نهارًا)
  return [
    it('adhan', 'ترديد الأذان ودعاء ما بعد الأذان'),
    it('between', weekend ? POETRY_LINE : 'بين الأذان والإقامة: وجبة رقم ٢'),
    it('pray', 'صلاة المغرب'),
    it('dhikr', 'أذكار الصلاة'),
    it('evening', 'أذكار المساء'),
    it('tasbih', 'سبحان الله وبحمده (١٠٠ مرة)'),
    it('sunnah', `سنة المغرب — ${t[5]}`),
    note(PRAYER_NOTE),
  ];
}

function ishaItems(t) {
  return [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', `سنة العشاء القبلية — ${t[6]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة العشاء'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', `سنة العشاء البعدية — ${t[7]}`),
    note(PRAYER_NOTE),
  ];
}

// القيام: وجبة رقم ١ (السحور) أيام الأحد–الخميس، وفي الجمعة والسبت تنتقل إلى نهارهما
function qiyamItems(weekend) {
  const base = [
    it('witr', 'صلاة الوتر'),
    it('dua', 'دعاء شامل'),
    it('tawbah', 'توبة'),
    it('istighfar', 'استغفار'),
  ];
  return weekend ? base : [...base, it('meal1', 'وجبة رقم ١ (سحور)')];
}

// بلوك ما بعد العشاء: «عائلة» أيام العمل و«أسرة» في الجمعة والسبت
const AILA_ITEMS = [it('aila', 'وقت مع العائلة')];
const ASRA_ITEMS = [it('asra', 'وقت مع الأسرة')];
// نهارا الجمعة والسبت: وجبة ١ قبل الظهر، ووجبة ٢ بعده، والجمعة وحدها فيها صلة رحم
const ASRA_DAY_FRI = [it('meal1', 'وجبة رقم ١'), it('asra', 'وقت مع الأسرة'), it('silah', 'صلة رحم')];
const ASRA_DAY_SAT = [it('meal1', 'وجبة رقم ١'), it('asra', 'وقت مع الأسرة')];
const MEAL2_WEEKEND = [it('meal2', 'وجبة رقم ٢')]; // الظهر←العصر، وتنتقل للعصر إن فاتت
const MEAL3_WEEKEND = [it('meal3', 'وجبة رقم ٣')]; // بلوك «أصدقاء» ما بعد العشاء
// الجمعة بعد العصر: عائلة وساعة استجابة الدعاء قبل المغرب في بلوك واحد
const AILA_DUAA_ITEMS = [
  it('aila', 'وقت مع العائلة'),
  it('duaa', 'ساعة استجابة الدعاء قبل المغرب — تفرّغ للدعاء'),
];
export const TASKS_TITLE = 'مهام'; // كل بلوكات العمل صارت «مهام»

// بداية الوحدة: مطلع الثلث الأخير من الليلة التي تسبق فجر dIso (دقائق من منتصف ليل dIso)
function lastThirdBefore(dIso) {
  const prevM = prayerTimes(addDays(dIso, -1)).maghrib - 1440; // مغرب أمس (قيمة سالبة)
  const F = prayerTimes(dIso).fajr;
  return prevM + Math.round((2 * (F - prevM)) / 3);
}

// وقت بداية وحدة dIso نصًّا — تستعمله الواجهة لتحديد الوحدة الجارية
export function unitStart(dIso) {
  return minToDateTime(dIso, lastThirdBefore(dIso));
}

// وحدة اليوم dIso: من نومة الثلث الأخير التي تسبق فجره إلى نهاية قيام ليلته — ١٥ حدثًا
export function buildUnit(dIso) {
  const nextIso = addDays(dIso, 1);
  const P1 = prayerTimes(dIso); // مواقيت اليوم كاملة
  const P2 = prayerTimes(nextIso); // فجر الغد (نهاية الوحدة)

  // كل الأزمنة دقائق منسوبة إلى منتصف ليل dIso (قد تتجاوز 1440)
  const F = P1.fajr;
  const SR = P1.sunrise;
  const DH = P1.dhuhr;
  const AS = P1.asr;
  const M = P1.maghrib;
  const ISH = P1.isha;
  const F2 = P2.fajr + 1440;
  const wake = lastThirdBefore(dIso); // أول الوحدة: النومة التي تصنع اليوم

  const night = F2 - M;
  const third1 = M + Math.round(night / 3); // نهاية بلوك ما بعد العشاء
  const third2 = M + Math.round((2 * night) / 3); // نهاية الثلث الثاني = نهاية الوحدة
  const qiyamStart = third2 - QIYAM_MINUTES; // آخر ٤٥ دقيقة من الثلث الثاني
  const day = dow(dIso); // 0=الأحد … 5=الجمعة، 6=السبت
  const friday = day === 5;
  const saturday = day === 6;
  const weekend = friday || saturday;

  // النومة ملاصقة للتمرين (ينام بعده مباشرة)، ثم العمل متصل منها إلى بلوك الظهر.
  // النومة تكمّل نوم الوحدة حتى مجموع ثابت: فإن قلّ ليلُك طالت نومتك وقصر عملك
  // ويوم الجمعة يبدأ بلوك الظهر مبكرًا بساعة (تبكير الجمعة) فيقصر العمل قبله
  const dhuhrStart = friday ? DH - 60 : DH;
  const trainEnd = SR + 90;
  const nightSleep = ISH - (M + 30) + (F - wake);
  const napLen = Math.max(
    NAP_MIN,
    Math.min(NAP_MAX, SLEEP_TARGET - nightSleep, dhuhrStart - trainEnd - WORK_MIN)
  );
  const napEnd = trainEnd + napLen;

  // كل سنن الوحدة (من الفجر إلى العشاء) على تثبيت يومها نفسه
  const st = quranStateFor(dIso);
  const t = tathbeetLabels(st);

  // نهارا الجمعة والسبت للأهل: الصباح «أسرة»، والظهر والعصر «عائلة»،
  // وبعد عصر الجمعة «عائلة ودعاء» (ساعة الاستجابة داخله)
  const workTitle = weekend ? 'أسرة' : TASKS_TITLE;
  const midTitle = weekend ? 'عائلة' : TASKS_TITLE;
  const lateTitle = friday ? 'عائلة ودعاء' : saturday ? 'عائلة' : TASKS_TITLE;
  // ما بعد العشاء: «عائلة» أيام العمل و«أسرة» في الجمعة والسبت
  const eveTitle = weekend ? 'أسرة' : 'عائلة';
  // الراحة: «أسرة» من الأحد إلى الخميس، و«أصدقاء» في الجمعة والسبت
  const restTitle = weekend ? 'أصدقاء' : 'أسرة';

  const ev = [];
  const push = (slot, title, start, end, colorId, items = [], transparent = false) => {
    ev.push({
      id: `${dIso}#${slot}`,
      unit: dIso,
      slot,
      title,
      start: minToDateTime(dIso, start),
      end: minToDateTime(dIso, end),
      colorId,
      items: items.map((x) => ({ ...x })), // نسخة لكل يوم: الثوابت المشتركة لا تُعدَّل
      transparent,
    });
  };

  // ── أول اليوم: نومة الثلث الأخير التي تسبق الفجر ──
  push('sleep2', 'نوم', wake, F, 8);
  // ── النهار: من الفجر إلى المغرب ──
  push('fajr', 'الفجر', F, F + 45, 10, fajrItems(t));
  // بلوك مهام واحد بدل بلوكي القرآن والتمرين — ومهمتا اليوم (القرآن والتمرين) تُعرضان في كل بلوك مهام
  push('quran', TASKS_TITLE, F + 45, trainEnd, 10, quranItems(st));
  // النومة تلي التمرين مباشرة، ثم العمل متصل منها حتى بلوك الظهر
  push('nap', 'نوم', trainEnd, napEnd, 8);
  push('work1', workTitle, napEnd, dhuhrStart, 6, friday ? ASRA_DAY_FRI : saturday ? ASRA_DAY_SAT : []);
  push('dhuhr', friday ? 'الجمعة' : 'الظهر', dhuhrStart, DH + 45, 9, dhuhrItems(t, friday));
  push('work2', midTitle, DH + 45, AS, 6, weekend ? MEAL2_WEEKEND : []);
  push('asr', 'العصر', AS, AS + 45, 9, asrItems(t));
  push('work3', lateTitle, AS + 45, M, 6, friday ? AILA_DUAA_ITEMS : []);
  // ── الليل: من المغرب إلى نهاية القيام (آخر الوحدة) ──
  push('maghrib', 'المغرب', M, M + 30, 9, maghribItems(t, weekend));
  push('sleep1', 'نوم', M + 30, ISH, 8); // من المغرب إلى العشاء
  push('isha', 'العشاء', ISH, ISH + 45, 9, ishaItems(t));
  push('family', eveTitle, ISH + 45, third1, 6, weekend ? ASRA_ITEMS : AILA_ITEMS);
  push('rest', restTitle, third1, qiyamStart, 8, weekend ? MEAL3_WEEKEND : [], !weekend);
  // آخر الوحدة: القيام — والنوم الذي يليه هو أول وحدة الغد
  push('qiyam', 'صلاة القيام', qiyamStart, third2, 9, qiyamItems(weekend));
  return ev;
}

// كل الأحداث في نطاق [fromIso, toIso] من وحدات الأيام (شاملة الطرفين)
export function buildRange(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(...buildUnit(d));
  return out;
}
