// تحقق شامل من المحرّك ضد القيم المرجعية المأخوذة من التقويم اليدوي لهيثم
import { prayerTimes, fmtTime } from '../lib/engine/prayers.js';
import { buildUnit, buildRange } from '../lib/engine/schedule.js';
import { quranStateFor } from '../lib/engine/quran.js';
import { addDays, dow, daysBetween } from '../lib/engine/dates.js';

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

// ── بنية وحدة الخميس ٣٠ يوليو (فجر ← فجر الغد) ─────────────────────
const u30 = buildUnit('2026-07-30');
const bySlot = Object.fromEntries(u30.map((e) => [e.slot, e]));
const T = (s) => s.slice(11);
check('u30 maghrib', `${T(bySlot.maghrib.start)}-${T(bySlot.maghrib.end)}`, '18:39-19:09');
check('u30 sleep1', `${T(bySlot.sleep1.start)}-${T(bySlot.sleep1.end)}`, '19:09-20:09');
check('u30 isha', `${T(bySlot.isha.start)}-${T(bySlot.isha.end)}`, '20:09-20:54');
check('u30 family end (ثلث أول)', T(bySlot.family.end), '21:44');
check('u30 qiyam', `${T(bySlot.qiyam.start)}-${T(bySlot.qiyam.end)}`, '00:19-00:49');
check('u30 sleep2', `${T(bySlot.sleep2.start)}-${T(bySlot.sleep2.end)}`, '00:49-03:54');
check('u30 fajr أول الوحدة', `${T(bySlot.fajr.start)}-${T(bySlot.fajr.end)}`, '03:54-04:39');
check('u30 يبدأ بالفجر', u30[0].slot, 'fajr');
check('u30 ينتهي بنوم حتى فجر الغد', u30[u30.length - 1].slot, 'sleep2');
check('u30 quran', `${T(bySlot.quran.start)}-${T(bySlot.quran.end)}`, '04:39-05:35');
check('u30 train', `${T(bySlot.train.start)}-${T(bySlot.train.end)}`, '05:35-06:50');
check('u30 nap (نوم بعد التمرين)', `${T(bySlot.nap.start)}-${T(bySlot.nap.end)}`, '06:50-09:20');
check('u30 work1', `${T(bySlot.work1.start)}-${T(bySlot.work1.end)}`, '09:20-12:00');
check('u30 dhuhr', `${T(bySlot.dhuhr.start)}-${T(bySlot.dhuhr.end)}`, '12:00-12:45');
check('u30 work2 end (عصر)', T(bySlot.work2.end), '15:26');
check('u30 work3 end (مغرب)', T(bySlot.work3.end), '18:39');
check('u30 count', u30.length, 16);
check('u30 rest name (خميس=زوجة)', bySlot.rest.title, 'زوجة');

// ── صفر فجوات وصفر تداخل عبر النطاق كاملًا + تلاصق الوحدات ─────────
const all = buildRange('2026-07-31', '2026-08-28');
let gapless = true;
const byUnit = new Map();
for (const e of all) {
  if (!byUnit.has(e.unit)) byUnit.set(e.unit, []);
  byUnit.get(e.unit).push(e);
}
let prevUnitEnd = null;
for (let d = '2026-07-31'; d <= '2026-08-28'; d = addDays(d, 1)) {
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
  const wantCount = dow(d) === 5 ? 17 : 16;
  check(`count ${d}`, evs.length, wantCount);
  for (const e of evs) {
    if (e.end <= e.start) { gapless = false; console.log(`NEGATIVE ${d} ${e.slot}`); }
  }
}
check('gapless+contiguous 31/7→28/8', gapless, true);

