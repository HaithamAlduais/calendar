// جدول هيثم — بياناتٌ محضة يقرأها محرك القالب. وهو الجدول الافتراضي للبرنامج
// ومعيارُ اختبار المطابقة معًا: إن عجز نموذجُ البيانات عن وصفه فالنموذج ناقص.
//
// اليوم أربعٌ وعشرون ساعة تبدأ بالفَحْمة (بلوك الراحة) وتنتهي بها، ومواقيتُه
// مراسٍ فلكية تتحرك مع الشمس: مواقيت الصلاة، وساعاتُ الليل والنهار الزمانية
// عند العرب — والليل اثنتا عشرة ساعة من المغرب إلى الفجر، والنهار مثلها من
// الشروق إلى المغرب:
//   الفَحْمة  = مطلع الساعة الخامسة من الليل  → nightHour 4
//   الهَزيع   = نصف الليل                      → nightHour 6
//   الغَزالة  = مطلع الساعة الرابعة من النهار  → dayHour 3
//   الهاجِرة  = مطلع الساعة الخامسة من النهار  → dayHour 4
//
// وبلوكاته خمسة لا سادس لها: صلاة، ومهام، وأسرة، وعائلة، وراحة — ومعها النوم
// والقيام والروتين. وبلوكات الأسرة لا يُنقر عليها: وقتٌ لا يُطالَب فيه بشيء.
//
// والأسبوع يبدأ السبت، وأيامُه كلُّها سواء — إلا الجمعة، فبلوكات مهامها
// تُسمّى «عائلة»، وما عداها كسائر الأيام حرفًا بحرف.

const it = (id, text, extra) => ({ id, text, ...extra });

const PRAYER_NOTE =
  'ملاحظات: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة.';
const note = () => ({ id: 'note', text: PRAYER_NOTE, note: true });

// ── بنود القيام: الوجبة الأولى ثم الوتر ثم الدعاء ثم التوبة والاستخارة ──
// بنودُ القيام يولّدها المحرك (qiyamNight) ليحمل وترُها موضعَ المراجعة —
// وهذه صورتُها الساكنة لمن أراد تحريرها بيده من الواجهة
export const qiyamItems = [
  it('meal1', 'وجبة رقم ١', { meal: 1 }),
  it('witr', 'صلاة الوتر'),
  it('dua', 'دعاء'),
  it('tawbah', 'توبة واستخارة'),
];

// ── القالب: ٢٤ ساعة من الفَحْمة إلى الفَحْمة ──
// `work` اسمُ بلوكات المهام: «مهام» في عامة الأيام، و«عائلة» يوم الجمعة
function makeDay(work) {
  return {
    name: work === 'عائلة' ? 'الجمعة' : 'يومي',
    // الوحدة تبدأ بالفَحْمة — وهي مرساة الليلة السابقة لبلوك الراحة
    start: { nightHour: 4, prevDay: true },
    blocks: [
      // ١) الراحة: من الفَحْمة إلى الهَزيع — أول اليوم، وإليها تُورَّث مهام الأمس
      {
        id: 'rest',
        title: 'راحة',
        colorId: 8,
        task: true,
        items: [],
        // الهَزيع من الليلة نفسِها التي بدأت بها الراحة، لا من ليلة الغد
        end: { nightHour: 6, prevDay: true },
      },
      // ٢) النوم: من الهَزيع إلى ما قبل الفجر بخمسٍ وأربعين — لا يُنقر عليه
      { id: 'sleep1', title: 'نوم', colorId: 8, sleep: true, locked: true, end: { prayer: 'fajr', offset: -45 } },
      // ٣) القيام: آخر خمسٍ وأربعين قبل الفجر — وفي وتره تُسمَّع المراجعة
      { id: 'qiyam', title: 'قيام الليل', colorId: 9, gen: 'qiyamNight', end: { prayer: 'fajr' } },
      // ٤) الفجر
      { id: 'fajr', title: 'الفجر', colorId: 10, gen: 'fajr', end: { len: 45 } },
      // ٥) الروتين: إلى الشروق وربع — يومُ قرآنٍ ويومُ تمرين بالتناوب.
      //    وهو مستضيفُ مهام اليوم، فبطاقةُ التمرين تُفتح منه يومَ التمرين
      { id: 'routine', title: 'الروتين', colorId: 10, gen: 'routine', task: true, end: { prayer: 'sunrise', offset: 15 } },
      // ٦) النوم: إلى الغَزالة — لا يُنقر عليه
      { id: 'sleep2', title: 'نوم', colorId: 8, sleep: true, locked: true, end: { dayHour: 3 } },
      // ٧) الأسرة: من الغَزالة إلى الهاجِرة — لا يُنقر عليه
      { id: 'family1', title: 'أسرة', colorId: 9, locked: true, end: { dayHour: 4 } },
      // ٨) المهام: من الهاجِرة إلى الظهر — وفيها الوجبة الثانية
      {
        id: 'work1',
        title: work,
        colorId: 6,
        task: true,
        items: [it('meal2', 'وجبة رقم ٢', { meal: 2, fastingSkip: true })],
        end: { prayer: 'dhuhr' },
      },
      // ٩) الظهر
      { id: 'dhuhr', title: 'الظهر', colorId: 10, gen: 'dhuhr', end: { prayer: 'dhuhr', offset: 45 } },
      // ١٠) مهام إلى العصر
      { id: 'work2', title: work, colorId: 6, task: true, items: [], end: { prayer: 'asr' } },
      // ١١) العصر
      { id: 'asr', title: 'العصر', colorId: 10, gen: 'asr', end: { len: 45 } },
      // ١٢) مهام إلى المغرب
      { id: 'work3', title: work, colorId: 6, task: true, items: [], end: { prayer: 'maghrib' } },
      // ١٣) المغرب — ما بين الأذان والإقامة شِعر
      { id: 'maghrib', title: 'المغرب', colorId: 10, gen: 'maghribWeekend', end: { len: 30 } },
      // ١٤) الأسرة: من المغرب إلى العشاء — لا يُنقر عليه
      { id: 'family2', title: 'أسرة', colorId: 9, locked: true, end: { prayer: 'isha' } },
      // ١٥) العشاء
      { id: 'isha', title: 'العشاء', colorId: 10, gen: 'isha', end: { len: 45 } },
      // ١٦) الأسرة: من العشاء إلى الفَحْمة — وفيها الوجبة الثالثة
      {
        id: 'family',
        title: 'أسرة',
        colorId: 6,
        task: true,
        items: [it('meal3', 'وجبة رقم ٣', { meal: 3 })],
        end: { nightHour: 4 },
      },
    ],
  };
}

