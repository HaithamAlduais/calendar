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

const NAP_MINUTES = 150; // نوم ما بعد التمرين (كان القيلولة: ساعتان ونصف)

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

function maghribDesc(t) {
  // لا سنة قبلية للمغرب — الشعر بعد الترديد مباشرة
  return [
    '١. ترديد الأذان ودعاء ما بعد الأذان',
    `٢. ${POETRY_LINE}`,
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

const QIYAM_DESC = ['١. صلاة الوتر', '٢. دعاء شامل', '٣. توبة', '٤. استغفار'].join('\n');
const FAMILY_DESC = '١. وجبة (متى تيسّر)\n٢. وقت مع الأسرة';
// نهارا الجمعة والسبت «أسرة» — والجمعة وحدها فيها صلة رحم
const ASRA_DAY_FRI = '١. وجبة (متى تيسّر)\n٢. وقت مع الأسرة\n٣. صلة رحم';
const ASRA_DAY_SAT = '١. وجبة (متى تيسّر)\n٢. وقت مع الأسرة';
const DUAA_DESC = 'ساعة استجابة الدعاء قبل مغرب الجمعة — تفرّغ للدعاء.';
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
  const third1 = M + Math.round(night / 3);
  const third2 = M + Math.round((2 * night) / 3);
  const qiyamStart = third2 - 30;
  const napEnd = SR + 90 + NAP_MINUTES;

  const day = dow(dIso); // 0=الأحد … 5=الجمعة، 6=السبت
  const friday = day === 5;
  const saturday = day === 6;
  // ليل الجمعة والسبت «أصدقاء»، وبقية الليالي «زوجة»
  const restName = friday || saturday ? 'أصدقاء' : 'زوجة';

  // كل سنن الوحدة (من الفجر إلى العشاء) على تثبيت يومها نفسه
  const st = quranStateFor(dIso);
  const t = tathbeetLabels(st);

  const trainType = workoutDayType(dIso);
  // نهارا الجمعة والسبت «أسرة» لا «عمل»
  const workTitle = friday || saturday ? 'أسرة' : 'عمل';

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
  push('nap', 'نوم', SR + 90, napEnd, 8);
  push('work1', workTitle, napEnd, DH, 6, friday ? ASRA_DAY_FRI : saturday ? ASRA_DAY_SAT : WORK_DESC);
  push('dhuhr', 'الظهر', DH, DH + 45, 9, dhuhrDesc(t, friday));
  push('work2', workTitle, DH + 45, AS, 6);
  push('asr', 'العصر', AS, AS + 45, 9, asrDesc(t));
  if (friday) {
    push('work3', workTitle, AS + 45, M - 60, 6);
    push('duaa', 'دعاء', M - 60, M, 9, DUAA_DESC);
  } else {
    push('work3', workTitle, AS + 45, M, 6);
  }
  // ── الليل: من المغرب إلى فجر الغد ──
  push('maghrib', 'المغرب', M, M + 30, 9, maghribDesc(t));
  push('sleep1', 'لعب أو نوم', M + 30, ISH, 8);
  push('isha', 'العشاء', ISH, ISH + 45, 9, ishaDesc(t));
  push('family', 'أسرة', ISH + 45, third1, 6, FAMILY_DESC);
  push('rest', restName, third1, qiyamStart, 8, '', true);
  push('qiyam', 'صلاة القيام', qiyamStart, third2, 9, QIYAM_DESC);
  push('sleep2', 'نوم', third2, F2, 8);
  return ev;
}

// كل الأحداث في نطاق [fromIso, toIso] من وحدات الأيام (شاملة الطرفين)
export function buildRange(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(...buildUnit(d));
  return out;
}