// أسماء الراحة والتمرين حسب اليوم
check('rest الجمعة', byUnit.get('2026-07-31').find((e) => e.slot === 'rest').title, 'راحة');
check('rest السبت', byUnit.get('2026-08-01').find((e) => e.slot === 'rest').title, 'راحة');
check('rest الأحد', byUnit.get('2026-08-02').find((e) => e.slot === 'rest').title, 'زوجة');
// دورة التمرين متتابعة لا علاقة لها بأيام الأسبوع، بدأت الجمعة ٧/٨ (يوم التمرين الأول):
// تمرين/تطوير بالتناوب والأنواع تدور أ←ب←جري
check('7/8 تمرين أ (بداية الدورة)', byUnit.get('2026-08-07').find((e) => e.slot === 'train').title, 'تمرين — اليوم الأول');
check('8/8 تطوير', byUnit.get('2026-08-08').find((e) => e.slot === 'train').title, 'تطوير');
check('9/8 تمرين ب', byUnit.get('2026-08-09').find((e) => e.slot === 'train').title, 'تمرين — اليوم الثاني');
check('11/8 جري', byUnit.get('2026-08-11').find((e) => e.slot === 'train').title, 'تمرين — اليوم الثالث (جري)');
check('12/8 تطوير', byUnit.get('2026-08-12').find((e) => e.slot === 'train').title, 'تطوير');
check('13/8 (خميس!) تمرين أ — الدورة تتجاهل الأسبوع', byUnit.get('2026-08-13').find((e) => e.slot === 'train').title, 'تمرين — اليوم الأول');
check('قبل البداية تطوير', byUnit.get('2026-08-06').find((e) => e.slot === 'train').title, 'تطوير');
check('دعاء الجمعة موجود', !!byUnit.get('2026-08-07').find((e) => e.slot === 'duaa'), true);
check('دعاء السبت غائب', !!byUnit.get('2026-08-08').find((e) => e.slot === 'duaa'), false);
check('نهار الجمعة عائلة', byUnit.get('2026-08-07').find((e) => e.slot === 'work1').title, 'عائلة');
check('نهار الجمعة عائلة (٣)', byUnit.get('2026-08-07').find((e) => e.slot === 'work3').title, 'عائلة');
check('نهار السبت عمل', byUnit.get('2026-08-08').find((e) => e.slot === 'work1').title, 'عمل');

// ── آلة حالة القرآن (البذرة الجديدة: ٧ أغسطس — مراجعة جزء ١، حفظ ربع ١ من جزء ١٠) ──
const q = (d) => quranStateFor(d);
check('7/8 البذرة: مراجعة 1 حفظ ربع1', JSON.stringify(q('2026-08-07')), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
check('قبل البذرة = البذرة', JSON.stringify(q('2026-08-06')), JSON.stringify(q('2026-08-07')));
check('8/8 تكرار ربع1', JSON.stringify(q('2026-08-08')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'تكرار' }));
check('12/8 review=6 تكرار ربع3', JSON.stringify(q('2026-08-12')), JSON.stringify({ reviewJuz: 6, hifzJuz: 10, hifzQuarter: 3, hifzMode: 'تكرار' }));
check('14/8 review يلف إلى 1', JSON.stringify(q('2026-08-14')), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 4, hifzMode: 'تكرار' }));
// ٢٢ أغسطس تكرار الربع ٨ ← ٢٣ أغسطس: جزء ١١، والدورة تتسع إلى ٨
check('22/8 تكرار ربع8', JSON.stringify(q('2026-08-22')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 8, hifzMode: 'تكرار' }));
check('23/8 انتقال جزء الحفظ', JSON.stringify(q('2026-08-23')), JSON.stringify({ reviewJuz: 3, hifzJuz: 11, hifzQuarter: 1, hifzMode: 'حفظ' }));
// التثبيت: قبل الانتقال [٨،٩] وبعده [٩،١٠]
const fajr22 = buildUnit('2026-08-22').find((e) => e.slot === 'fajr');
check('تثبيت 22/8 = جزء ٨', fajr22.desc.includes('سنة الفجر — الجزء ٨'), true);
const fajr23 = buildUnit('2026-08-23').find((e) => e.slot === 'fajr');
check('تثبيت 23/8 = جزء ٩', fajr23.desc.includes('سنة الفجر — الجزء ٩'), true);
const isha23 = buildUnit('2026-08-23').find((e) => e.slot === 'isha');
check('عشاء 23/8 على الجزء ١٠', isha23.desc.includes('الجزء ١٠'), true);

