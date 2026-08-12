// باني وحدة اليوم — من مغرب أمس إلى مغرب اليوم، أحداث متلاصقة بصفر فجوات
// التصميم المعتمد (بتعديلات ٣١ يوليو ٢٠٢٦):
//  • النوم بعد التمرين/التطوير بدل القيلولة، والعمل متصل من الاستيقاظ حتى المغرب
//  • ما تبقى من الثلث الأول من الليل بعد العشاء = «أسرة»
//  • الراحة تنتهي ببداية القيام (آخر ٣٠ دقيقة من الثلث الثاني) — واسمها «زوجة» من الأحد للخميس و«راحة» الجمعة والسبت
import { addDays, dow, minToDateTime, arab } from './dates.js';
import { prayerTimes } from './prayers.js';
import { quranStateFor, quranTaskLines, tathbeetLabels } from './quran.js';
import { workoutDayType, workoutTitle, workoutDesc } from './workout.js';

const PRAYER_NOTE =
  'ملاحظات: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة.';

const NAP_MINUTES = 150; // نومة الضحى — بعد فترة العمل الأولى
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
    `٢. سنة الفجر — ${t[0]}`,
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
  rows.push(`سنة الضحى — ${t[1]}`);
  return rows.map((r, i) => `${arab(i + 1)}. ${r}`).join('\n');
}

function dhuhrDesc(t, friday) {
  return [
    '١. ترديد الأذان',
    `٢. سنة الظهر القبلية — ${t[2]}`,
    `٣. ${friday ? KAHF_LINE : POETRY_LINE}`,
    `٤. ${friday ? 'صلاة الجمعة' : 'صلاة الظهر'}`,
    '٥. أذكار الصلاة',
    `٦. سنة الظهر البعدية — ${t[3]}`,
    PRAYER_NOTE,
  ].join('\n');
}

function asrDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة العصر — ${t[4]}`,
    `٣. ${POETRY_LINE}`,
    '٤. صلاة العصر',
    '٥. أذكار الصلاة',
    '٦. صدقة أو صلاة على ميت',
    PRAYER_NOTE,
  ].join('\n');
}

function maghribDesc(t, weekend) {
  // لا سنة قبلية للمغرب — وبين الأذان والإقامة وجبة رقم ٢ (وفي الجمعة والسبت شعر، فالوجبة نهارًا)
  return [
    '١. ترديد الأذان ودعاء ما بعد الأذان',
    `٢. ${weekend ? POETRY_LINE : 'بين الأذان والإقامة: وجبة رقم ٢'}`,
    '٣. صلاة المغرب',
    '٤. أذكار الصلاة',
    '٥. أذكار المساء',
    '٦. سبحان الله وبحمده (١٠٠ مرة)',
    `٧. سنة المغرب — ${t[5]}`,
    PRAYER_NOTE,
  ].join('\n');
}

function ishaDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة العشاء القبلية — ${t[6]}`,
    `٣. ${POETRY_LINE}`,
    '٤. صلاة العشاء',
    '٥. أذكار الصلاة',
    `٦. سنة العشاء البعدية — ${t[7]}`,
    PRAYER_NOTE,
  ].join('\n');
}

// القيام: وجبة رقم ١ (السحور) أيام الأحد–الخميس، وفي الجمعة والسبت تنتقل إلى نهارهما
const QIYAM_BASE = ['١. صلاة الوتر', '٢. دعاء شامل', '٣. توبة', '٤. استغفار'];
const QIYAM_DESC = [...QIYAM_BASE, '٥. وجبة رقم ١ (سحور)'].join('\n');
const QIYAM_DESC_WEEKEND = QIYAM_BASE.join('\n');
const FAMILY_DESC = '١. وقت مع الأسرة';
// نهارا الجمعة والسبت «أسرة»: وجبة ١ قبل الظهر، ووجبة ٢ بعده، والجمعة وحدها فيها صلة رحم
const ASRA_DAY_FRI = '١. وجبة رقم ١\n٢. وقت مع الأسرة\n٣. صلة رحم';
const ASRA_DAY_SAT = '١. وجبة رقم ١\n٢. وقت مع الأسرة';
const MEAL2_WEEKEND = '١. وجبة رقم ٢'; // الظهر←العصر، وتنتقل للعصر إن فاتت
const MEAL3_WEEKEND = '١. وجبة رقم ٣'; // راحة ما بعد العشاء
// الجمعة بعد العصر: أسرة وساعة استجابة الدعاء قبل المغرب في بلوك واحد
const ASRA_DUAA_DESC = '١. وقت مع الأسرة\n٢. ساعة استجابة الدعاء قبل المغرب — تفرّغ للدعاء';
const WORK_DESC = 'مهام اليوم — تُكتب هنا (حرّر الوصف وأضف سطرًا لكل مهمة).';