export const templates = { day: makeDay('مهام'), friday: makeDay('عائلة') };

// الأسبوع يبدأ السبت، وأيامُه سواء — والجمعةُ وحدها مهامُها «عائلة»
// الفهرس: ٠ الأحد … ٥ الجمعة، ٦ السبت
export const weekPlan = ['day', 'day', 'day', 'day', 'day', 'friday', 'day'];

// ما بين الأذان والإقامة عنده: كتابة شعر
export const betweenLine = 'بين الأذان والإقامة: كتابة شعر';

// ورد التثبيت موزَّعًا على سننه الثماني بترتيبها الزمني
export const wird = [
  ['fajr', 'sunnah'],
  ['fajr', 'duha'],
  ['dhuhr', 'sunnahBefore'],
  ['dhuhr', 'sunnahAfter'],
  ['asr', 'sunnah'],
  ['maghrib', 'sunnah'],
  ['isha', 'sunnahBefore'],
  ['isha', 'sunnahAfter'],
];

export const prayer = { lat: 24.7136, lng: 46.6753, tz: 3, method: 'ummAlQura', asrFactor: 1, roundMaghribUp: true };

export const quran = {
  mode: 'managed',
  date: '2026-08-29',
  reviewJuz: 1,
  hifzJuz: 10,
  hifzQuarter: 1,
  hifzMode: 'حفظ',
  repeats: 5,
  wirdSlots: 8,
};

const SQUAT_STEPS =
  'التدرّج نحو سكوات الرجل الواحدة: ١) سكوات قافز ٢) نزول برجل وصعود بقدمين ٣) نزول برجل وصعود بقدمين مع قفز ٤) نزول وصعود برجل واحدة ٥) برجل واحدة مع قفز — انتقل للمستوى التالي عند إتقان الحالي';
const FRONT_DELT_STEPS = 'التدرّج: وقوف على اليدين مستندًا إلى الجدار ← ثم دون جدار عند التمكن';
const HEADER = 'التقدّم المزدوج: زد عدة كل جلسة حتى أعلى النطاق، ثم زد الوزن وارجع إلى أدنى النطاق.';

