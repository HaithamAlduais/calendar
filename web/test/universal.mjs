// فحص قدرات النسخة العامة — ما طلبه صاحب البرنامج في رسالة ٢٦ أغسطس:
// أسداس الليل الستة، والنوم بدورات كاملة وبمدى ساعات، والخطة دورةً لا أسبوعًا,
// والتمرين الأسبوعي بنسخه المتناوبة، والقرآن قابلًا للتركيب، والصيام يُسقط وجبته.
import { buildDay, isMonotone } from '../lib/engine/layout.js';
import {
  DEFAULT_TEMPLATES,
  DEFAULT_WEEK_PLAN,
  buildUnit,
  setScheduleConfig,
} from '../lib/engine/schedule.js';
import { setQuranConfig, quranTaskLines, quranStateFor, tathbeetLabels } from '../lib/engine/quran.js';
import { setWorkoutConfig, workoutDayType, workoutTitle, DEFAULT_WORKOUT } from '../lib/engine/workout.js';
import { setPrayerConfig, prayerTimes } from '../lib/engine/prayers.js';
import { addDays } from '../lib/engine/dates.js';

let pass = 0,
  fail = 0;
function check(label, got, want) {
  const ok = String(got) === String(want);
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL ${label}: got=${got} want=${want}`);
  }
}
function ok(label, cond, why = '') {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL ${label} ${why}`);
  }
}

setPrayerConfig({ lat: 24.7136, lng: 46.6753, tz: 3, method: 'ummAlQura', asrFactor: 1, roundMaghribUp: true });
const D = '2026-09-23';
const noItems = () => [];
const mins = (stamp) => +stamp.slice(11, 13) * 60 + +stamp.slice(14, 16);

// ── ١. أسداس الليل: الليل من المغرب إلى فجر الغد ستةُ أجزاء ───────
{
  const P = prayerTimes(D);
  const F2 = prayerTimes(addDays(D, 1)).fajr + 1440;
  const night = F2 - P.maghrib;
  const tpl = {
    start: { prayer: 'maghrib' },
    blocks: [
      { id: 'a', title: 'أ', colorId: 6, end: { nightPart: 3 } }, // نصف الليل
      { id: 'b', title: 'ب', colorId: 6, end: { nightPart: 4 } }, // الثلث الأخير
      { id: 'c', title: 'ج', colorId: 6, end: { nightPart: 5 } }, // السدس الأخير
      { id: 'd', title: 'د', colorId: 6, end: { fajrNext: true } },
    ],
  };
  const evs = buildDay(D, tpl, noItems);
  const end = (i) => mins(evs[i].end) + (evs[i].end.slice(0, 10) > D ? 1440 : 0);
  check('نصف الليل = المغرب + ٣/٦', end(0), P.maghrib + Math.round((3 * night) / 6));
  check('الثلث الأخير = المغرب + ٤/٦', end(1), P.maghrib + Math.round((4 * night) / 6));
  check('السدس الأخير = المغرب + ٥/٦', end(2), P.maghrib + Math.round((5 * night) / 6));
  ok('يوم الأسداس سليم', isMonotone(D, tpl));
  // nightPrev 4 يطابق lastThirdPrev — الصيغة القديمة حالة خاصة من الست
  const t1 = { start: { nightPrev: 4 }, blocks: [{ id: 'x', title: 'س', colorId: 6, end: { prayer: 'fajr' } }] };
  const t2 = { start: { lastThirdPrev: true }, blocks: [{ id: 'x', title: 'س', colorId: 6, end: { prayer: 'fajr' } }] };
  check('nightPrev(4) ≡ lastThirdPrev', buildDay(D, t1, noItems)[0].start, buildDay(D, t2, noItems)[0].start);
}

