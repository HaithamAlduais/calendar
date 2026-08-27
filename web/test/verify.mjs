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
function ok(label, cond, why = '') {
  if (cond) pass++; else { fail++; console.log(`FAIL ${label} ${why}`); }
}
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

// ── بنية الوحدة: ٢٤ ساعة من الفَحْمة إلى الفَحْمة ───────────────────
// الفَحْمة والهَزيع والغَزالة والهاجِرة ساعاتٌ زمانية: الليل اثنتا عشرة ساعة
// من المغرب إلى فجر الغد، والنهار مثلها من الشروق إلى المغرب.
const u30 = buildUnit('2026-07-30');
const bySlot = Object.fromEntries(u30.map((e) => [e.slot, e]));
const T = (s) => s.slice(11);
const txt = (ev) => ev.items.map((i) => i.text).join(String.fromCharCode(10));
const item = (ev, id) => ev.items.find((i) => i.id === id);
const dur = (ev) => (new Date(ev.end) - new Date(ev.start)) / 60000;

// المراسي الزمانية محسوبةً هنا استقلالًا عن المحرك
const nightPrev = p30.fajr + 1440 - p29.maghrib; // ليلة ٢٩←٣٠
const fahmaPrev = p29.maghrib + Math.round((4 * nightPrev) / 12);
const hazeePrev = p29.maghrib + Math.round((6 * nightPrev) / 12);
const dayLen = p30.maghrib - p30.sunrise;
const ghazala = p30.sunrise + Math.round((3 * dayLen) / 12);
const hajira = p30.sunrise + Math.round((4 * dayLen) / 12);

// ترتيب البلوكات الستة عشر
check(
  'u30 ترتيب اليوم',
  u30.map((e) => e.slot).join(','),
  'rest,sleep1,qiyam,fajr,routine,sleep2,wife1,work1,dhuhr,work2,asr,work3,maghrib,wife2,isha,family'
);
check('u30 عدد البلوكات', u30.length, 16);

// ١) الراحة تفتتح اليوم: من الفَحْمة إلى الهَزيع
check('u30 يبدأ بالراحة', u30[0].slot, 'rest');
check('u30 الراحة تبدأ بالفَحْمة', T(bySlot.rest.start), fmtTime(fahmaPrev % 1440));
check('u30 الراحة تنتهي بالهَزيع', T(bySlot.rest.end), fmtTime(hazeePrev % 1440));
check('u30 الراحة بلوك مهام', !!u30[0].items && bySlot.rest.title, 'راحة');

// ٢) النوم من الهَزيع إلى ما قبل الفجر بـ٤٥، ولا يُنقر عليه
check('u30 النوم يلي الراحة', bySlot.sleep1.start, bySlot.rest.end);
check('u30 النوم ينتهي قبل الفجر بـ٤٥', dur(bySlot.qiyam), 45);
check('u30 النوم مقفل', bySlot.sleep1.locked, true);
check('u30 النوم اسمه نوم', bySlot.sleep1.title, 'نوم');

// ٣) القيام: آخر ٤٥ دقيقة قبل الفجر، وفيه الوجبة الأولى ثم الوتر ثم الدعاء
check('u30 القيام ينتهي بالفجر', bySlot.qiyam.end, bySlot.fajr.start);
check('u30 وجبة ١ في القيام', txt(bySlot.qiyam).includes('وجبة رقم ١'), true);
check('u30 الوتر في القيام', !!item(bySlot.qiyam, 'witr'), true);
check('u30 الدعاء في القيام', !!item(bySlot.qiyam, 'dua'), true);
check('u30 التوبة والاستخارة', item(bySlot.qiyam, 'tawbah').text, 'توبة واستخارة');

// ٤) الفجر ثم الروتين إلى الشروق وربع
check('u30 fajr', `${T(bySlot.fajr.start)}-${T(bySlot.fajr.end)}`, '03:54-04:39');
check('u30 الروتين يلي الفجر', bySlot.routine.start, bySlot.fajr.end);
check('u30 الروتين ينتهي بالشروق وربع', T(bySlot.routine.end), fmtTime(p30.sunrise + 15));
check('u30 اسم الروتين', bySlot.routine.title, 'الروتين');

// ٥) النوم إلى الغَزالة، ثم مهام إلى الهاجِرة، ثم زوجة إلى الظهر
check('u30 النوم الثاني ينتهي بالغَزالة', T(bySlot.sleep2.end), fmtTime(ghazala));
check('u30 النوم الثاني مقفل', bySlot.sleep2.locked, true);
check('u30 الزوجة تنتهي بالهاجِرة', T(bySlot.wife1.end), fmtTime(hajira));
check('u30 وجبة ٢ في مهام الهاجِرة', txt(bySlot.work1).includes('وجبة رقم ٢'), true);
check('u30 المهام من الهاجِرة إلى الظهر', `${T(bySlot.work1.start)}-${T(bySlot.work1.end)}`, `${fmtTime(hajira)}-${fmtTime(p30.dhuhr)}`);
check('u30 الزوجة تلي نومَ الصباح', bySlot.wife1.start, bySlot.sleep2.end);
// النسبة: المهام ساعتان زمانيتان والزوجة ساعة — لا العكس
ok('u30 المهام ضعفُ الزوجة', dur(bySlot.work1) > 1.8 * dur(bySlot.wife1), `${dur(bySlot.work1)} vs ${dur(bySlot.wife1)}`);
check('u30 الزوجة مقفلة', bySlot.wife1.locked, true);

