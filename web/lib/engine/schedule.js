// باني وحدة اليوم — من مغرب اليوم إلى مغرب الغد، أحداث متلاصقة بصفر فجوات
// اليوم يبدأ بالمغرب (١٤ أغسطس ٢٠٢٦): فليلُ الوحدة من اليوم نفسه، ونهارُها من الغد
//  • الليل: المغرب ← نوم ← العشاء ← أسرة ← راحة ← قيام ← نوم الثلث الأخير
//  • النهار: الفجر ← قرآن وسنة الضحى ← تمرين ← عمل متصل ← نومة الضحى ← الظهر ← عمل ← العصر ← عمل
//  • قواعد الليل تتبع يوم الوحدة نفسه، وقواعد النهار تتبع يوم الغد (الجمعة/السبت أسرة)
import { addDays, dow, minToDateTime, arab } from './dates.js';
import { prayerTimes } from './prayers.js';
import { quranStateFor, quranTaskLines, tathbeetLabels } from './quran.js';
import { workoutDayType, workoutTitle, workoutDesc } from './workout.js';

const PRAYER_NOTE =
  'ملاحظات: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة.';

// مجموع نوم الوحدة المستهدف: نومة الضحى تكمّل ما نقص من نوم الليل
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

// ما بين الأذان والإقامة: شعر في كل الصلوات، وسورة الكهف في صلاة الجمعة وحدها
const POETRY_LINE = 'بين الأذان والإقامة: كتابة شعر';
const KAHF_LINE = 'بين الأذان والإقامة: قراءة سورة الكهف';

function fajrDesc(t) {
  return [
    '١. ترديد الأذان ودعاء ما بعد الأذان',
    `٢. سنة الفجر — ${t[3]}`,
    `٣. ${POETRY_LINE}`,
    '٤. صلاة الفجر',
    '٥. أذكار الصلاة',
    '٦. أذكار الصباح',
    '٧. لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (١٠٠ مرة)',
    PRAYER_NOTE,
  ].join('\n');
}

function quranDesc(st, t) {
  const rows = quranTaskLines(st).map((l) => l.text);
  rows.push(`سنة الضحى — ${t[4]}`);
  return rows.map((r, i) => `${arab(i + 1)}. ${r}`).join('\n');
}

function dhuhrDesc(t, friday) {
  return [
    '١. ترديد الأذان',
    `٢. سنة الظهر القبلية — ${t[5]}`,
    `٣. ${friday ? KAHF_LINE : POETRY_LINE}`,
    `٤. ${friday ? 'صلاة الجمعة' : 'صلاة الظهر'}`,
    '٥. أذكار الصلاة',
    `٦. سنة الظهر البعدية — ${t[6]}`,
    PRAYER_NOTE,
  ].join('\n');
}

function asrDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة العصر — ${t[7]}`,
    `٣. ${POETRY_LINE}`,
    '٤. صلاة العصر',
    '٥. أذكار الصلاة',
    '٦. صدقة أو صلاة على ميت',
    PRAYER_NOTE,
  ].join('\n');
}

function maghribDesc(t, nightWeekend) {
  // لا سنة قبلية للمغرب — وبين الأذان والإقامة وجبة رقم ٢ (وفي ليلتي الجمعة والسبت شعر، فالوجبة نهارًا)
  return [
    '١. ترديد الأذان ودعاء ما بعد الأذان',
    `٢. ${nightWeekend ? POETRY_LINE : 'بين الأذان والإقامة: وجبة رقم ٢'}`,
    '٣. صلاة المغرب',
    '٤. أذكار الصلاة',
    '٥. أذكار المساء',
    '٦. سبحان الله وبحمده (١٠٠ مرة)',
    `٧. سنة المغرب — ${t[0]}`,
    PRAYER_NOTE,
  ].join('\n');
}

function ishaDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة العشاء القبلية — ${t[1]}`,
    `٣. ${POETRY_LINE}`,
    '٤. صلاة العشاء',
    '٥. أذكار الصلاة',
    `٦. سنة العشاء البعدية — ${t[2]}`,
    PRAYER_NOTE,
  ].join('\n');
}

