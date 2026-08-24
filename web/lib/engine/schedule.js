// جدول هيثم مُعبَّرًا عنه بقوالب أيام (بيانات) يقرأها محرك القالب في layout.js.
// لم يعد هنا بناءُ أوقاتٍ ولا حسابُ مراسٍ — إنما قالبٌ لكل نوع يوم وبنودُ بلوكاته.
//
// اليوم يبدأ بنومة الثلث الأخير التي تسبق الفجر وينتهي بنهاية قيام ليلته:
// «أول مهمة في اليوم هي النوم» — فمن أخلّ بها خرب يومه كله.
// ترتيب الوحدة: نوم ← الفجر ← مهام ← نومة الضحى ← نهار ← المغرب ← ليل ← القيام
import { addDays, dow } from './dates.js';
import { quranStateFor, quranTaskLines, tathbeetLabels } from './quran.js';
import { buildDay, unitStart as layoutUnitStart } from './layout.js';

const PRAYER_NOTE =
  'ملاحظات: التركيز وتدوين ما قُرئ في كل ركعة (أو ما قرأ الإمام) • تنويع أذكار الركوع والسجود بين الركعات • الدعاء في كل سجدة.';

// مجموع نوم اليوم المستهدف: نومة الضحى تكمّل ما نقص من نوم الليل،
// فإن قلّ ليلُك طالت نومتك وقصر عملك — ولا تنزل عن ٤٥ د ولا تأكل آخر ٤٥ د من العمل
const SLEEP_BALANCE = { target: 395, min: 45, max: 240, keepAfter: 45 };

// الألوان (لوحة Google Calendar): 10 ريحان أخضر، 9 توت أزرق، 6 يوسفي برتقالي، 8 غرافيت رمادي
export const COLOR_HEX = {
  6: '#f4511e',
  8: '#616161',
  9: '#3f51b5',
  10: '#0b8043',
};

export const TASKS_TITLE = 'مهام'; // بلوكات المهام كلها بهذا الاسم أيام العمل

// ── البنود: لكل بند معرّف ثابت، وسطر الشرح لا يُؤشَّر ──
const it = (id, text, extra) => ({ id, text, ...extra });
const note = (text) => ({ id: 'note', text, note: true });

const POETRY_LINE = 'بين الأذان والإقامة: كتابة شعر';
const KAHF_LINE = 'بين الأذان والإقامة: قراءة سورة الكهف';

const GEN = {
  fajr: (t) => [
    it('adhan', 'ترديد الأذان ودعاء ما بعد الأذان'),
    it('sunnah', `سنة الفجر — ${t[0]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة الفجر'),
    it('dhikr', 'أذكار الصلاة'),
    it('morning', 'أذكار الصباح'),
    it('tahlil', 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (١٠٠ مرة)'),
    it('duha', `سنة الضحى — ${t[1]}`),
    note(PRAYER_NOTE),
  ],
  // بلوك «مهام» الصباحي: بنود القرآن وحدها — والتمرين مهمة يومية عائمة تظهر في كل بلوك مهام
  quran: (t, st) =>
    quranTaskLines(st).map((l) => it(l.key, l.text, { pool: l.pool || undefined, quran: true })),
  dhuhr: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', `سنة الظهر القبلية — ${t[2]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة الظهر'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', `سنة الظهر البعدية — ${t[3]}`),
    note(PRAYER_NOTE),
  ],
  jumua: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', `سنة الظهر القبلية — ${t[2]}`),
    it('between', KAHF_LINE),
    it('pray', 'صلاة الجمعة'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', `سنة الظهر البعدية — ${t[3]}`),
    note(PRAYER_NOTE),
  ],
  asr: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnah', `سنة العصر — ${t[4]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة العصر'),
    it('dhikr', 'أذكار الصلاة'),
    it('sadaqah', 'صدقة أو صلاة على ميت'),
    note(PRAYER_NOTE),
  ],
  // لا سنة قبلية للمغرب — وبين الأذان والإقامة وجبة رقم ٢ (وفي ليلتي الجمعة والسبت شعر)
  maghrib: (t) => [
    it('adhan', 'ترديد الأذان ودعاء ما بعد الأذان'),
    it('between', 'بين الأذان والإقامة: وجبة رقم ٢'),
    ...MAGHRIB_TAIL(t),
  ],
  maghribWeekend: (t) => [
    it('adhan', 'ترديد الأذان ودعاء ما بعد الأذان'),
    it('between', POETRY_LINE),
    ...MAGHRIB_TAIL(t),
  ],
  isha: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', `سنة العشاء القبلية — ${t[6]}`),
    it('between', POETRY_LINE),
    it('pray', 'صلاة العشاء'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', `سنة العشاء البعدية — ${t[7]}`),
    note(PRAYER_NOTE),
  ],
  // القيام: وجبة رقم ١ (السحور) أيام العمل، وفي الجمعة والسبت تنتقل إلى نهارهما
  qiyam: () => [...QIYAM_BASE, it('meal1', 'وجبة رقم ١ (سحور)')],
  qiyamWeekend: () => [...QIYAM_BASE],
};