// ٦) الظهر فمهام فالعصر فمهام فالمغرب
check('u30 dhuhr', `${T(bySlot.dhuhr.start)}-${T(bySlot.dhuhr.end)}`, '12:00-12:45');
check('u30 work2 ينتهي بالعصر', T(bySlot.work2.end), '15:26');
check('u30 work3 ينتهي بالمغرب', T(bySlot.work3.end), '18:39');
check('u30 maghrib', `${T(bySlot.maghrib.start)}-${T(bySlot.maghrib.end)}`, '18:39-19:09');

// ٧) زوجة من المغرب إلى العشاء، ثم العشاء، ثم أسرة إلى الفَحْمة
check('u30 زوجة المساء', `${T(bySlot.wife2.start)}-${T(bySlot.wife2.end)}`, '19:09-20:09');
check('u30 زوجة المساء مقفلة', bySlot.wife2.locked, true);
check('u30 isha', `${T(bySlot.isha.start)}-${T(bySlot.isha.end)}`, '20:09-20:54');
check('u30 الأسرة تختم اليوم', u30[u30.length - 1].slot, 'family');
check('u30 وجبة ٣ في الأسرة', txt(bySlot.family).includes('وجبة رقم ٣'), true);

// ٨) اليوم ٢٤ ساعة، متلاصق، والوحدات تتصل
{
  const span = (new Date(u30.at(-1).end) - new Date(u30[0].start)) / 3600000;
  ok('u30 اليوم ≈ ٢٤ ساعة', span > 23.5 && span < 24.5, `= ${span.toFixed(2)}`);
  for (let i = 1; i < u30.length; i++)
    ok(`u30 لا فجوة عند ${u30[i].slot}`, u30[i].start === u30[i - 1].end, `${u30[i - 1].end}≠${u30[i].start}`);
  check('u30 تلاصق الوحدتين', buildUnit('2026-07-31')[0].start, u30.at(-1).end);
}

// ٩) النوم مجموعُه بين ٦ و٨ ساعات
{
  const sleep = u30.filter((e) => e.slot.startsWith('sleep')).reduce((s, e) => s + dur(e), 0) / 60;
  ok('u30 مجموع النوم ٦–٨ س', sleep > 6 && sleep < 8, `= ${sleep.toFixed(2)}`);
}

// ١٠) سنة الضحى في الفجر، ولا بلوك تمرين منفصل
check('u30 سنة الضحى في الفجر', item(bySlot.fajr, 'duha').text.startsWith('سنة الضحى'), true);
check('u30 لا بلوك تمرين منفصل', !!bySlot.train, false);


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
  check(`count ${d}`, evs.length, 16); // ١٦ بلوكًا كل يوم بلا استثناء
  for (const e of evs) {
    if (e.end <= e.start) { gapless = false; console.log(`NEGATIVE ${d} ${e.slot}`); }
  }
}
check('gapless+contiguous 31/7→31/8', gapless, true);

// كل وحدة تفتح بالراحة (الفَحْمة) وتُغلق بالأسرة، ونومُها بين ٦ و٨ ساعات
let shapeOk = true, sleepOk = true, spanOk = true;
for (const [d, evs] of byUnit) {
  if (evs[0].slot !== 'rest' || evs[evs.length - 1].slot !== 'family') {
    shapeOk = false;
    console.log(`SHAPE ${d}: ${evs[0].slot} … ${evs[evs.length - 1].slot}`);
  }
  const mins = evs
    .filter((e) => e.title === 'نوم')
    .reduce((a, e) => a + (new Date(e.end) - new Date(e.start)) / 60000, 0);
  if (mins < 360 || mins > 480) { sleepOk = false; console.log(`SLEEP ${d}: ${mins}`); }
  const span = (new Date(evs[evs.length - 1].end) - new Date(evs[0].start)) / 3600000;
  if (span < 23.5 || span > 24.5) { spanOk = false; console.log(`SPAN ${d}: ${span.toFixed(2)}`); }
}
check('كل وحدة: راحة ← … ← أسرة', shapeOk, true);
check('كل وحدة: النوم ٦–٨ ساعات', sleepOk, true);
check('كل وحدة: أربعٌ وعشرون ساعة', spanOk, true);

// اليوم واحدٌ لا يعرف الأسبوع: لا جمعةَ بقالبٍ خاص ولا سبت
{
  const titles = (d) => Object.fromEntries(buildUnit(d).map((e) => [e.slot, e.title]));
  const a = titles('2026-07-31'); // جمعة
  const b = titles('2026-08-01'); // سبت
  const c = titles('2026-08-02'); // أحد
  check('الجمعة كغيرها: الراحة راحة', a.rest, 'راحة');
  check('الجمعة كغيرها: الأسرة أسرة', a.family, 'أسرة');
  check('السبت مثلها', b.rest + '/' + b.family, 'راحة/أسرة');
  check('الأحد مثلها', c.rest + '/' + c.family, 'راحة/أسرة');
  check('لا بلوك جمعة', !!titles('2026-07-31').jumua, false);
  check('الزوجة في كل يوم', a.wife1 + '/' + a.wife2, 'زوجة/زوجة');
}

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
check('ظهر الأحد: شعر لا كهف', item(bl(u8, 'dhuhr'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
check('ظهر الأحد: صلاة الظهر', item(bl(u8, 'dhuhr'), 'pray').text, 'صلاة الظهر');
check('عصر: بند ما بين الأذان والإقامة', item(bl(u8, 'asr'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
check('مغرب: ما بين الأذان والإقامة شِعر', item(buildUnit('2026-07-30').find((e) => e.slot === 'maghrib'), 'between').text, 'بين الأذان والإقامة: كتابة شعر');
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