// ── ٢. نومة التوازن: مدى هدفٍ ودورات نوم كاملة ────────────────────
{
  const tpl = (balance) => ({
    start: { prayer: 'isha' },
    blocks: [
      { id: 's1', title: 'نوم', colorId: 8, sleep: true, end: { nightPart: 4 } },
      { id: 'q', title: 'قيام', colorId: 9, end: { nightPart: 5 } },
      { id: 's2', title: 'نوم', colorId: 8, sleep: true, end: { fajrNext: true } },
      { id: 'w', title: 'مهام', colorId: 6, end: { prayer: 'dhuhr', next: true } },
      { id: 'nap', title: 'قيلولة', colorId: 8, sleep: true, end: { balance } },
      { id: 'z', title: 'بقية', colorId: 6, end: { prayer: 'maghrib', next: true } },
    ],
  });
  const napLen = (balance) => {
    const evs = buildDay(D, tpl(balance), noItems);
    const nap = evs.find((e) => e.slot === 'nap');
    return (new Date(nap.end) - new Date(nap.start)) / 60000;
  };
  // بلا دورات: تُكمل إلى الهدف الأعلى بدقّة الدقيقة
  // (المدى أعلى من نوم الليل وحده — وإلا كانت القيلولة صفرًا بحق)
  const free = napLen({ targetMin: 480, targetMax: 600, min: 0, max: 300, keepAfter: 0 });
  // بدورات ٩٠: يُقصّ الطول إلى مضاعف ٩٠
  const snapped = napLen({ targetMin: 480, targetMax: 600, min: 0, max: 300, keepAfter: 0, cycle: 90 });
  ok('القيلولة الحرّة موجبة', free > 0, `= ${free}`);
  check('وبالدورات تُقصّ إلى مضاعف ٩٠', snapped % 90, 0);
  ok('القصّ لا يزيد الطول', snapped <= free);
  // {target} القديمة تعمل كما هي (هدفٌ واحد)
  const old = napLen({ target: 395, min: 45, max: 240, keepAfter: 45 });
  ok('صيغة target القديمة تعمل', old >= 45 && old <= 240, `= ${old}`);
}

// ── ٣. الخطة دورةً: قوالب تتعاقب بلا نظر إلى الأسبوع ──────────────
{
  const A = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.day));
  const B = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.day));
  A.name = 'أ';
  B.name = 'ب';
  setScheduleConfig({
    templates: { a: A, b: B },
    weekPlan: ['a', 'a', 'a', 'a', 'a', 'a', 'a'],
    planMode: 'cycle',
    cyclePlan: { start: '2026-09-20', seq: ['a', 'a', 'b'] },
  });
  // 20←a 21←a 22←b 23←a 24←a 25←b — نتحقق عبر أسماء غير موجودة؟ القوالب متطابقة
  // البنية متطابقة، فنتحقق من templateIdFor عبر أثر جانبي: نجعل b مختلفًا
  B.blocks.find((x) => x.id === 'fajr').end.len = 20;
  setScheduleConfig({
    templates: { a: A, b: B },
    weekPlan: ['a', 'a', 'a', 'a', 'a', 'a', 'a'],
    planMode: 'cycle',
    cyclePlan: { start: '2026-09-20', seq: ['a', 'a', 'b'] },
  });
  const fajrLen = (d) => {
    const evs = buildUnit(d);
    const f = evs.find((e) => e.slot === 'fajr');
    return (new Date(f.end) - new Date(f.start)) / 60000;
  };
  check('اليوم ١ من الدورة ← أ', fajrLen('2026-09-20'), 45);
  check('اليوم ٢ ← أ', fajrLen('2026-09-21'), 45);
  check('اليوم ٣ ← ب (فجر ٢٠)', fajrLen('2026-09-22'), 20);
  check('اليوم ٤ يعود إلى أ', fajrLen('2026-09-23'), 45);
  check('وقبل بداية الدورة لا انهيار', fajrLen('2026-09-19'), 20 /* ((-1)%3+3)%3=2 ← b */);
  setScheduleConfig({ templates: DEFAULT_TEMPLATES, weekPlan: DEFAULT_WEEK_PLAN });
}

