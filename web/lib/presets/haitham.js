// جدول هيثم مُعبَّرًا عنه بنموذج البيانات العام وحده — لا يستورد أي إعداد افتراضي.
// وهو وجهان: معيارُ قبولٍ في اختبار المطابقة (إن عجز النموذج عن وصفه فهو ناقص)،
// وجدولٌ جاهز في التطبيق يُحمَّل بضغطةٍ صريحة لمن أراده — ولا يُفرَض على أحد.
//
// كل ما هنا بياناتٌ يستطيع أي مستخدم إدخالها من الواجهة: قوالب أيام، وخطة أسبوع،
// وموقع وطريقة حساب، وبذرة قرآن، وخطة تمرين.

const NOTE =
  'ملاحظات: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة.';
const POETRY = 'بين الأذان والإقامة: كتابة شعر';
const BALANCE = { target: 395, min: 45, max: 240, keepAfter: 45 };

const it = (id, text, extra) => ({ id, text, ...extra });
const note = () => ({ id: 'note', text: NOTE, note: true });

// قالب يوم: البلوكات بترتيبها الزمني، ونهايةُ كلٍّ مرساة — وبدايتُه نهايةُ سابقه
function day({ jumua, morning, midday, evening, afterIsha, rest, restFree, weekendNight }) {
  return {
    start: { lastThirdPrev: true },
    blocks: [
      { id: 'sleep2', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'fajr' } },
      { id: 'fajr', title: 'الفجر', colorId: 10, gen: 'fajr', end: { len: 45 } },
      { id: 'quran', title: 'مهام', colorId: 10, gen: 'quran', end: { prayer: 'sunrise', offset: 90 } },
      { id: 'nap', title: 'نوم', colorId: 8, sleep: true, end: { balance: BALANCE } },
      { id: 'work1', title: morning.title, colorId: 6, items: morning.items, end: { prayer: 'dhuhr', offset: jumua ? -60 : 0 } },
      { id: 'dhuhr', title: jumua ? 'الجمعة' : 'الظهر', colorId: 9, gen: jumua ? 'jumua' : 'dhuhr', end: { prayer: 'dhuhr', offset: 45 } },
      { id: 'work2', title: midday.title, colorId: 6, items: midday.items, end: { prayer: 'asr' } },
      { id: 'asr', title: 'العصر', colorId: 9, gen: 'asr', end: { len: 45 } },
      { id: 'work3', title: evening.title, colorId: 6, items: evening.items, end: { prayer: 'maghrib' } },
      { id: 'maghrib', title: 'المغرب', colorId: 9, gen: weekendNight ? 'maghribWeekend' : 'maghrib', end: { len: 30 } },
      { id: 'sleep1', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'isha' } },
      { id: 'isha', title: 'العشاء', colorId: 9, gen: 'isha', end: { len: 45 } },
      { id: 'family', title: afterIsha.title, colorId: 6, items: afterIsha.items, end: { nightFraction: 1 } },
      { id: 'rest', title: rest.title, colorId: 8, items: rest.items, transparent: restFree, end: { nightFraction: 2, offset: -45 } },
      { id: 'qiyam', title: 'صلاة القيام', colorId: 9, gen: weekendNight ? 'qiyamWeekend' : 'qiyam', end: { nightFraction: 2 } },
    ],
  };
}

const AILA = [it('aila', 'وقت مع العائلة')];
const ASRA = [it('asra', 'وقت مع الأسرة')];
const MEAL2 = [it('meal2', 'وجبة رقم ٢')];
const MEAL3 = [it('meal3', 'وجبة رقم ٣')];

export const templates = {
  // أيام العمل: ثلاثة بلوكات «مهام»، وما بعد العشاء «عائلة»، والراحة «أسرة»
  weekday: day({
    morning: { title: 'مهام', items: [] },
    midday: { title: 'مهام', items: [] },
    evening: { title: 'مهام', items: [] },
    afterIsha: { title: 'عائلة', items: AILA },
    rest: { title: 'أسرة', items: [] },
    restFree: true,
  }),
  // الجمعة: تبكير الصلاة ساعة، والصباح «أسرة»، والظهر والعصر «عائلة»، والليلة «أصدقاء»
  friday: day({
    jumua: true,
    weekendNight: true,
    morning: { title: 'أسرة', items: [it('meal1', 'وجبة رقم ١'), it('asra', 'وقت مع الأسرة'), it('silah', 'صلة رحم')] },
    midday: { title: 'عائلة', items: MEAL2 },
    evening: { title: 'عائلة ودعاء', items: [it('aila', 'وقت مع العائلة'), it('duaa', 'ساعة استجابة الدعاء قبل المغرب — تفرّغ للدعاء')] },
    afterIsha: { title: 'أسرة', items: ASRA },
    rest: { title: 'أصدقاء', items: MEAL3 },
    restFree: false,
  }),
  saturday: day({
    weekendNight: true,
    morning: { title: 'أسرة', items: [it('meal1', 'وجبة رقم ١'), it('asra', 'وقت مع الأسرة')] },
    midday: { title: 'عائلة', items: MEAL2 },
    evening: { title: 'عائلة', items: [] },
    afterIsha: { title: 'أسرة', items: ASRA },
    rest: { title: 'أصدقاء', items: MEAL3 },
    restFree: false,
  }),
};

// 0=الأحد … 5=الجمعة، 6=السبت
export const weekPlan = ['weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'friday', 'saturday'];

// ما بين الأذان والإقامة عنده: كتابة شعر — بندٌ من جدوله لا من افتراض البرنامج
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
  date: '2026-08-24',
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

export const workout = {
  start: '2026-08-24',
  offTitle: 'تطوير',
  restBetween: true,
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
      ],
    },
    {
      title: 'تمرين — اليوم الثالث (جري)',
      header: 'جري تدرّجي (سبرنت متقطع):',
      items: [
        { kind: 'failure', key: 'warmup', name: 'إحماء — هرولة خفيفة', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'إحماء — ٥ دقائق هرولة خفيفة' },
        { kind: 'failure', key: 'sprint', name: 'عدو ١٠–٢٠ ث ثم هرولة ٩٠ ث', sets: 4, rest: 90, note: 'زد جولة أو ١٠ ثوانٍ كل أسبوع', descLine: 'عدو ١٠–٢٠ ثانية ثم هرولة ٩٠ ثانية — ٤ جولات (زد جولة أو ١٠ ثوانٍ كل أسبوع)' },
        { kind: 'failure', key: 'cool', name: 'تهدئة — مشي', sets: 1, rest: 0, note: '٥ دقائق', descLine: 'تهدئة — ٥ دقائق مشي' },
      ],
    },
  ],
};