// وحدة اليوم dIso: من فجر اليوم إلى فجر الغد — ١٦ حدثًا (١٧ يوم الجمعة بساعة الدعاء)
// أول اليوم صلاة الفجر، نهاره حتى المغرب، ثم ليله (المغرب ← فجر الغد) في العمود نفسه
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

  const night = F2 - M;
  const third1 = M + Math.round(night / 3); // نهاية «أسرة» الليلية
  const third2 = M + Math.round((2 * night) / 3); // نهاية الثلث الثاني: يليه نوم
  const qiyamStart = third2 - QIYAM_MINUTES; // آخر ٤٥ دقيقة من الثلث الثاني
  // نومة الضحى بعد فترة العمل الأولى: يُقسم ما قبل الظهر نصفين حولها
  const trainEnd = SR + 90;
  const avail = Math.max(0, DH - trainEnd - NAP_MINUTES);
  const work1End = trainEnd + Math.round(avail / 2);
  const napEnd = Math.min(DH, work1End + NAP_MINUTES);

  const day = dow(dIso); // 0=الأحد … 5=الجمعة، 6=السبت
  const friday = day === 5;
  const saturday = day === 6;
  const weekend = friday || saturday;

  // كل سنن الوحدة (من الفجر إلى العشاء) على تثبيت يومها نفسه
  const st = quranStateFor(dIso);
  const t = tathbeetLabels(st);

  const trainType = workoutDayType(dIso);
  // نهارا الجمعة والسبت للأهل: الأول «أسرة»، وما بعده يجمع «أسرة وزوجة»،
  // وبعد عصر الجمعة «أسرة ودعاء» (ساعة الاستجابة داخله)
  const workTitle = weekend ? 'أسرة' : 'عمل';
  const midTitle = weekend ? 'أسرة' : 'عمل';
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

  // ── النهار: من الفجر إلى المغرب ──
  push('fajr', 'الفجر', F, F + 45, 10, fajrDesc(t));
  push('quran', 'قرآن وسنة الضحى', F + 45, SR + 15, 10, quranDesc(st, t));
  push('train', workoutTitle(dIso), SR + 15, SR + 90, 10, trainType ? workoutDesc(dIso) : '');
  // العمل الأول ثم نومة الضحى ثم العمل الثاني حتى الظهر
  push('work1', workTitle, trainEnd, work1End, 6, friday ? ASRA_DAY_FRI : saturday ? ASRA_DAY_SAT : WORK_DESC);
  push('nap', 'نوم', work1End, napEnd, 8); // نومة الضحى بين فترتي العمل
  push('work2', midTitle, napEnd, DH, 6);
  push('dhuhr', 'الظهر', DH, DH + 45, 9, dhuhrDesc(t, friday));
  push('work3', midTitle, DH + 45, AS, 6, weekend ? MEAL2_WEEKEND : '');
  push('asr', 'العصر', AS, AS + 45, 9, asrDesc(t));
  push('work4', lateTitle, AS + 45, M, 6, friday ? ASRA_DUAA_DESC : '');
  // ── الليل: من المغرب إلى فجر الغد ──
  push('maghrib', 'المغرب', M, M + 30, 9, maghribDesc(t, weekend));
  push('sleep1', 'نوم', M + 30, ISH, 8); // من المغرب إلى العشاء
  push('isha', 'العشاء', ISH, ISH + 45, 9, ishaDesc(t));
  push('family', 'أسرة', ISH + 45, third1, 6, FAMILY_DESC);
  push('rest', 'راحة', third1, qiyamStart, 8, weekend ? MEAL3_WEEKEND : '', !weekend);
  push('qiyam', 'صلاة القيام', qiyamStart, third2, 9, weekend ? QIYAM_DESC_WEEKEND : QIYAM_DESC);
  push('sleep2', 'نوم', third2, F2, 8); // الثلث الأخير من الليل
  return ev;
}

// كل الأحداث في نطاق [fromIso, toIso] من وحدات الأيام (شاملة الطرفين)
export function buildRange(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(...buildUnit(d));
  return out;
}
