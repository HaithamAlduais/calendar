// قوالب الأيام وبنودها — بياناتٌ يقرأها محرك القالب في layout.js.
// لا بناءَ أوقاتٍ هنا ولا حسابَ مراسٍ: قالبٌ افتراضي بسيط، ومولّدات بنود الصلاة
// والقرآن، وإسنادُ القوالب إلى الأيام أسبوعًا أو دورةً.
import { addDays, daysBetween, dow } from './dates.js';
import { quranStateFor, quranTaskLines, tathbeetLabels, reviewItem } from './quran.js';
import { workoutDayType } from './workout.js';
import { isFasting } from './fasting.js';
import { templates as HAITHAM_TEMPLATES, weekPlan as HAITHAM_WEEK_PLAN } from '../presets/haitham.js';
import { buildDay, rotateTemplate, unitStart as layoutUnitStart } from './layout.js';

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

// ما بين الأذان والإقامة: دعاءٌ لا يُردّ. وصاحبُ الجدول يملؤه بما شاء —
// وكان نصُّه مكتوبًا في الشيفرة، فيقرأ كلُّ مستخدمٍ عادةَ غيره.
export const DEFAULT_BETWEEN = 'بين الأذان والإقامة: دعاء — فإنه لا يُردّ';
const KAHF_LINE = 'بين الأذان والإقامة: قراءة سورة الكهف';
let betweenLine = DEFAULT_BETWEEN;
const POETRY = { get line() { return betweenLine; } };

// نصّ بند السنّة: اسمُها، ومعها موضعُ وردها إن كانت من سننه المختارة
const wirdText = (name, t, slot, id) => {
  const label = t.at ? t.at(slot, id) : null;
  return label ? `${name} — ${label}` : name;
};

const GEN = {
  fajr: (t) => [
    it('adhan', 'ترديد الأذان ودعاء ما بعد الأذان'),
    it('sunnah', wirdText('سنة الفجر', t, 'fajr', 'sunnah')),
    it('between', POETRY.line),
    it('pray', 'صلاة الفجر'),
    it('dhikr', 'أذكار الصلاة'),
    it('morning', 'أذكار الصباح'),
    it('tahlil', 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (١٠٠ مرة)'),
    it('duha', wirdText('سنة الضحى', t, 'fajr', 'duha')),
    note(PRAYER_NOTE),
  ],
  // الروتين: يومٌ قرآن ويومٌ تمرين بالتناوب — فبنودُ القرآن تظهر يوم القرآن،
  // وبطاقةُ التمرين تُفتح من البلوك نفسه يوم التمرين
  routine: (t, st, dIso) => (workoutDayType(dIso) === 0 ? GEN.quran(t, st) : []),
  // بلوك «مهام» الصباحي: بنود القرآن وحدها — والتمرين مهمة يومية عائمة تظهر في كل بلوك مهام
  quran: (t, st) =>
    quranTaskLines(st).map((l) => it(l.key, l.text, { pool: l.pool || undefined, quran: true })),
  dhuhr: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', wirdText('سنة الظهر القبلية', t, 'dhuhr', 'sunnahBefore')),
    it('between', POETRY.line),
    it('pray', 'صلاة الظهر'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', wirdText('سنة الظهر البعدية', t, 'dhuhr', 'sunnahAfter')),
    note(PRAYER_NOTE),
  ],
  jumua: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', wirdText('سنة الظهر القبلية', t, 'dhuhr', 'sunnahBefore')),
    it('between', KAHF_LINE),
    it('pray', 'صلاة الجمعة'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', wirdText('سنة الظهر البعدية', t, 'dhuhr', 'sunnahAfter')),
    note(PRAYER_NOTE),
  ],
  asr: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnah', wirdText('سنة العصر', t, 'asr', 'sunnah')),
    it('between', POETRY.line),
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
    it('between', POETRY.line),
    ...MAGHRIB_TAIL(t),
  ],
  isha: (t) => [
    it('adhan', 'ترديد الأذان'),
    it('sunnahBefore', wirdText('سنة العشاء القبلية', t, 'isha', 'sunnahBefore')),
    it('between', POETRY.line),
    it('pray', 'صلاة العشاء'),
    it('dhikr', 'أذكار الصلاة'),
    it('sunnahAfter', wirdText('سنة العشاء البعدية', t, 'isha', 'sunnahAfter')),
    note(PRAYER_NOTE),
  ],
  // القيام: وجبة رقم ١ (السحور) أيام العمل، وفي الجمعة والسبت تنتقل إلى نهارهما
  qiyam: () => [...QIYAM_BASE, it('meal1', 'وجبة رقم ١ (سحور)')],
  qiyamWeekend: () => [...QIYAM_BASE],
  // قيام الليل: وجبةٌ ثم وترٌ تُقرأ فيه المراجعة — كما يُقرأ التثبيت في السنن،
  // صلاةٌ وقرآنٌ معًا، فلا يبقى للمراجعة بلوكٌ تنفرد به من النهار
  qiyamNight: (t, st) => {
    const rv = reviewItem(st);
    return [
      it('meal1', 'وجبة رقم ١', { meal: 1 }),
      // بلا علامة quran: المراجعةُ تُقرأ في الوتر كما تُقرأ السنّةُ في موضعها،
      // فلا تطفو مهمةً عائمة على بلوكات النهار — ومجمعُ أخطائها قائمٌ على كل حال
      it('witr', rv ? `صلاة الوتر — ${rv.text}` : 'صلاة الوتر', rv ? { pool: rv.pool || undefined } : {}),
      it('dua', 'دعاء'),
      it('tawbah', 'توبة واستخارة'),
    ];
  },
};

