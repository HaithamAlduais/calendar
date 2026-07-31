// باني وحدة اليوم — من مغرب أمس إلى مغرب اليوم، أحداث متلاصقة بصفر فجوات
// التصميم المعتمد (بتعديلات ٣١ يوليو ٢٠٢٦):
//  • النوم بعد التمرين/التطوير بدل القيلولة، والعمل متصل من الاستيقاظ حتى المغرب
//  • ما تبقى من الثلث الأول من الليل بعد العشاء = «أسرة»
//  • الراحة تنتهي ببداية القيام (آخر ٣٠ دقيقة من الثلث الثاني) — واسمها «زوجة» من الأحد للخميس و«راحة» الجمعة والسبت
import { addDays, dow, minToDateTime } from './dates.js';
import { prayerTimes } from './prayers.js';
import { quranStateFor, reviewLine, hifzLine, tathbeetLabels } from './quran.js';
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

function fajrDesc(t) {
  return [
    '١. ترديد الأذان ودعاء ما بعد الأذان',
    `٢. سنة الفجر — ${t[0]}`,
    '٣. صلاة الفجر',
    '٤. أذكار الصلاة',
    '٥. أذكار الصباح',
    '٦. لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (١٠٠ مرة)',
    PRAYER_NOTE,
  ].join('\n');
}

function quranDesc(st, t) {
  return [`١. ${reviewLine(st)}`, `٢. ${hifzLine(st)}`, `٣. سنة الضحى — ${t[1]}`].join('\n');
}

function dhuhrDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة الظهر القبلية — ${t[2]}`,
    '٣. صلاة الظهر',
    '٤. أذكار الصلاة',
    `٥. سنة الظهر البعدية — ${t[3]}`,
    PRAYER_NOTE,
  ].join('\n');
}

function asrDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة العصر — ${t[4]}`,
    '٣. صلاة العصر',
    '٤. أذكار الصلاة',
    '٥. صدقة أو صلاة على ميت',
    PRAYER_NOTE,
  ].join('\n');
}

function maghribDesc(t) {
  return [
    '١. ترديد الأذان ودعاء ما بعد الأذان',
    '٢. صلاة المغرب',
    '٣. أذكار الصلاة',
    '٤. أذكار المساء',
    '٥. سبحان الله وبحمده (١٠٠ مرة)',
    `٦. سنة المغرب — ${t[5]}`,
    PRAYER_NOTE,
  ].join('\n');
}

function ishaDesc(t) {
  return [
    '١. ترديد الأذان',
    `٢. سنة العشاء القبلية — ${t[6]}`,
    '٣. صلاة العشاء',
    '٤. أذكار الصلاة',
    `٥. سنة العشاء البعدية — ${t[7]}`,
    PRAYER_NOTE,
  ].join('\n');
}

const QIYAM_DESC = ['١. صلاة الوتر', '٢. دعاء شامل', '٣. توبة', '٤. استغفار'].join('\n');
const FAMILY_DESC = '١. وجبة (متى تيسّر)\n٢. وقت مع الأسرة';
const FAMILY_DAY_DESC = '١. وجبة (متى تيسّر)\n٢. وقت مع العائلة';
const DUAA_DESC = 'ساعة استجابة الدعاء قبل مغرب الجمعة — تفرّغ للدعاء.';
const WORK_DESC = 'مهام اليوم — تُكتب هنا (حرّر الوصف وأضف سطرًا لكل مهمة).';

// وحدة اليوم dIso: من مغرب اليوم السابق إلى مغرب dIso — ١٦ حدثًا (١٧ يوم الجمعة بساعة الدعاء)
export function buildUnit(dIso) {
  const prevIso = addDays(dIso, -1);
  const P0 = prayerTimes(prevIso); // مغرب وعشاء الليلة (أمس فلكيًا)
  const P1 = prayerTimes(dIso); // مواقيت نهار اليوم

  // كل الأزمنة دقائق منسوبة إلى منتصف ليل prevIso (قد تتجاوز 1440)
  const M0 = P0.maghrib;
  const ISH = P0.isha;
  const F = P1.fajr + 1440;
  const SR = P1.sunrise + 1440;
  const DH = P1.dhuhr + 1440;
  const AS = P1.asr + 1440;
  const M1 = P1.maghrib + 1440;

  const night = F - M0;
  const third1 = M0 + Math.round(night / 3);
  const third2 = M0 + Math.round((2 * night) / 3);
  const qiyamStart = third2 - 30;
  const napEnd = SR + 90 + NAP_MINUTES;

  const day = dow(dIso); // 0=الأحد … 5=الجمعة، 6=السبت
  const friday = day === 5;
  const restName = day === 5 || day === 6 ? 'راحة' : 'زوجة';

  const stPrev = quranStateFor(prevIso); // سنن المغرب والعشاء تتبع تثبيت يومها (أمس)
  const stToday = quranStateFor(dIso);
  const tPrev = stPrev ? tathbeetLabels(stPrev) : tathbeetLabels(stToday);
  const tToday = tathbeetLabels(stToday);

  const trainType = workoutDayType(dIso);

  const ev = [];
  const push = (slot, title, start, end, colorId, desc = '', transparent = false) => {
    ev.push({
      id: `${dIso}#${slot}`,
      unit: dIso,
      slot,
      title,
      start: minToDateTime(prevIso, start),
      end: minToDateTime(prevIso, end),
      colorId,
      desc,
      transparent,
    });
  };

  push('maghrib', 'المغرب', M0, M0 + 30, 9, maghribDesc(tPrev));
  push('sleep1', 'نوم', M0 + 30, ISH, 8);
  push('isha', 'العشاء', ISH, ISH + 45, 9, ishaDesc(tPrev));
  push('family', 'أسرة', ISH + 45, third1, 6, FAMILY_DESC);
  push('rest', restName, third1, qiyamStart, 8, '', true);
  push('qiyam', 'صلاة القيام', qiyamStart, third2, 9, QIYAM_DESC);
  push('sleep2', 'نوم', third2, F, 8);
  push('fajr', 'الفجر', F, F + 45, 10, fajrDesc(tToday));
  push('quran', 'قرآن وسنة الضحى', F + 45, SR + 15, 10, quranDesc(stToday, tToday));
  push('train', workoutTitle(dIso), SR + 15, SR + 90, 10, trainType ? workoutDesc(dIso) : '');
  // نهار الجمعة «عائلة» لا «عمل»
  const workTitle = friday ? 'عائلة' : 'عمل';
  push('nap', 'نوم', SR + 90, napEnd, 8);
  push('work1', workTitle, napEnd, DH, 6, friday ? FAMILY_DAY_DESC : WORK_DESC);
  push('dhuhr', 'الظهر', DH, DH + 45, 9, dhuhrDesc(tToday));
  push('work2', workTitle, DH + 45, AS, 6);
  push('asr', 'العصر', AS, AS + 45, 9, asrDesc(tToday));
  if (friday) {
    push('work3', workTitle, AS + 45, M1 - 60, 6);
    push('duaa', 'دعاء', M1 - 60, M1, 9, DUAA_DESC);
  } else {
    push('work3', workTitle, AS + 45, M1, 6);
  }
  return ev;
}

// كل الأحداث في نطاق [fromIso, toIso] من وحدات الأيام (شاملة الطرفين)
export function buildRange(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(...buildUnit(d));
  return out;
}