// الدورة: يوم تمرين فيوم قرآن — ثلاثة أنواع تمرين تتعاقب على أيام التمرين
export const workout = {
  // اليومُ قرآن وغدًا تمرين: فأولُ أيام التمرين الأحدُ ٣٠
  start: '2026-08-30',
  offTitle: 'قرآن',
  restBetween: true,
  scheduleMode: 'cycle',
  weeklyDays: [],
  exercises: {
    press: { name: 'الدفع العلوي (بريس مائل)', sets: 4, lo: 6, hi: 9, w0: 40, inc: 5, rest: 120 },
    row: { name: 'السحب الأفقي', sets: 4, lo: 6, hi: 9, w0: 50, inc: 5, rest: 120 },
    pullup: { name: 'السحب العلوي', sets: 3, lo: 6, hi: 9, w0: 40, inc: 5, rest: 120 },
    rear: { name: 'كتف خلفي', sets: 2, lo: 8, hi: 11, w0: 10, inc: 2.5, rest: 60 },
    lat: { name: 'كتف جانبي', sets: 2, lo: 8, hi: 11, w0: 10, inc: 2.5, rest: 60 },
    bi: { name: 'باي', sets: 2, lo: 8, hi: 11, w0: 15, inc: 2.5, rest: 60 },
    tri: { name: 'تراي', sets: 2, lo: 8, hi: 11, w0: 15, inc: 2.5, rest: 60 },
    hammer: { name: 'هامر', sets: 2, lo: 8, hi: 11, w0: 15, inc: 2.5, rest: 60 },
    fly: { name: 'فراشة صدر', sets: 2, lo: 8, hi: 11, w0: null, inc: 2.5, rest: 60 },
  },
  days: [
    {
      title: 'تمرين — اليوم الأول',
      header: HEADER,
      items: [
        { kind: 'reps', ex: 'press' },
        { kind: 'reps', ex: 'row' },
        { kind: 'reps', ex: 'pullup' },
        { kind: 'failure', key: 'squat', name: 'سكوات', sets: 5, rest: 120, note: SQUAT_STEPS },
        { kind: 'reps', ex: 'rear' },
        { kind: 'reps', ex: 'lat' },
        { kind: 'superset', key: 'bi+tri', name: 'باي + تراي', sets: 2, rest: 60, parts: ['bi', 'tri'] },
        { kind: 'hold', key: 'plank', name: 'بلانك', sets: 2, rest: 60, sec0: 40, secInc: 2.5 },
        // الجري في يوم التمرين نفسِه — لا يومًا مستقلًّا
        { kind: 'failure', key: 'warmup', name: 'إحماء — هرولة خفيفة', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'إحماء — ٥ دقائق هرولة خفيفة' },
        { kind: 'failure', key: 'sprint', name: 'عدو ١٠–٢٠ ث ثم هرولة ٩٠ ث', sets: 4, rest: 90, note: 'زد جولة أو ١٠ ثوانٍ كل أسبوع', descLine: 'عدو ١٠–٢٠ ثانية ثم هرولة ٩٠ ثانية — ٤ جولات (زد جولة أو ١٠ ثوانٍ كل أسبوع)' },
        { kind: 'failure', key: 'cool', name: 'تهدئة — مشي', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'تهدئة — ٥ دقائق مشي' },
      ],
    },
    {
      title: 'تمرين — اليوم الثاني',
      header: HEADER,
      items: [
        { kind: 'reps', ex: 'press' },
        { kind: 'reps', ex: 'fly' },
        { kind: 'reps', ex: 'row' },
        { kind: 'reps', ex: 'pullup' },
        { kind: 'failure', key: 'squat', name: 'سكوات', sets: 5, rest: 120, note: SQUAT_STEPS },
        { kind: 'failure', key: 'frontdelt', name: 'كتف أمامي بوزن الجسم', sets: 3, rest: 120, note: FRONT_DELT_STEPS },
        { kind: 'reps', ex: 'lat' },
        { kind: 'superset', key: 'hammer+tri', name: 'هامر + تراي', sets: 2, rest: 60, parts: ['hammer', 'tri'] },
        { kind: 'hold', key: 'plank', name: 'بلانك', sets: 2, rest: 60, sec0: 40, secInc: 2.5 },
        // الجري في يوم التمرين نفسِه — لا يومًا مستقلًّا
        { kind: 'failure', key: 'warmup', name: 'إحماء — هرولة خفيفة', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'إحماء — ٥ دقائق هرولة خفيفة' },
        { kind: 'failure', key: 'sprint', name: 'عدو ١٠–٢٠ ث ثم هرولة ٩٠ ث', sets: 4, rest: 90, note: 'زد جولة أو ١٠ ثوانٍ كل أسبوع', descLine: 'عدو ١٠–٢٠ ثانية ثم هرولة ٩٠ ثانية — ٤ جولات (زد جولة أو ١٠ ثوانٍ كل أسبوع)' },
        { kind: 'failure', key: 'cool', name: 'تهدئة — مشي', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'تهدئة — ٥ دقائق مشي' },
      ],
    },
  ],
};

export const startDate = '2026-08-29';