const MAGHRIB_TAIL = (t) => [
  it('pray', 'صلاة المغرب'),
  it('dhikr', 'أذكار الصلاة'),
  it('evening', 'أذكار المساء'),
  it('tasbih', 'سبحان الله وبحمده (١٠٠ مرة)'),
  it('sunnah', `سنة المغرب — ${t[5]}`),
  note(PRAYER_NOTE),
];
const QIYAM_BASE = [
  it('witr', 'صلاة الوتر'),
  it('dua', 'دعاء شامل'),
  it('tawbah', 'توبة'),
  it('istighfar', 'استغفار'),
];

const AILA = [it('aila', 'وقت مع العائلة')];
const ASRA = [it('asra', 'وقت مع الأسرة')];
// نهارا الجمعة والسبت: وجبة ١ قبل الظهر، ووجبة ٢ بعده، والجمعة وحدها فيها صلة رحم
const ASRA_DAY_FRI = [it('meal1', 'وجبة رقم ١'), it('asra', 'وقت مع الأسرة'), it('silah', 'صلة رحم')];
const ASRA_DAY_SAT = [it('meal1', 'وجبة رقم ١'), it('asra', 'وقت مع الأسرة')];
const MEAL2 = [it('meal2', 'وجبة رقم ٢')]; // الظهر←العصر، وتنتقل للعصر إن فاتت
const MEAL3 = [it('meal3', 'وجبة رقم ٣')]; // بلوك «أصدقاء» ما بعد العشاء
// الجمعة بعد العصر: عائلة وساعة استجابة الدعاء قبل المغرب في بلوك واحد
const AILA_DUAA = [
  it('aila', 'وقت مع العائلة'),
  it('duaa', 'ساعة استجابة الدعاء قبل المغرب — تفرّغ للدعاء'),
];

// ── القوالب: قالبٌ لكل نوع يوم، وخطة الأسبوع تسنِد لكل يوم قالبه ──
// (المرحلة القادمة تُخرجها إلى إعدادات المستخدم فيحرّرها من الواجهة)
function makeTemplate({ day1, day2, day3, eve, rest, jumua, restFree }) {
  return {
    start: { lastThirdPrev: true },
    blocks: [
      { id: 'sleep2', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'fajr' } },
      { id: 'fajr', title: 'الفجر', colorId: 10, gen: 'fajr', end: { len: 45 } },
      { id: 'quran', title: TASKS_TITLE, colorId: 10, gen: 'quran', end: { prayer: 'sunrise', offset: 90 } },
      { id: 'nap', title: 'نوم', colorId: 8, sleep: true, end: { balance: SLEEP_BALANCE } },
      // يوم الجمعة يبدأ بلوك الصلاة مبكرًا بساعة (تبكير الجمعة) فيقصر العمل قبله
      { id: 'work1', title: day1.title, colorId: 6, items: day1.items, end: { prayer: 'dhuhr', offset: jumua ? -60 : 0 } },
      { id: 'dhuhr', title: jumua ? 'الجمعة' : 'الظهر', colorId: 9, gen: jumua ? 'jumua' : 'dhuhr', end: { prayer: 'dhuhr', offset: 45 } },
      { id: 'work2', title: day2.title, colorId: 6, items: day2.items, end: { prayer: 'asr' } },
      { id: 'asr', title: 'العصر', colorId: 9, gen: 'asr', end: { len: 45 } },
      { id: 'work3', title: day3.title, colorId: 6, items: day3.items, end: { prayer: 'maghrib' } },
      { id: 'maghrib', title: 'المغرب', colorId: 9, gen: rest.weekend ? 'maghribWeekend' : 'maghrib', end: { len: 30 } },
      { id: 'sleep1', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'isha' } },
      { id: 'isha', title: 'العشاء', colorId: 9, gen: 'isha', end: { len: 45 } },
      { id: 'family', title: eve.title, colorId: 6, items: eve.items, end: { nightFraction: 1 } },
      { id: 'rest', title: rest.title, colorId: 8, items: rest.items, transparent: restFree, end: { nightFraction: 2, offset: -45 } },
      { id: 'qiyam', title: 'صلاة القيام', colorId: 9, gen: rest.weekend ? 'qiyamWeekend' : 'qiyam', end: { nightFraction: 2 } },
    ],
  };
}