// ── تقدّم التمرين عبر الشهر (البداية الجديدة ٧/٨ = يوم التمرين الأول) ──
const trainOn = (d) => byUnit.get(d).find((e) => e.slot === 'train').desc;
check('7/8 بريس 40×6', trainOn('2026-08-07').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('9/8 بريس 40×7', trainOn('2026-08-09').includes('× ٧ عدات @ ٤٠ كجم'), true);
check('15/8 بريس 40×9', trainOn('2026-08-15').includes('× ٩ عدات @ ٤٠ كجم'), true);
check('19/8 بريس 45×6 (زيادة الوزن)', trainOn('2026-08-19').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٥ كجم'), true);
check('27/8 بريس 45×9', trainOn('2026-08-27').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٩ عدات @ ٤٥ كجم'), true);
check('19/8 سحب أفقي 55', trainOn('2026-08-19').includes('السحب الأفقي — ٤ جلسات × ٦ عدات @ ٥٥ كجم'), true);
check('7/8 بلانك 40', trainOn('2026-08-07').includes('بلانك — جلستان × ٤٠ ث'), true);
check('9/8 بلانك 42.5', trainOn('2026-08-09').includes('٤٢٫٥ ث'), true);
check('27/8 بلانك 57.5', trainOn('2026-08-27').includes('٥٧٫٥ ث'), true);
check('7/8 كتف خلفي 10×8', trainOn('2026-08-07').includes('كتف خلفي — ٢ جلسات × ٨ عدات @ ١٠ كجم'), true);
check('19/8 كتف جانبي 12.5×8', trainOn('2026-08-19').includes('كتف جانبي — ٢ جلسات × ٨ عدات @ ١٢٫٥ كجم'), true);

// ── التقدّم المشروط بالإنجاز: اليوم الفائت تُعاد مهمته ولا يتقدم شيء ──
const { setQuranCompletion, clearQuranCache } = await import('../lib/engine/quran.js');
const { setWorkoutCompletion, workoutDesc } = await import('../lib/engine/workout.js');

// فوات ٧ أغسطس كاملًا (يوم البذرة): ٨ أغسطس يعيد نفس الحالة تمامًا
setQuranCompletion((d) => (d === '2026-08-07' ? { review: false, hifz: false } : { review: true, hifz: true }));
check('فوات ٧/٨ → ٨/٨ يعيد نفس المهمة', JSON.stringify(q('2026-08-08')), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
check('ثم ٩/٨ يتقدم طبيعيًا', JSON.stringify(q('2026-08-09')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'تكرار' }));
// إنجاز جزئي: التسميع أُنجز والحفظ فات — يتقدم مسار دون الآخر
setQuranCompletion((d) => (d === '2026-08-07' ? { review: true, hifz: false } : { review: true, hifz: true }));
check('إنجاز التسميع وحده يقدّمه وحده', JSON.stringify(q('2026-08-08')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
setQuranCompletion(null);
clearQuranCache();

// فوات تمرين ٧/٨ (يوم التمرين الأول) كاملًا: ٩/٨ يعرض أهداف ٧/٨ نفسها (بريس ٦ لا ٧)
setWorkoutCompletion((d) => d !== '2026-08-07');
check('فوات يوم١ → يوم٢ بريس ٤٠×٦', workoutDesc('2026-08-09').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
setWorkoutCompletion(null);
check('بعد الاسترجاع: يوم٢ بريس ٤٠×٧', workoutDesc('2026-08-09').includes('× ٧ عدات @ ٤٠ كجم'), true);

// ── تجميد تمرين واحد لا يؤثر في البقية ──
setWorkoutCompletion((d, k) => !(d === '2026-08-07' && k === 'press'));
const d9 = workoutDesc('2026-08-09');
check('البريس وحده تجمّد (٦ عدات)', d9.includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('السحب الأفقي تقدّم رغم ذلك (٧ عدات)', d9.includes('السحب الأفقي — ٤ جلسات × ٧ عدات @ ٥٠ كجم'), true);
setWorkoutCompletion(null);

// ── الخطة المُهيكلة للواجهة التفاعلية ──
const { workoutPlan } = await import('../lib/engine/workout.js');
const plan1 = workoutPlan('2026-08-07');
check('خطة اليوم الأول ٨ بنود', plan1.items.length, 8);
check('أول بند البريس', plan1.items[0].key, 'press');
check('البريس ٤ جلسات', plan1.items[0].sets, 4);
check('السكوات حتى الفشل', plan1.items[3].kind, 'failure');
check('باي+تراي سوبر ست', plan1.items[6].kind, 'superset');
check('السوبر ست طرفان', plan1.items[6].parts.length, 2);
check('البلانك hold', plan1.items[7].kind, 'hold');
check('راحة البريس ١٢٠', plan1.items[0].rest, 120);
const plan2 = workoutPlan('2026-08-09');
check('خطة اليوم الثاني ٩ بنود', plan2.items.length, 9);
check('اليوم الثاني فيه فراشة', plan2.items[1].key, 'fly');
check('اليوم الثاني كتف أمامي فشل', plan2.items.find((i) => i.key === 'frontdelt').kind, 'failure');
check('اليوم الثاني هامر+تراي', plan2.items.find((i) => i.kind === 'superset').key, 'hammer+tri');
check('يوم الجري', workoutPlan('2026-08-11').type, 3);
check('يوم تطوير بلا خطة', workoutPlan('2026-08-08'), null);

// ── مجمعات أخطاء القرآن (متابعة الأخطاء عبر ثلاثة أماكن) ──────────────
const { quranTaskLines, tathbeetPoolKey, reviewPoolKey, hifzPoolKey } = await import('../lib/engine/quran.js');
// يوم حفظ (7/8): بندان فقط، بند الحفظ بلا مجمع أخطاء (لا تتبّع يوم الحفظ نفسه)
const tl7 = quranTaskLines(q('2026-08-07'));
check('يوم حفظ: بندان', tl7.length, 2);
check('يوم حفظ: مجمع التسميع', tl7[0].pool, 'rv:1');
check('يوم حفظ: بند الحفظ بلا مجمع', tl7[1].pool, null);
// يوم تكرار الربع الأول (8/8): بندان، تكرار بمجمعه، بلا مراجعة أرباع سابقة (لا يوجد ربع قبل 1)
const tl8 = quranTaskLines(q('2026-08-08'));
check('تكرار ربع1: بندان (لا مراجعة سابقة)', tl8.length, 2);
check('تكرار ربع1: نص «× ٥ مرات»', tl8[1].text.includes('× ٥ مرات'), true);
check('تكرار ربع1: مجمع hz:10:1', tl8[1].pool, 'hz:10:1');
// يوم تكرار الربع الثامن (22/8): ٩ بنود — تسميع + تكرار + مراجعة الأرباع ١..٧، كل بند بمجمعه الخاص
const tl22 = quranTaskLines(q('2026-08-22'));
check('تكرار ربع8: ٩ بنود (تسميع + تكرار + مراجعة ١..٧)', tl22.length, 9);
check('تكرار ربع8: مجمع الربع الحالي', tl22[1].pool, 'hz:10:8');
check('تكرار ربع8: مجمع مراجعة الربع1', tl22[2].pool, 'hz:10:1');
check('تكرار ربع8: مجمع مراجعة الربع7', tl22[8].pool, 'hz:10:7');
// نفس الربع يحمل نفس المجمع سواء في يوم تكراره أو حين يُراجَع لاحقًا ضمن تكرار ربع أعلى
check('استمرارية المجمع: hz:10:1 من تكرار الربع1 ومن مراجعة تكرار الربع8', hifzPoolKey(10, 1), tl22[2].pool);
// مساعد مفاتيح التثبيت: يطابق الترتيب [فجر،ضحى،ظهرقبلية،ظهربعدية،عصر،مغرب،عشاءقبلية،عشاءبعدية]
const st22 = q('2026-08-22'); // hifzJuz=10 → تثبيت [8,9]
check('تثبيت فجر = tb:8:1', tathbeetPoolKey(st22, 0), 'tb:8:1');
check('تثبيت ضحى = tb:8:2', tathbeetPoolKey(st22, 1), 'tb:8:2');
check('تثبيت عصر = tb:9:1 (يبدأ الجزء الثاني)', tathbeetPoolKey(st22, 4), 'tb:9:1');
check('تثبيت عشاء بعدية = tb:9:4', tathbeetPoolKey(st22, 7), 'tb:9:4');
check('reviewPoolKey/hifzPoolKey تطابق بناء الأسطر', reviewPoolKey(5), 'rv:5');
check('hifzPoolKey', hifzPoolKey(11, 3), 'hz:11:3');

// ── عينة عرض ───────────────────────────────────────────────────────
console.log('\n── وحدة اليوم الجمعة ٣١ يوليو ──');
for (const e of byUnit.get('2026-07-31')) console.log(`${e.start.slice(5)} → ${e.end.slice(11)}  ${e.title}`);
console.log('\n── مواقيت الأسبوع ──');
for (let d = '2026-07-31'; d <= '2026-08-07'; d = addDays(d, 1)) {
  const p = prayerTimes(d);
  console.log(`${d}  فجر ${fmtTime(p.fajr)}  شروق ${fmtTime(p.sunrise)}  ظهر ${fmtTime(p.dhuhr)}  عصر ${fmtTime(p.asr)}  مغرب ${fmtTime(p.maghrib)}  عشاء ${fmtTime(p.isha)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