// القيام: وجبة رقم ١ (السحور) إذا كان نهار الوحدة يوم عمل، وتُحذف إن كان جمعة أو سبتًا (وجباتهما نهارية)
const QIYAM_BASE = ['١. صلاة الوتر', '٢. دعاء شامل', '٣. توبة', '٤. استغفار'];
const QIYAM_DESC = [...QIYAM_BASE, '٥. وجبة رقم ١ (سحور)'].join('\n');
const QIYAM_DESC_NO_MEAL = QIYAM_BASE.join('\n');
const FAMILY_DESC = '١. وقت مع الأسرة';
// نهارا الجمعة والسبت «أسرة»: وجبة ١ قبل الظهر، ووجبة ٢ بعده، والجمعة وحدها فيها صلة رحم
const ASRA_DAY_FRI = '١. وجبة رقم ١\n٢. وقت مع الأسرة\n٣. صلة رحم';
const ASRA_DAY_SAT = '١. وجبة رقم ١\n٢. وقت مع الأسرة';
const MEAL2_WEEKEND = '١. وجبة رقم ٢'; // الظهر←العصر، وتنتقل للعصر إن فاتت
const MEAL3_WEEKEND = '١. وجبة رقم ٣'; // راحة ما بعد العشاء في ليلتي الجمعة والسبت
// الجمعة بعد العصر: أسرة وساعة استجابة الدعاء قبل المغرب في بلوك واحد
const ASRA_DUAA_DESC = '١. وقت مع الأسرة\n٢. ساعة استجابة الدعاء قبل المغرب — تفرّغ للدعاء';
const WORK_DESC = 'مهام اليوم — تُكتب هنا (حرّر الوصف وأضف سطرًا لكل مهمة).';