// ── ٤. الصيام يُسقط وجبة النهار الاثنين والخميس ───────────────────
{
  const T = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES.day));
  const work = T.blocks.find((b) => b.id === 'work2');
  work.items = [
    { id: 'meal', text: 'وجبة الظهيرة', fastingSkip: true },
    { id: 'other', text: 'مهمة أخرى' },
  ];
  setScheduleConfig({ templates: { day: T }, weekPlan: DEFAULT_WEEK_PLAN, fasting: true });
  const items = (d) => buildUnit(d).find((e) => e.slot === 'work2').items.map((i) => i.id);
  check('الاثنين: الوجبة ساقطة', items('2026-09-21').join(), 'other'); // 21 سبتمبر اثنين
  check('الثلاثاء: الوجبة موجودة', items('2026-09-22').join(), 'meal,other');
  check('الخميس: ساقطة', items('2026-09-24').join(), 'other');
  setScheduleConfig({ templates: { day: T }, weekPlan: DEFAULT_WEEK_PLAN, fasting: false });
  check('ومن دون صيام لا تسقط', items('2026-09-21').join(), 'meal,other');
  setScheduleConfig({ templates: DEFAULT_TEMPLATES, weekPlan: DEFAULT_WEEK_PLAN });
}

// ── ٥. التمرين الأسبوعي بنسخه المتناوبة ───────────────────────────
{
  setWorkoutConfig({
    ...DEFAULT_WORKOUT,
    scheduleMode: 'weekly',
    weeklyDays: [2, 6], // الثلاثاء والسبت
    start: '2026-08-24',
    days: [
      { title: 'نسخة أ', header: '', items: [] },
      { title: 'نسخة ب', header: '', items: [] },
    ],
  });
  check('الاثنين ليس تمرينًا', workoutDayType('2026-08-24'), 0);
  check('الثلاثاء الأول ← أ', workoutTitle('2026-08-25'), 'نسخة أ');
  check('السبت ← ب', workoutTitle('2026-08-29'), 'نسخة ب');
  check('الثلاثاء التالي يعود إلى أ', workoutTitle('2026-09-01'), 'نسخة أ');
  check('وسبته ← ب', workoutTitle('2026-09-05'), 'نسخة ب');
  // نمط الدورة القديم لم يتغير
  setWorkoutConfig({ ...DEFAULT_WORKOUT, start: '2026-08-24' });
  check('الدورة: اليوم الأول تمرين ١', workoutDayType('2026-08-24'), 1);
  check('الدورة: الغد راحة', workoutDayType('2026-08-25'), 0);
  setWorkoutConfig(DEFAULT_WORKOUT);
}

// ── ٦. القرآن قابلًا للتركيب ──────────────────────────────────────
{
  const base = { mode: 'managed', date: '2026-08-24', reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ', repeats: 5, wirdSlots: 8 };
  setQuranConfig({ ...base, components: { review: true, hifz: true } });
  check('الكلّ: بندان', quranTaskLines(quranStateFor('2026-08-24')).length >= 2, 'true');
  setQuranConfig({ ...base, components: { review: false, hifz: true } });
  ok('حفظ وحده: لا تسميع', !quranTaskLines(quranStateFor('2026-08-24')).some((l) => l.key === 'review'));
  setQuranConfig({ ...base, components: { review: true, hifz: false } });
  const lines = quranTaskLines(quranStateFor('2026-08-24'));
  check('تسميع وحده: بند واحد', lines.length, 1);
  check('وهو التسميع', lines[0].key, 'review');
  // ورد القراءة الحرّة: نصٌّ بمقدار صاحبه لا موضعَ فيه
  setQuranConfig({ ...base, wirdMode: 'reading', wirdAmount: 'صفحتان' });
  const labels = tathbeetLabels(quranStateFor('2026-08-24'));
  check('ورد القراءة: المقدار في النص', labels[0], 'قراءة: صفحتان');
  ok('وكل السنن سواء', labels.every((l) => l === labels[0]));
  setQuranConfig(base);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
