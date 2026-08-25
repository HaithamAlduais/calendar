// تحقق شامل من المحرّك ضد القيم المرجعية المأخوذة من التقويم اليدوي لهيثم
import { prayerTimes, fmtTime } from '../lib/engine/prayers.js';
import { buildUnit, buildRange, setScheduleConfig } from '../lib/engine/schedule.js';
import { setQuranConfig } from '../lib/engine/quran.js';
import { setWorkoutConfig } from '../lib/engine/workout.js';
import * as HC from './haitham-config.mjs';

// هذا الفحص يفحص جدولَ هيثم ضدّ تقويمه اليدوي، والافتراضُ العام لم يعد جدولَه —
// فيُهيّأ المحرك بإعداداته من ملفها (وهي ما سيُدخله هو بيده من الواجهة).
setScheduleConfig({ templates: HC.templates, weekPlan: HC.weekPlan, betweenLine: HC.betweenLine });
setQuranConfig(HC.quran);
setWorkoutConfig(HC.workout);
import { quranStateFor, QURAN_SEED } from '../lib/engine/quran.js';
import { workoutTitle, workoutDesc as wdesc } from '../lib/engine/workout.js';
import { addDays, dow, daysBetween } from '../lib/engine/dates.js';

// كل الفحوص المرتبطة بالبذرة (قرآن وتمرين) تُكتب بإزاحة عن يوم البداية لا بتواريخ ثابتة،
// فتنتقل معها تلقائيًا في أي «بداية جديدة» قادمة
const S = QURAN_SEED.date;
const D = (n) => addDays(S, n);

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = String(got) === String(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}: got=${got} want=${want}`); }
}

// ── المراسي المرجعية من التقويم اليدوي ──────────────────────────────
const p29 = prayerTimes('2026-07-29');
check('29/7 sunrise', fmtTime(p29.sunrise), '05:20');
check('29/7 dhuhr', fmtTime(p29.dhuhr), '12:00');
check('29/7 asr', fmtTime(p29.asr), '15:25');
check('29/7 maghrib', fmtTime(p29.maghrib), '18:40');

const p30 = prayerTimes('2026-07-30');
check('30/7 fajr', fmtTime(p30.fajr), '03:54');
check('30/7 sunrise', fmtTime(p30.sunrise), '05:20');
check('30/7 dhuhr', fmtTime(p30.dhuhr), '12:00');
check('30/7 asr', fmtTime(p30.asr), '15:26');
check('30/7 maghrib', fmtTime(p30.maghrib), '18:39');
check('30/7 isha', fmtTime(p30.isha), '20:09');

const p1 = prayerTimes('2026-08-01');
check('1/8 fajr', fmtTime(p1.fajr), '03:55');

// ── بنية وحدة الخميس ٣٠ يوليو (نومة الثلث الأخير ← نهاية القيام) ────
const u30 = buildUnit('2026-07-30');
const bySlot = Object.fromEntries(u30.map((e) => [e.slot, e]));
const T = (s) => s.slice(11);
// بنود البلوك صارت كائنات لها معرّفات: نصّها مجموعًا، وبندٌ بعينه بمعرّفه
const txt = (ev) => ev.items.map((i) => i.text).join(String.fromCharCode(10));
const item = (ev, id) => ev.items.find((i) => i.id === id);
check('u30 maghrib', `${T(bySlot.maghrib.start)}-${T(bySlot.maghrib.end)}`, '18:39-19:09');
check('u30 نوم (المغرب←العشاء)', `${T(bySlot.sleep1.start)}-${T(bySlot.sleep1.end)}`, '19:09-20:09');
check('u30 اسم بلوك المغرب←العشاء', bySlot.sleep1.title, 'نوم');
check('u30 isha', `${T(bySlot.isha.start)}-${T(bySlot.isha.end)}`, '20:09-20:54');
check('u30 family end (ثلث أول)', T(bySlot.family.end), '21:44');
check('u30 راحة الليل حتى قبل القيام', `${T(bySlot.rest.start)}-${T(bySlot.rest.end)}`, '21:44-00:04');
check('u30 قيام: آخر ٤٥ د من الثلث الثاني', `${T(bySlot.qiyam.start)}-${T(bySlot.qiyam.end)}`, '00:04-00:49');
check('u30 مدة القيام ٤٥ د', (new Date(bySlot.qiyam.end) - new Date(bySlot.qiyam.start)) / 60000, 45);
check('u30 وجبة ١ داخل القيام', txt(bySlot.qiyam).includes('وجبة رقم ١ (سحور)'), true);
// أول الوحدة نومة الثلث الأخير التي تسبق فجرها، وآخرها نهاية قيام ليلتها
check('u30 يبدأ بالنوم', u30[0].slot, 'sleep2');
check('u30 نومة الثلث الأخير أول الوحدة', `${T(bySlot.sleep2.start)}-${T(bySlot.sleep2.end)}`, '00:49-03:54');
check('u30 النومة في يوم الوحدة نفسه', bySlot.sleep2.start.slice(0, 10), '2026-07-30');
check('u30 اسم نومة الثلث الأخير', bySlot.sleep2.title, 'نوم');
check('u30 النومة تنتهي بالفجر', bySlot.sleep2.end, bySlot.fajr.start);
check('u30 fajr بعد النومة', `${T(bySlot.fajr.start)}-${T(bySlot.fajr.end)}`, '03:54-04:39');
check('u30 ينتهي بالقيام', u30[u30.length - 1].slot, 'qiyam');
check('u30 نهاية الوحدة في اليوم التالي', bySlot.qiyam.end.slice(0, 10), '2026-07-31');
check('u30 تلاصق الوحدتين', buildUnit('2026-07-31')[0].start, bySlot.qiyam.end);
check('u30 بلوك مهام واحد (قرآن + تمرين)', `${T(bySlot.quran.start)}-${T(bySlot.quran.end)}`, '04:39-06:50');
check('u30 اسمه مهام', bySlot.quran.title, 'مهام');
check('u30 لا بلوك تمرين منفصل', !!bySlot.train, false);
check('u30 سنة الضحى انتقلت للفجر', item(bySlot.fajr, 'duha').text.startsWith('سنة الضحى'), true);
check('u30 لا سنة ضحى في بلوك المهام', !!item(bySlot.quran, 'duha'), false);
// النومة تلي التمرين مباشرة، ثم العمل متصل منها إلى الظهر
check('u30 النومة تلي التمرين مباشرة', `${T(bySlot.nap.start)}-${T(bySlot.nap.end)}`, '06:50-09:20');
check('u30 النومة تبدأ بنهاية بلوك المهام', bySlot.nap.start, bySlot.quran.end);
check('u30 عمل متصل من النومة إلى الظهر', `${T(bySlot.work1.start)}-${T(bySlot.work1.end)}`, '09:20-12:00');
check('u30 العمل ينتهي ببداية الظهر', bySlot.work1.end, bySlot.dhuhr.start);
check('u30 مدة نومة الضحى تكمّل ٦ س ٣٥ د', (new Date(bySlot.nap.end) - new Date(bySlot.nap.start)) / 60000, 150);
check('u30 dhuhr', `${T(bySlot.dhuhr.start)}-${T(bySlot.dhuhr.end)}`, '12:00-12:45');
check('u30 work2 end (عصر)', T(bySlot.work2.end), '15:26');
check('u30 work3 end (مغرب)', T(bySlot.work3.end), '18:39');
check('u30 count', u30.length, 15);
check('u30 الراحة اسمها أسرة (خميس)', bySlot.rest.title, 'أسرة');
check('u30 ما بعد العشاء اسمه عائلة (خميس)', bySlot.family.title, 'عائلة');
check('u30 نومة الضحى اسمها نوم', bySlot.nap.title, 'نوم');

// ── صفر فجوات وصفر تداخل عبر النطاق كاملًا + تلاصق الوحدات ─────────
const all = buildRange('2026-07-31', '2026-08-31');
let gapless = true;
const byUnit = new Map();
for (const e of all) {
  if (!byUnit.has(e.unit)) byUnit.set(e.unit, []);
  byUnit.get(e.unit).push(e);
}
let prevUnitEnd = null;
for (let d = '2026-07-31'; d <= '2026-08-31'; d = addDays(d, 1)) {
  const evs = byUnit.get(d);
  for (let i = 1; i < evs.length; i++) {
    if (evs[i].start !== evs[i - 1].end) {
      gapless = false;
      console.log(`GAP in ${d}: ${evs[i - 1].slot} ends ${evs[i - 1].end} but ${evs[i].slot} starts ${evs[i].start}`);
    }
  }
  if (prevUnitEnd && evs[0].start !== prevUnitEnd) {
    gapless = false;
    console.log(`UNIT GAP: ${d} starts ${evs[0].start} after prev ends ${prevUnitEnd}`);
  }
  prevUnitEnd = evs[evs.length - 1].end;
  check(`count ${d}`, evs.length, 15); // ١٥ حدثًا كل يوم بلا استثناء
  for (const e of evs) {
    if (e.end <= e.start) { gapless = false; console.log(`NEGATIVE ${d} ${e.slot}`); }
  }
}
check('gapless+contiguous 31/7→31/8', gapless, true);

// كل وحدة تفتح بنومة الثلث الأخير وتُغلق بالقيام، ومجموع نومها ثابت ٦ س ٣٥ د
let shapeOk = true, sleepOk = true;
for (const [d, evs] of byUnit) {
  if (evs[0].slot !== 'sleep2' || evs[evs.length - 1].slot !== 'qiyam') {
    shapeOk = false;
    console.log(`SHAPE ${d}: ${evs[0].slot} … ${evs[evs.length - 1].slot}`);
  }
  const mins = evs
    .filter((e) => e.title === 'نوم')
    .reduce((a, e) => a + (new Date(e.end) - new Date(e.start)) / 60000, 0);
  if (mins !== 395) { sleepOk = false; console.log(`SLEEP ${d}: ${mins}`); }
}
check('كل وحدة: نوم ← … ← قيام', shapeOk, true);
check('كل وحدة: مجموع النوم ٣٩٥ د', sleepOk, true);

// تسميات ما بعد العشاء والراحة (٣١/٧ جمعة، ١/٨ سبت، ٢/٨ أحد)
const titleOf = (d, slot) => byUnit.get(d).find((e) => e.slot === slot).title;
for (const [d, evening, rest] of [
  ['2026-07-31', 'أسرة', 'أصدقاء'],
  ['2026-08-01', 'أسرة', 'أصدقاء'],
  ['2026-08-02', 'عائلة', 'أسرة'],
]) {
  check(`family ${d}`, titleOf(d, 'family'), evening);
  check(`rest ${d}`, titleOf(d, 'rest'), rest);
  check(`sleep1 ${d} = نوم`, titleOf(d, 'sleep1'), 'نوم');
  check(`nap ${d} = نوم`, titleOf(d, 'nap'), 'نوم');
  check(`sleep2 ${d} = نوم`, titleOf(d, 'sleep2'), 'نوم');
}
check('لا بلوك اسمه «راحة» بعد اليوم', all.some((e) => e.title === 'راحة'), false);
// دورة التمرين متتابعة لا علاقة لها بأيام الأسبوع، تبدأ يوم البذرة (يوم التمرين الأول):
// تمرين/تطوير بالتناوب والأنواع تدور أ←ب←جري
const trainTitleOn = (d) => workoutTitle(d);
const TRAIN_NAMES = ['تمرين — اليوم الأول', 'تمرين — اليوم الثاني', 'تمرين — اليوم الثالث (جري)'];
check('يوم البداية: تمرين أ', trainTitleOn(D(0)), TRAIN_NAMES[0]);
check('+١ تطوير', trainTitleOn(D(1)), 'تطوير');
check('+٢ تمرين ب', trainTitleOn(D(2)), TRAIN_NAMES[1]);
check('+٤ جري', trainTitleOn(D(4)), TRAIN_NAMES[2]);
check('+٥ تطوير', trainTitleOn(D(5)), 'تطوير');
// الدورة تتجاهل أيام الأسبوع: أول جمعة بعد البداية تتبع الإزاحة لا اليوم
let firstFri = S;
while (dow(firstFri) !== 5) firstFri = addDays(firstFri, 1);
const offFri = daysBetween(S, firstFri);
check(
  'أول جمعة تتبع الدورة لا الأسبوع',
  trainTitleOn(firstFri),
  offFri % 2 === 1 ? 'تطوير' : TRAIN_NAMES[(offFri / 2) % 3]
);
check('قبل البداية تطوير', workoutTitle(addDays(S, -3)), 'تطوير');
// فحوص مرتبطة بأيام الأسبوع نفسها (لا بالبذرة): ١٤/٨ جمعة، ١٥/٨ سبت، ١٦/٨ أحد
const fri = (s) => byUnit.get('2026-08-14').find((e) => e.slot === s);
const sat = (s) => byUnit.get('2026-08-15').find((e) => e.slot === s);
const sun = (s) => byUnit.get('2026-08-16').find((e) => e.slot === s);
check('لا بلوك دعاء منفصل', !!fri('duaa'), false);
check('الجمعة بعد العصر: عائلة ودعاء', fri('work3').title, 'عائلة ودعاء');
check('وصف الجمعة فيه ساعة الاستجابة', txt(fri('work3')).includes('ساعة استجابة الدعاء'), true);
check('الجمعة يمتد إلى المغرب', fri('work3').end, fri('maghrib').start);
// الجمعة: تبكير — بلوك الجمعة يبدأ قبل الزوال بساعة، والنومة تنتهي عنده
check('الجمعة: بلوك الظهر اسمه الجمعة', fri('dhuhr').title, 'الجمعة');
check('الجمعة: البلوك يبدأ قبل الزوال بساعة', (new Date(sun('dhuhr').start).getHours() * 60 + new Date(sun('dhuhr').start).getMinutes()) - (new Date(fri('dhuhr').start).getHours() * 60 + new Date(fri('dhuhr').start).getMinutes()), 60);
check('الجمعة: النومة تلي بلوك المهام', fri('nap').start, fri('quran').end);
check('الجمعة: العمل ينتهي ببداية الجمعة', fri('work1').end, fri('dhuhr').start);
check('الجمعة: نهاية البلوك بعد الزوال بـ٤٥ د كبقية الأيام', `${T(fri('dhuhr').start)}-${T(fri('dhuhr').end)}`, '10:58-12:43');
check('الجمعة: مدة البلوك ١٠٥ د', (new Date(fri('dhuhr').end) - new Date(fri('dhuhr').start)) / 60000, 105);
check('غير الجمعة: البلوك ٤٥ د يبدأ بالزوال', (new Date(sun('dhuhr').end) - new Date(sun('dhuhr').start)) / 60000, 45);
check('نهار الجمعة الأول أسرة', fri('work1').title, 'أسرة');
check('نهار الجمعة الأوسط عائلة', fri('work2').title, 'عائلة');
check('ما بعد عشاء الجمعة أسرة', fri('family').title, 'أسرة');
check('راحة الجمعة أصدقاء', fri('rest').title, 'أصدقاء');
check('نهار السبت الأول أسرة', sat('work1').title, 'أسرة');
check('نهار السبت الأوسط عائلة', sat('work2').title, 'عائلة');
check('نهار السبت بعد العصر عائلة', sat('work3').title, 'عائلة');
check('ما بعد عشاء السبت أسرة', sat('family').title, 'أسرة');
check('ما بعد عشاء الأحد عائلة', sun('family').title, 'عائلة');
check('راحة الأحد أسرة', sun('rest').title, 'أسرة');
check('لا وجود لاسم «أسرة وزوجة» إطلاقًا', all.some((e) => e.title.includes('أسرة وزوجة')), false);

// ── الوجبات ──────────────────────────────────────────────────────
// أحد–خميس: وجبتان (١ في القيام سحورًا، و٢ بين أذان المغرب والإقامة)
check('وجبة ١ في قيام الأحد', txt(sun('qiyam')).includes('وجبة رقم ١ (سحور)'), true);
check('وجبة ٢ في مغرب الأحد', txt(sun('maghrib')).includes('بين الأذان والإقامة: وجبة رقم ٢'), true);
check('لا وجبة في أسرة الليل', txt(sun('family')).includes('وجبة'), false);
check('لا وجبة ٣ في راحة الأحد', txt(sun('rest')).includes('وجبة'), false);
// الجمعة والسبت: ثلاث وجبات نهارية/ليلية ولا سحور
for (const [nm, g] of [['الجمعة', fri], ['السبت', sat]]) {
  check(`${nm}: وجبة ١ قبل الظهر`, txt(g('work1')).includes('وجبة رقم ١'), true);
  check(`${nm}: وجبة ٢ بعد الظهر`, txt(g('work2')).includes('وجبة رقم ٢'), true);
  check(`${nm}: وجبة ٣ في راحة ما بعد العشاء`, txt(g('rest')).includes('وجبة رقم ٣'), true);
  check(`${nm}: لا سحور في القيام`, txt(g('qiyam')).includes('وجبة'), false);
  check(`${nm}: المغرب شعر لا وجبة`, txt(g('maghrib')).includes('كتابة شعر'), true);
}
check('نهار الأحد مهام', sun('work1').title, 'مهام');
check('الأحد بعد العصر مهام', sun('work3').title, 'مهام');
check('صلة رحم في أسرة الجمعة', txt(fri('work1')).includes('صلة رحم'), true);
check('لا صلة رحم في أسرة السبت', txt(sat('work1')).includes('صلة رحم'), false);
check('نومة الضحى نفسها في الجمعة والسبت', [fri('nap').title, sat('nap').title].join('|'), 'نوم|نوم');

// ── آلة حالة القرآن (البذرة: مراجعة جزء ١، حفظ ربع ١ من جزء ١٠) ──
const q = (d) => quranStateFor(d);
check('البذرة: مراجعة 1 حفظ ربع1', JSON.stringify(q(D(0))), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
check('قبل البذرة = البذرة', JSON.stringify(q(D(-6))), JSON.stringify(q(D(0))));
check('+١ تكرار ربع1', JSON.stringify(q(D(1))), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'تكرار' }));
check('+٥ review=6 تكرار ربع3', JSON.stringify(q(D(5))), JSON.stringify({ reviewJuz: 6, hifzJuz: 10, hifzQuarter: 3, hifzMode: 'تكرار' }));
check('+٧ review يلف إلى 1', JSON.stringify(q(D(7))), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 4, hifzMode: 'تكرار' }));
check('+١٥ تكرار ربع8', JSON.stringify(q(D(15))), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 8, hifzMode: 'تكرار' }));
check('+١٦ انتقال جزء الحفظ', JSON.stringify(q(D(16))), JSON.stringify({ reviewJuz: 3, hifzJuz: 11, hifzQuarter: 1, hifzMode: 'حفظ' }));
// التثبيت: قبل الانتقال [٨،٩] وبعده [٩،١٠]
const fajr23 = buildUnit(D(15)).find((e) => e.slot === 'fajr');
check('تثبيت +١٥ = جزء ٨', txt(fajr23).includes('سنة الفجر — الجزء ٨'), true);
const fajr24 = buildUnit(D(16)).find((e) => e.slot === 'fajr');
check('تثبيت +١٦ = جزء ٩', txt(fajr24).includes('سنة الفجر — الجزء ٩'), true);
const isha24 = buildUnit(D(16)).find((e) => e.slot === 'isha');
check('عشاء +١٦ على الجزء ١٠', txt(isha24).includes('الجزء ١٠'), true);

// ── تقدّم التمرين عبر الشهر (يوم البذرة = يوم التمرين الأول) ──
const trainOn = (d) => wdesc(d);
check('+٠ بريس 40×6', trainOn(D(0)).includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('+٢ بريس 40×7', trainOn(D(2)).includes('× ٧ عدات @ ٤٠ كجم'), true);
check('+٨ بريس 40×9', trainOn(D(8)).includes('× ٩ عدات @ ٤٠ كجم'), true);
check('+١٢ بريس 45×6 (زيادة الوزن)', trainOn(D(12)).includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٥ كجم'), true);

check('+١٢ سحب أفقي 55', trainOn(D(12)).includes('السحب الأفقي — ٤ جلسات × ٦ عدات @ ٥٥ كجم'), true);
check('+٠ بلانك 40', trainOn(D(0)).includes('بلانك — جلستان × ٤٠ ث'), true);
check('+٢ بلانك 42.5', trainOn(D(2)).includes('٤٢٫٥ ث'), true);

check('+٠ كتف خلفي 10×8', trainOn(D(0)).includes('كتف خلفي — ٢ جلسات × ٨ عدات @ ١٠ كجم'), true);
// بلوغ أعلى النطاق ثم قفزة الوزن التالية (خارج نافذة byUnit فيُقرأ من المحرك مباشرة)
const { workoutDesc: wd } = await import('../lib/engine/workout.js');
check('+٢٠ بريس 45×9 (أعلى النطاق)', wd(D(20)).includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٩ عدات @ ٤٥ كجم'), true);
check('+٢٠ بلانك 57.5', wd(D(20)).includes('٥٧٫٥ ث'), true);
check('+٢٤ بريس 50×6 (قفزة الوزن)', wd(D(24)).includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٥٠ كجم'), true);
check('+١٢ كتف جانبي 12.5×8', trainOn(D(12)).includes('كتف جانبي — ٢ جلسات × ٨ عدات @ ١٢٫٥ كجم'), true);

// ── التقدّم المشروط بالإنجاز: اليوم الفائت تُعاد مهمته ولا يتقدم شيء ──
const { setQuranCompletion, clearQuranCache } = await import('../lib/engine/quran.js');
const { setWorkoutCompletion, workoutDesc } = await import('../lib/engine/workout.js');

// فوات يوم البذرة كاملًا: اليوم التالي يعيد نفس الحالة تمامًا
setQuranCompletion((d) => (d === D(0) ? { review: false, hifz: false } : { review: true, hifz: true }));
check('فوات يوم البذرة → التالي يعيد نفس المهمة', JSON.stringify(q(D(1))), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
check('ثم +٢ يتقدم طبيعيًا', JSON.stringify(q(D(2))), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'تكرار' }));
// إنجاز جزئي: التسميع أُنجز والحفظ فات — يتقدم مسار دون الآخر
setQuranCompletion((d) => (d === D(0) ? { review: true, hifz: false } : { review: true, hifz: true }));
check('إنجاز التسميع وحده يقدّمه وحده', JSON.stringify(q(D(1))), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
setQuranCompletion(null);
clearQuranCache();

// فوات التمرين الأول كاملًا: يوم التمرين التالي يعرض أهدافه نفسها (بريس ٦ لا ٧)
setWorkoutCompletion((d) => d !== D(0));
check('فوات يوم١ → يوم٢ بريس ٤٠×٦', workoutDesc(D(2)).includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
setWorkoutCompletion(null);
check('بعد الاسترجاع: يوم٢ بريس ٤٠×٧', workoutDesc(D(2)).includes('× ٧ عدات @ ٤٠ كجم'), true);

// ── تجميد تمرين واحد لا يؤثر في البقية ──
setWorkoutCompletion((d, k) => !(d === D(0) && k === 'press'));
const d10 = workoutDesc(D(2));
check('البريس وحده تجمّد (٦ عدات)', d10.includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('السحب الأفقي تقدّم رغم ذلك (٧ عدات)', d10.includes('السحب الأفقي — ٤ جلسات × ٧ عدات @ ٥٠ كجم'), true);
setWorkoutCompletion(null);

// ── الخطة المُهيكلة للواجهة التفاعلية ──
const { workoutPlan } = await import('../lib/engine/workout.js');
const plan1 = workoutPlan(D(0));
check('خطة اليوم الأول ٨ بنود', plan1.items.length, 8);
check('أول بند البريس', plan1.items[0].key, 'press');
check('البريس ٤ جلسات', plan1.items[0].sets, 4);
check('السكوات حتى الفشل', plan1.items[3].kind, 'failure');
check('باي+تراي سوبر ست', plan1.items[6].kind, 'superset');
check('السوبر ست طرفان', plan1.items[6].parts.length, 2);
check('البلانك hold', plan1.items[7].kind, 'hold');
check('راحة البريس ١٢٠', plan1.items[0].rest, 120);
const plan2 = workoutPlan(D(2));
check('خطة اليوم الثاني ٩ بنود', plan2.items.length, 9);
check('اليوم الثاني فيه فراشة', plan2.items[1].key, 'fly');
check('اليوم الثاني كتف أمامي فشل', plan2.items.find((i) => i.key === 'frontdelt').kind, 'failure');
check('اليوم الثاني هامر+تراي', plan2.items.find((i) => i.kind === 'superset').key, 'hammer+tri');
check('يوم الجري', workoutPlan(D(4)).type, 3);
check('يوم تطوير بلا خطة', workoutPlan(D(1)), null);

// ── مجمعات أخطاء القرآن (متابعة الأخطاء عبر ثلاثة أماكن) ──────────────
const { quranTaskLines, tathbeetPoolKey, reviewPoolKey, hifzPoolKey } = await import('../lib/engine/quran.js');
// يوم حفظ (يوم البذرة): بندان فقط، بند الحفظ بلا مجمع أخطاء (لا تتبّع يوم الحفظ نفسه)
const tlH = quranTaskLines(q(D(0)));
check('يوم حفظ: بندان', tlH.length, 2);
check('يوم حفظ: مجمع التسميع', tlH[0].pool, 'rv:1');
check('يوم حفظ: بند الحفظ بلا مجمع', tlH[1].pool, null);
// يوم تكرار الربع الأول (+١): بندان، تكرار بمجمعه، بلا مراجعة أرباع سابقة (لا يوجد ربع قبل 1)
const tlR1 = quranTaskLines(q(D(1)));
check('تكرار ربع1: بندان (لا مراجعة سابقة)', tlR1.length, 2);
check('تكرار ربع1: نص «× ٥ مرات»', tlR1[1].text.includes('× ٥ مرات'), true);
check('تكرار ربع1: مجمع hz:10:1', tlR1[1].pool, 'hz:10:1');
// يوم تكرار الربع الثامن (+١٥): ٩ بنود — تسميع + تكرار + مراجعة الأرباع ١..٧، كل بند بمجمعه الخاص
const tlR8 = quranTaskLines(q(D(15)));
check('تكرار ربع8: ٩ بنود (تسميع + تكرار + مراجعة ١..٧)', tlR8.length, 9);
check('تكرار ربع8: مجمع الربع الحالي', tlR8[1].pool, 'hz:10:8');
check('تكرار ربع8: مجمع مراجعة الربع1', tlR8[2].pool, 'hz:10:1');
check('تكرار ربع8: مجمع مراجعة الربع7', tlR8[8].pool, 'hz:10:7');
// نفس الربع يحمل نفس المجمع سواء في يوم تكراره أو حين يُراجَع لاحقًا ضمن تكرار ربع أعلى
check('استمرارية المجمع: hz:10:1 من تكرار الربع1 ومن مراجعة تكرار الربع8', hifzPoolKey(10, 1), tlR8[2].pool);
// مساعد مفاتيح التثبيت: يطابق الترتيب [فجر،ضحى،ظهرقبلية،ظهربعدية،عصر،مغرب،عشاءقبلية،عشاءبعدية]
const stR8 = q(D(15)); // hifzJuz=10 → تثبيت [8,9]
check('تثبيت فجر = tb:8:1', tathbeetPoolKey(stR8, 0), 'tb:8:1');
check('تثبيت ضحى = tb:8:2', tathbeetPoolKey(stR8, 1), 'tb:8:2');
check('تثبيت عصر = tb:9:1 (يبدأ الجزء الثاني)', tathbeetPoolKey(stR8, 4), 'tb:9:1');
check('تثبيت عشاء بعدية = tb:9:4', tathbeetPoolKey(stR8, 7), 'tb:9:4');
check('reviewPoolKey/hifzPoolKey تطابق بناء الأسطر', reviewPoolKey(5), 'rv:5');
check('hifzPoolKey', hifzPoolKey(11, 3), 'hz:11:3');

// ── بين الأذان والإقامة: شعر في كل الصلوات، وسورة الكهف في صلاة الجمعة (٧ أغسطس) ──
const u7 = buildUnit('2026-08-14'); // جمعة
const u8 = buildUnit('2026-08-16'); // أحد (يوم عادي)
const bl = (u, slot) => u.find((e) => e.slot === slot);
check('فجر: بند ما بين الأذان والإقامة شعر', item(bl(u7, 'fajr'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
check('فجر: بند سنة الفجر', item(bl(u7, 'fajr'), 'sunnah').text.startsWith('سنة الفجر'), true);
check('ظهر الجمعة: سورة الكهف', item(bl(u7, 'dhuhr'), 'between').text, 'بين الأذان والإقامة: قراءة سورة الكهف');
check('ظهر الجمعة: صلاة الجمعة', item(bl(u7, 'dhuhr'), 'pray').text, 'صلاة الجمعة');
check('ظهر الأحد: شعر لا كهف', item(bl(u8, 'dhuhr'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
check('ظهر الأحد: صلاة الظهر', item(bl(u8, 'dhuhr'), 'pray').text, 'صلاة الظهر');
check('عصر: بند ما بين الأذان والإقامة', item(bl(u8, 'asr'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
check('مغرب يوم عادي: وجبة ٢ بين الأذان والإقامة (لا قبلية)', item(bl(u8, 'maghrib'), 'between').text, 'بين الأذان والإقامة: وجبة رقم ٢');
check('عشاء: بند ما بين الأذان والإقامة', item(bl(u8, 'isha'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
check('الكهف مرة واحدة أسبوعيًا: لا كهف في فجر الجمعة', item(bl(u7, 'fajr'), 'between').text.includes('الكهف'), false);
// معرّفات السنن الثمانية التي تتعلّق بها خريطة التثبيت في store.ts — وجودها شرط
const TB = [['fajr', 'sunnah'], ['fajr', 'duha'], ['dhuhr', 'sunnahBefore'], ['dhuhr', 'sunnahAfter'],
  ['asr', 'sunnah'], ['maghrib', 'sunnah'], ['isha', 'sunnahBefore'], ['isha', 'sunnahAfter']];
check('معرّفات السنن الثمانية موجودة', TB.every(([sl, id]) => !!item(bl(u8, sl), id)), true);
check('كل بند له معرّف ونص', u8.every((e) => e.items.every((i) => i.id && i.text)), true);
check('معرّفات البنود فريدة داخل البلوك', u8.every((e) => new Set(e.items.map((i) => i.id)).size === e.items.length), true);

// ── الخزانات: خزانة ← أدراج ← مهام، بتكرار ومواعيد متوارثة ─────────
const { itemsForDay, repeatLabel, dueOn } = await import('../lib/engine/cabinets.js');
const cabData = (item, drawer = {}, cabinet = {}) => ({
  cabinets: [{ id: 'c', name: 'بفر', ...cabinet }],
  drawers: [{ id: 'd', cabinetId: 'c', name: 'الفيز الأول', ...drawer }],
  items: [{ id: 'i', drawerId: 'd', title: 'الفرونت إند', slot: 'work2', from: '2026-08-24', ...item }],
});
const due = (d, item, drawer, cabinet) => (itemsForDay(d, cabData(item, drawer, cabinet), 'quran').get('work2') || []).length > 0;

// كل يومين: يوم نعم ويوم لا، لا علاقة له بأيام الأسبوع
const everyTwo = { repeat: { mode: 'everyN', n: 2 } };
check('كل يومين: يوم البداية', due('2026-08-24', everyTwo), true);
check('كل يومين: الغد لا', due('2026-08-25', everyTwo), false);
check('كل يومين: بعد الغد نعم', due('2026-08-26', everyTwo), true);
check('قبل تاريخ البداية لا شيء', due('2026-08-23', everyTwo), false);
// أيام الأسبوع: أحد وثلاثاء وخميس
const weekly = { repeat: { mode: 'weekly', days: [0, 2, 4] } };
check('أسبوعي: الأحد نعم', due('2026-08-30', weekly), true);
check('أسبوعي: الاثنين لا', due('2026-08-31', weekly), false);
check('مرة واحدة: يومها فقط', due('2026-08-24', { repeat: { mode: 'once' } }), true);
check('مرة واحدة: لا تتكرر', due('2026-08-26', { repeat: { mode: 'once' } }), false);
// توارث الموعد النهائي: المهمة ← الدرج ← الخزانة
check('موعد الدرج يقطع', due('2026-08-28', everyTwo, { deadline: '2026-08-26' }), false);
check('وقبله يستمر', due('2026-08-26', everyTwo, { deadline: '2026-08-26' }), true);
check('موعد الخزانة يُورَّث', due('2026-08-28', everyTwo, {}, { deadline: '2026-08-26' }), false);
check('موعد المهمة يسبق الجميع', due('2026-08-28', { ...everyTwo, deadline: '2026-09-30' }, { deadline: '2026-08-26' }), true);
check('بلا موعد يستمر بلا حد', due('2027-08-25', everyTwo), true); // إزاحة ٣٦٦ يومًا
// «إتمام الهدف» يُخفي المهمة أو الدرج أو الخزانة
check('إتمام المهمة يُخفيها', due('2026-08-26', { ...everyTwo, doneAt: '2026-08-24' }), false);
check('إتمام الدرج يُخفي مهامه', due('2026-08-26', everyTwo, { doneAt: '2026-08-24' }), false);
check('إتمام الخزانة يُخفي كل شيء', due('2026-08-26', everyTwo, {}, { doneAt: '2026-08-24' }), false);
// المهمة بلا بلوك محدَّد تذهب إلى البلوك الافتراضي
check('بلا بلوك ← الافتراضي', (itemsForDay('2026-08-24', cabData({ slot: undefined, ...everyTwo }), 'quran').get('quran') || []).length, 1);
check('وصف التكرار: يومًا بعد يوم', repeatLabel({ mode: 'everyN', n: 2 }, (x) => x), 'يومًا بعد يوم');
check('وصف التكرار: كل يوم', repeatLabel({ mode: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] }, (x) => x), 'كل يوم');
check('dueOn مُصدَّرة للواجهة', typeof dueOn, 'function');

// ── عينة عرض ───────────────────────────────────────────────────────
console.log('\n── وحدة اليوم الجمعة ٣١ يوليو ──');
for (const e of byUnit.get('2026-07-31')) console.log(`${e.start.slice(5)} → ${e.end.slice(11)}  ${e.title}`);
console.log('\n── مواقيت الأسبوع ──');
for (let d = '2026-07-31'; d <= '2026-08-08'; d = addDays(d, 1)) {
  const p = prayerTimes(d);
  console.log(`${d}  فجر ${fmtTime(p.fajr)}  شروق ${fmtTime(p.sunrise)}  ظهر ${fmtTime(p.dhuhr)}  عصر ${fmtTime(p.asr)}  مغرب ${fmtTime(p.maghrib)}  عشاء ${fmtTime(p.isha)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