// وحدة اليوم dIso: من مغرب dIso إلى مغرب الغد — ١٦ حدثًا
// ليلها من dIso نفسه، ونهارها من الغد: فالعمود يعرض ليلتك ثم نهارك القادم
export function buildUnit(dIso) {
  const nextIso = addDays(dIso, 1);
  const P1 = prayerTimes(dIso); // مغرب الوحدة وعشاؤها
  const P2 = prayerTimes(nextIso); // نهار الوحدة كاملًا (فجر الغد ← مغربه)

  // كل الأزمنة دقائق منسوبة إلى منتصف ليل dIso (وأزمنة الغد تتجاوز 1440)
  const M = P1.maghrib;
  const ISH = P1.isha;
  const F = P2.fajr + 1440;
  const SR = P2.sunrise + 1440;
  const DH = P2.dhuhr + 1440;
  const AS = P2.asr + 1440;
  const M2 = P2.maghrib + 1440; // نهاية الوحدة = بداية وحدة الغد

  const night = F - M;
  const third1 = M + Math.round(night / 3); // نهاية «أسرة» الليلية
  const third2 = M + Math.round((2 * night) / 3); // نهاية الثلث الثاني: يليه نوم
  const qiyamStart = third2 - QIYAM_MINUTES; // آخر ٤٥ دقيقة من الثلث الثاني

  // قواعد الليل تتبع يوم الوحدة، وقواعد النهار تتبع الغد (0=الأحد … 5=الجمعة، 6=السبت)
  const nightDay = dow(dIso);
  const dayDay = dow(nextIso);
  const nightWeekend = nightDay === 5 || nightDay === 6; // ليلتا الجمعة والسبت: وجبة ٣ ولا سحور
  const friday = dayDay === 5; // نهار الجمعة
  const saturday = dayDay === 6;
  const dayWeekend = friday || saturday; // نهار أسرة بثلاث وجبات

  // العمل متصل بعد التمرين، ثم نومة الضحى ملاصقة لبلوك الظهر.
  // النومة تكمّل نوم الليل حتى مجموع ثابت: فإن قلّ ليلُك طالت نومتك وقصر عملك
  // ويوم الجمعة يبدأ بلوك الظهر مبكرًا بساعة (تبكير الجمعة) فتنتهي النومة قبله
  const dhuhrStart = friday ? DH - 60 : DH;
  const trainEnd = SR + 90;
  const nightSleep = ISH - (M + 30) + (F - third2);
  const napLen = Math.max(
    NAP_MIN,
    Math.min(NAP_MAX, SLEEP_TARGET - nightSleep, dhuhrStart - trainEnd - WORK_MIN)
  );
  const napStart = dhuhrStart - napLen;

  // كل سنن الوحدة (من المغرب إلى عصر الغد) على تثبيت الوحدة نفسها
  const st = quranStateFor(dIso);
  const t = tathbeetLabels(st);

  const trainType = workoutDayType(dIso);
  // نهارا الجمعة والسبت للأهل، وبعد عصر الجمعة «أسرة ودعاء» (ساعة الاستجابة داخله)
  const workTitle = dayWeekend ? 'أسرة' : 'عمل';
  const midTitle = dayWeekend ? 'أسرة' : 'عمل';
  const lateTitle = friday ? 'أسرة ودعاء' : saturday ? 'أسرة' : 'عمل';

  const ev = [];
  const push = (slot, title, start, end, colorId, desc = '', transparent = false) => {
    ev.push({
      id: `${dIso}#${slot}`,
      unit: dIso,
      slot,
      title,
      start: minToDateTime(dIso, start),
      end: minToDateTime(dIso, end),
      colorId,
      desc,
      transparent,
    });
  };

  // ── الليل: من مغرب اليوم إلى فجر الغد ──
  push('maghrib', 'المغرب', M, M + 30, 9, maghribDesc(t, nightWeekend));
  push('sleep1', 'نوم', M + 30, ISH, 8); // من المغرب إلى العشاء
  push('isha', 'العشاء', ISH, ISH + 45, 9, ishaDesc(t));
  push('family', 'أسرة', ISH + 45, third1, 6, FAMILY_DESC);
  push('rest', 'راحة', third1, qiyamStart, 8, nightWeekend ? MEAL3_WEEKEND : '', !nightWeekend);
  push('qiyam', 'صلاة القيام', qiyamStart, third2, 9, dayWeekend ? QIYAM_DESC_NO_MEAL : QIYAM_DESC);
  push('sleep2', 'نوم', third2, F, 8); // الثلث الأخير من الليل
  // ── النهار: من فجر الغد إلى مغربه ──
  push('fajr', 'الفجر', F, F + 45, 10, fajrDesc(t));
  push('quran', 'قرآن وسنة الضحى', F + 45, SR + 15, 10, quranDesc(st, t));
  push('train', workoutTitle(dIso), SR + 15, SR + 90, 10, trainType ? workoutDesc(dIso) : '');
  // العمل متصل من نهاية التمرين حتى نومة الضحى، والنومة ملاصقة لبلوك الظهر
  push('work1', workTitle, trainEnd, napStart, 6, friday ? ASRA_DAY_FRI : saturday ? ASRA_DAY_SAT : WORK_DESC);
  push('nap', 'نوم', napStart, dhuhrStart, 8);
  push('dhuhr', friday ? 'الجمعة' : 'الظهر', dhuhrStart, DH + 45, 9, dhuhrDesc(t, friday));
  push('work2', midTitle, DH + 45, AS, 6, dayWeekend ? MEAL2_WEEKEND : '');
  push('asr', 'العصر', AS, AS + 45, 9, asrDesc(t));
  push('work3', lateTitle, AS + 45, M2, 6, friday ? ASRA_DUAA_DESC : '');
  return ev;
}

// كل الأحداث في نطاق [fromIso, toIso] من وحدات الأيام (شاملة الطرفين)
export function buildRange(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(...buildUnit(d));
  return out;
}