const MAGHRIB_TAIL = (t) => [
  it('pray', 'صلاة المغرب'),
  it('dhikr', 'أذكار الصلاة'),
  it('evening', 'أذكار المساء'),
  it('tasbih', 'سبحان الله وبحمده (١٠٠ مرة)'),
  it('sunnah', wirdText('سنة المغرب', t, 'maghrib', 'sunnah')),
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

// ── القالب الافتراضي: يومٌ بسيط عام ──
// نومٌ وصلواتٌ خمس وبلوكات مهام — يبني عليه المستخدم يومَه من المعالج والمحرِّرات.
// (كان الافتراضُ جدولَ صاحب البرنامج بثلاثة قوالب — وليس التطبيق تطبيقَه وحده،
// فجدولُه اليوم في ملف اختبار المطابقة فقط، دليلًا على أن النموذج العام يسعه.)
function plainTemplate() {
  return {
    name: 'يومي',
    start: { lastThirdPrev: true },
    blocks: [
      { id: 'sleep2', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'fajr' } },
      { id: 'fajr', title: 'الفجر', colorId: 10, gen: 'fajr', end: { len: 45 } },
      { id: 'quran', title: TASKS_TITLE, colorId: 10, gen: 'quran', task: true, end: { prayer: 'sunrise', offset: 90 } },
      { id: 'nap', title: 'نوم', colorId: 8, sleep: true, end: { balance: SLEEP_BALANCE } },
      { id: 'work1', title: TASKS_TITLE, colorId: 6, items: [], task: true, end: { prayer: 'dhuhr' } },
      { id: 'dhuhr', title: 'الظهر', colorId: 9, gen: 'dhuhr', end: { prayer: 'dhuhr', offset: 45 } },
      { id: 'work2', title: TASKS_TITLE, colorId: 6, items: [], task: true, end: { prayer: 'asr' } },
      { id: 'asr', title: 'العصر', colorId: 9, gen: 'asr', end: { len: 45 } },
      { id: 'work3', title: TASKS_TITLE, colorId: 6, items: [], task: true, end: { prayer: 'maghrib' } },
      // مدد القالب البسيط موحّدة، فيُعرض للمبتدئ رقمٌ واحد لا خمسة
      { id: 'maghrib', title: 'المغرب', colorId: 9, gen: 'maghribWeekend', end: { len: 45 } },
      { id: 'sleep1', title: 'نوم', colorId: 8, sleep: true, end: { prayer: 'isha' } },
      { id: 'isha', title: 'العشاء', colorId: 9, gen: 'isha', end: { len: 45 } },
      { id: 'family', title: 'وقتك', colorId: 6, items: [], task: true, end: { nightFraction: 1 } },
      { id: 'rest', title: 'راحة', colorId: 8, items: [], task: true, transparent: true, end: { nightFraction: 2, offset: -45 } },
      { id: 'qiyam', title: 'صلاة القيام', colorId: 9, gen: 'qiyamWeekend', end: { nightFraction: 2 } },
    ],
  };
}

// الافتراض جدولُ صاحب البرنامج — والقالب البسيط يبقى لمن أراد أن يبدأ فارغًا
export const PLAIN_TEMPLATES = { day: plainTemplate() };
export const PLAIN_WEEK_PLAN = ['day', 'day', 'day', 'day', 'day', 'day', 'day'];
export const DEFAULT_TEMPLATES = HAITHAM_TEMPLATES;
export const DEFAULT_WEEK_PLAN = HAITHAM_WEEK_PLAN;