const T = TASKS_TITLE;
// القوالب الافتراضية — بيانات محضة يستبدلها المستخدم من الواجهة
export const DEFAULT_TEMPLATES = {
  // أيام العمل: البلوكات الثلاثة «مهام»، وما بعد العشاء «عائلة»، والراحة «أسرة» (وقت الزوجة)
  weekday: makeTemplate({
    day1: { title: T, items: [] },
    day2: { title: T, items: [] },
    day3: { title: T, items: [] },
    eve: { title: 'عائلة', items: AILA },
    rest: { title: 'أسرة', items: [], weekend: false },
    restFree: true,
  }),
  // نهار الجمعة: الصباح «أسرة»، والظهر والعصر «عائلة» (وفيه ساعة الاستجابة)
  friday: makeTemplate({
    jumua: true,
    day1: { title: 'أسرة', items: ASRA_DAY_FRI },
    day2: { title: 'عائلة', items: MEAL2 },
    day3: { title: 'عائلة ودعاء', items: AILA_DUAA },
    eve: { title: 'أسرة', items: ASRA },
    rest: { title: 'أصدقاء', items: MEAL3, weekend: true },
    restFree: false,
  }),
  saturday: makeTemplate({
    day1: { title: 'أسرة', items: ASRA_DAY_SAT },
    day2: { title: 'عائلة', items: MEAL2 },
    day3: { title: 'عائلة', items: [] },
    eve: { title: 'أسرة', items: ASRA },
    rest: { title: 'أصدقاء', items: MEAL3, weekend: true },
    restFree: false,
  }),
};

// خطة الأسبوع: 0=الأحد … 5=الجمعة، 6=السبت
export const DEFAULT_WEEK_PLAN = ['weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'friday', 'saturday'];

// القوالب وخطة الأسبوع من إعدادات المستخدم
let cfg = { templates: DEFAULT_TEMPLATES, weekPlan: DEFAULT_WEEK_PLAN };
export function setScheduleConfig(next) {
  cfg = {
    templates: (next && next.templates) || DEFAULT_TEMPLATES,
    weekPlan: (next && next.weekPlan) || DEFAULT_WEEK_PLAN,
  };
}
export function scheduleConfig() {
  return cfg;
}

// قالب اليوم: من خطة الأسبوع، وإن غاب فأول قالب موجود
function templateFor(dIso) {
  const ids = Object.keys(cfg.templates);
  return cfg.templates[cfg.weekPlan[dow(dIso)]] || cfg.templates[ids[0]];
}

// بنود البلوك: إمّا ثابتة في القالب، وإمّا مولّدة (صلوات وقرآن) من حالة يومها
function itemsFor(block, dIso) {
  if (!block.gen) return block.items || [];
  const st = quranStateFor(dIso);
  return GEN[block.gen](tathbeetLabels(st), st);
}

// وقت بداية وحدة dIso نصًّا — تستعمله الواجهة لتحديد الوحدة الجارية
export const unitStart = (dIso) => layoutUnitStart(dIso, templateFor(dIso));

// وحدة اليوم dIso: من نومة الثلث الأخير التي تسبق فجره إلى نهاية قيام ليلته
export const buildUnit = (dIso) => buildDay(dIso, templateFor(dIso), itemsFor);

// كل الأحداث في نطاق [fromIso, toIso] من وحدات الأيام (شاملة الطرفين)
export function buildRange(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(...buildUnit(d));
  return out;
}