// القوالب وخطة الأسبوع من إعدادات المستخدم
let cfg = { templates: DEFAULT_TEMPLATES, weekPlan: DEFAULT_WEEK_PLAN, dayStart: null };

// معرّفات بلوكات المهام في كل القوالب — مصدرها البيانات لا قائمةٌ مكتوبة في الواجهة
// بنود بلوكٍ مولَّدة بالافتراض — يقرأها المحرِّر ليملأ أول مرة
export function defaultPrayerTasks(genKey, labels) {
  const g = GEN[genKey];
  if (!g) return [];
  return g(labels || [], null).map((x) => ({ ...x }));
}

export function taskSlots() {
  const out = [];
  for (const tpl of Object.values(cfg.templates))
    for (const b of tpl.blocks) if (b.task && !out.includes(b.id)) out.push(b.id);
  return out;
}
export function setScheduleConfig(next) {
  betweenLine = (next && next.betweenLine) || DEFAULT_BETWEEN;
  cfg = {
    templates: (next && next.templates) || DEFAULT_TEMPLATES,
    weekPlan: (next && next.weekPlan) || DEFAULT_WEEK_PLAN,
    // إسناد القوالب: 'weekly' لكل يوم أسبوعٍ قالبُه، أو 'cycle' تتابعٌ لا يعرف
    // الأسبوع — قائمةُ قوالب تدور من يوم البداية (لمن قال: لا فرق عندي بين
    // الجمعة وغيرها، أيامي دورةٌ من كذا يومًا)
    planMode: (next && next.planMode) || 'weekly',
    cyclePlan: (next && next.cyclePlan) || null, // { start, seq: [ids] }
    // بداية اليوم واحدة لكل القوالب — وإلا تداخلت الوحدات أو تباعدت
    dayStart: (next && next.dayStart) || null,
    // صيام الاثنين والخميس: تُسقَط فيهما بنودُ الوجبات المعلَّمة fastingSkip
    fasting: !!(next && next.fasting),
    fastingCfg: (next && next.fastingCfg) || undefined,
    // بنود الصلاة كما حرّرها صاحبها: { blockId: [بنود] } — وما لم يُحرَّر فمولَّدٌ
    // بالافتراض. وكانت مكتوبةً في الشيفرة لا يملك أحدٌ تغييرها.
    prayerTasks: (next && next.prayerTasks) || {},
  };
  rotated = new Map();
}
export function scheduleConfig() {
  return cfg;
}

// قالب اليوم: من خطة الأسبوع، وإن غاب فأول قالب موجود
// القوالب مدارةً ببداية اليوم المختارة — تُحسب مرة لكل قالب لا لكل يوم
let rotated = new Map();
function templateIdFor(dIso) {
  const ids = Object.keys(cfg.templates);
  if (cfg.planMode === 'cycle' && cfg.cyclePlan && cfg.cyclePlan.seq.length) {
    const off = daysBetween(cfg.cyclePlan.start, dIso);
    const seq = cfg.cyclePlan.seq;
    const k = ((off % seq.length) + seq.length) % seq.length;
    if (seq[k] in cfg.templates) return seq[k];
  }
  return cfg.weekPlan[dow(dIso)] in cfg.templates ? cfg.weekPlan[dow(dIso)] : ids[0];
}
function templateFor(dIso) {
  const key = templateIdFor(dIso);
  if (!rotated.has(key)) rotated.set(key, rotateTemplate(cfg.templates[key], cfg.dayStart));
  return rotated.get(key);
}

// القالب كما هو مكتوب (بلا دوران) — للتحرير وللواجهة
export function rawTemplateFor(dIso) {
  const ids = Object.keys(cfg.templates);
  return cfg.templates[cfg.weekPlan[dow(dIso)]] || cfg.templates[ids[0]];
}

// بنود البلوك: إمّا ثابتة في القالب، وإمّا مولّدة (صلوات وقرآن) من حالة يومها
// الصيام: الاثنين والخميس، ورمضان، والأيام المأثورة — تسقط فيها الوجبة المعلَّمة
const fastingDay = (dIso) => !!cfg.fasting && isFasting(dIso, cfg.fastingCfg);

function itemsFor(block, dIso) {
  if (!block.gen)
    return (block.items || []).filter((x) => !(x.fastingSkip && fastingDay(dIso)));
  // بنودٌ حرّرها صاحبها تعلو على المولَّد — والمعرّفات تبقى فيلحقها الورد
  const custom = cfg.prayerTasks && cfg.prayerTasks[block.id];
  if (custom && block.gen !== 'quran') return custom;
  const st = quranStateFor(dIso);
  return GEN[block.gen](tathbeetLabels(st), st, dIso);
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
