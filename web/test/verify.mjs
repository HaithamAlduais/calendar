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
check('u30 زوجة (المغرب←العشاء)', `${T(bySlot.sleep1.start)}-${T(bySlot.sleep1.end)}`, '19:09-20:09');
check('u30 اسم بلوك المغرب←العشاء', bySlot.sleep1.title, 'زوجة');
check('u30 isha', `${T(bySlot.isha.start)}-${T(bySlot.isha.end)}`, '20:09-20:54');
check('u30 family end (ثلث أول)', T(bySlot.family.end), '21:44');
check('u30 راحة حتى السدس الأخير', `${T(bySlot.rest.start)}-${T(bySlot.rest.end)}`, '21:44-02:22');
check('u30 قيام: السدس الأخير حتى الفجر', `${T(bySlot.qiyam.start)}-${T(bySlot.qiyam.end)}`, '02:22-03:54');
check('u30 سحور داخل القيام', bySlot.qiyam.desc.includes('سحور'), true);
check('u30 لا يوجد بلوك نوم ثانٍ', !!bySlot.sleep2, false);
check('u30 fajr أول الوحدة', `${T(bySlot.fajr.start)}-${T(bySlot.fajr.end)}`, '03:54-04:39');
check('u30 يبدأ بالفجر', u30[0].slot, 'fajr');
check('u30 ينتهي بالقيام حتى فجر الغد', u30[u30.length - 1].slot, 'qiyam');
check('u30 quran', `${T(bySlot.quran.start)}-${T(bySlot.quran.end)}`, '04:39-05:35');
check('u30 train', `${T(bySlot.train.start)}-${T(bySlot.train.end)}`, '05:35-06:50');
check('u30 راحة الصباح بعد التمرين', `${T(bySlot.nap.start)}-${T(bySlot.nap.end)}`, '06:50-09:20');
check('u30 work1', `${T(bySlot.work1.start)}-${T(bySlot.work1.end)}`, '09:20-12:00');
check('u30 dhuhr', `${T(bySlot.dhuhr.start)}-${T(bySlot.dhuhr.end)}`, '12:00-12:45');
check('u30 work2 end (عصر)', T(bySlot.work2.end), '15:26');
check('u30 work3 end (مغرب)', T(bySlot.work3.end), '18:39');
check('u30 count', u30.length, 15);
check('u30 rest name = راحة دائمًا', bySlot.rest.title, 'راحة');
check('u30 راحة الصباح اسمها راحة', bySlot.nap.title, 'راحة');

// ── صفر فجوات وصفر تداخل عبر النطاق كاملًا + تلاصق الوحدات ─────────
const all = buildRange('2026-07-31', '2026-08-29');
let gapless = true;
const byUnit = new Map();
for (const e of all) {
  if (!byUnit.has(e.unit)) byUnit.set(e.unit, []);
  byUnit.get(e.unit).push(e);
}
let prevUnitEnd = null;
for (let d = '2026-07-31'; d <= '2026-08-29'; d = addDays(d, 1)) {
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
  check(`count ${d}`, evs.length, 15); // ١٥ حدثًا كل يوم (الجمعة دمجت الدعاء في «أسرة ودعاء»)
  for (const e of evs) {
    if (e.end <= e.start) { gapless = false; console.log(`NEGATIVE ${d} ${e.slot}`); }
  }
}
check('gapless+contiguous 31/7→29/8', gapless, true);

// «راحة» اسم واحد طوال الأسبوع (زالت أصدقاء ونوم)، و«زوجة» من المغرب إلى العشاء كل يوم
for (const d of ['2026-07-31', '2026-08-01', '2026-08-02']) {
  check(`rest ${d} = راحة`, byUnit.get(d).find((e) => e.slot === 'rest').title, 'راحة');
  check(`sleep1 ${d} = زوجة`, byUnit.get(d).find((e) => e.slot === 'sleep1').title, 'زوجة');
  check(`nap ${d} = راحة`, byUnit.get(d).find((e) => e.slot === 'nap').title, 'راحة');
}
// دورة التمرين متتابعة لا علاقة لها بأيام الأسبوع، تبدأ السبت ٨/٨ (يوم التمرين الأول):
// تمرين/تطوير بالتناوب والأنواع تدور أ←ب←جري
check('9/8 تمرين أ (بداية الدورة)', byUnit.get('2026-08-09').find((e) => e.slot === 'train').title, 'تمرين — اليوم الأول');
check('10/8 تطوير', byUnit.get('2026-08-10').find((e) => e.slot === 'train').title, 'تطوير');
check('11/8 تمرين ب', byUnit.get('2026-08-11').find((e) => e.slot === 'train').title, 'تمرين — اليوم الثاني');
check('13/8 جري', byUnit.get('2026-08-13').find((e) => e.slot === 'train').title, 'تمرين — اليوم الثالث (جري)');
check('14/8 تطوير', byUnit.get('2026-08-14').find((e) => e.slot === 'train').title, 'تطوير');
check('15/8 (جمعة!) تمرين أ — الدورة تتجاهل الأسبوع', byUnit.get('2026-08-15').find((e) => e.slot === 'train').title, 'تمرين — اليوم الأول');
check('قبل البداية تطوير', byUnit.get('2026-08-08').find((e) => e.slot === 'train').title, 'تطوير');
// فحوص مرتبطة بأيام الأسبوع نفسها (لا بالبذرة): ١٤/٨ جمعة، ١٥/٨ سبت، ١٦/٨ أحد
const fri = (s) => byUnit.get('2026-08-14').find((e) => e.slot === s);
const sat = (s) => byUnit.get('2026-08-15').find((e) => e.slot === s);
const sun = (s) => byUnit.get('2026-08-16').find((e) => e.slot === s);
check('لا بلوك دعاء منفصل', !!fri('duaa'), false);
check('الجمعة بعد العصر: أسرة ودعاء', fri('work3').title, 'أسرة ودعاء');
check('وصف الجمعة فيه ساعة الاستجابة', fri('work3').desc.includes('ساعة استجابة الدعاء'), true);
check('الجمعة يمتد إلى المغرب', fri('work3').end, fri('maghrib').start);
check('نهار الجمعة الأول أسرة', fri('work1').title, 'أسرة');
check('نهار الجمعة الأوسط أسرة وزوجة', fri('work2').title, 'أسرة وزوجة');
check('نهار السبت الأول أسرة', sat('work1').title, 'أسرة');
check('نهار السبت الأوسط أسرة وزوجة', sat('work2').title, 'أسرة وزوجة');
check('نهار السبت بعد العصر أسرة وزوجة', sat('work3').title, 'أسرة وزوجة');
check('نهار الأحد عمل', sun('work1').title, 'عمل');
check('الأحد بعد العصر عمل', sun('work3').title, 'عمل');
check('صلة رحم في أسرة الجمعة', fri('work1').desc.includes('صلة رحم'), true);
check('لا صلة رحم في أسرة السبت', sat('work1').desc.includes('صلة رحم'), false);
check('راحة الصباح نفسها في الجمعة والسبت', [fri('nap').title, sat('nap').title].join('|'), 'راحة|راحة');

// ── آلة حالة القرآن (البذرة الجديدة: ٨ أغسطس — مراجعة جزء ١، حفظ ربع ١ من جزء ١٠) ──
const q = (d) => quranStateFor(d);
check('9/8 البذرة: مراجعة 1 حفظ ربع1', JSON.stringify(q('2026-08-09')), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
check('قبل البذرة = البذرة', JSON.stringify(q('2026-08-08')), JSON.stringify(q('2026-08-09')));
check('10/8 تكرار ربع1', JSON.stringify(q('2026-08-10')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'تكرار' }));
check('14/8 review=6 تكرار ربع3', JSON.stringify(q('2026-08-14')), JSON.stringify({ reviewJuz: 6, hifzJuz: 10, hifzQuarter: 3, hifzMode: 'تكرار' }));
check('16/8 review يلف إلى 1', JSON.stringify(q('2026-08-16')), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 4, hifzMode: 'تكرار' }));
// ٢٣ أغسطس تكرار الربع ٨ ← ٢٤ أغسطس: جزء ١١، والدورة تتسع إلى ٨
check('24/8 تكرار ربع8', JSON.stringify(q('2026-08-24')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 8, hifzMode: 'تكرار' }));
check('25/8 انتقال جزء الحفظ', JSON.stringify(q('2026-08-25')), JSON.stringify({ reviewJuz: 3, hifzJuz: 11, hifzQuarter: 1, hifzMode: 'حفظ' }));
// التثبيت: قبل الانتقال [٨،٩] وبعده [٩،١٠]
const fajr23 = buildUnit('2026-08-24').find((e) => e.slot === 'fajr');
check('تثبيت 24/8 = جزء ٨', fajr23.desc.includes('سنة الفجر — الجزء ٨'), true);
const fajr24 = buildUnit('2026-08-25').find((e) => e.slot === 'fajr');
check('تثبيت 25/8 = جزء ٩', fajr24.desc.includes('سنة الفجر — الجزء ٩'), true);
const isha24 = buildUnit('2026-08-25').find((e) => e.slot === 'isha');
check('عشاء 25/8 على الجزء ١٠', isha24.desc.includes('الجزء ١٠'), true);

// ── تقدّم التمرين عبر الشهر (البداية الجديدة ٨/٨ = يوم التمرين الأول) ──
const trainOn = (d) => byUnit.get(d).find((e) => e.slot === 'train').desc;
check('9/8 بريس 40×6', trainOn('2026-08-09').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('11/8 بريس 40×7', trainOn('2026-08-11').includes('× ٧ عدات @ ٤٠ كجم'), true);
check('17/8 بريس 40×9', trainOn('2026-08-17').includes('× ٩ عدات @ ٤٠ كجم'), true);
check('21/8 بريس 45×6 (زيادة الوزن)', trainOn('2026-08-21').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٥ كجم'), true);
check('29/8 بريس 45×9', trainOn('2026-08-29').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٩ عدات @ ٤٥ كجم'), true);
check('21/8 سحب أفقي 55', trainOn('2026-08-21').includes('السحب الأفقي — ٤ جلسات × ٦ عدات @ ٥٥ كجم'), true);
check('9/8 بلانك 40', trainOn('2026-08-09').includes('بلانك — جلستان × ٤٠ ث'), true);
check('11/8 بلانك 42.5', trainOn('2026-08-11').includes('٤٢٫٥ ث'), true);
check('29/8 بلانك 57.5', trainOn('2026-08-29').includes('٥٧٫٥ ث'), true);
check('9/8 كتف خلفي 10×8', trainOn('2026-08-09').includes('كتف خلفي — ٢ جلسات × ٨ عدات @ ١٠ كجم'), true);
check('21/8 كتف جانبي 12.5×8', trainOn('2026-08-21').includes('كتف جانبي — ٢ جلسات × ٨ عدات @ ١٢٫٥ كجم'), true);

// ── التقدّم المشروط بالإنجاز: اليوم الفائت تُعاد مهمته ولا يتقدم شيء ──
const { setQuranCompletion, clearQuranCache } = await import('../lib/engine/quran.js');
const { setWorkoutCompletion, workoutDesc } = await import('../lib/engine/workout.js');

// فوات ٨ أغسطس كاملًا (يوم البذرة): ٩ أغسطس يعيد نفس الحالة تمامًا
setQuranCompletion((d) => (d === '2026-08-09' ? { review: false, hifz: false } : { review: true, hifz: true }));
check('فوات ٨/٨ → ٩/٨ يعيد نفس المهمة', JSON.stringify(q('2026-08-10')), JSON.stringify({ reviewJuz: 1, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
check('ثم ١٠/٨ يتقدم طبيعيًا', JSON.stringify(q('2026-08-11')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'تكرار' }));
// إنجاز جزئي: التسميع أُنجز والحفظ فات — يتقدم مسار دون الآخر
setQuranCompletion((d) => (d === '2026-08-09' ? { review: true, hifz: false } : { review: true, hifz: true }));
check('إنجاز التسميع وحده يقدّمه وحده', JSON.stringify(q('2026-08-10')), JSON.stringify({ reviewJuz: 2, hifzJuz: 10, hifzQuarter: 1, hifzMode: 'حفظ' }));
setQuranCompletion(null);
clearQuranCache();

// فوات تمرين ٨/٨ (يوم التمرين الأول) كاملًا: ١٠/٨ يعرض أهداف ٨/٨ نفسها (بريس ٦ لا ٧)
setWorkoutCompletion((d) => d !== '2026-08-09');
check('فوات يوم١ → يوم٢ بريس ٤٠×٦', workoutDesc('2026-08-11').includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
setWorkoutCompletion(null);
check('بعد الاسترجاع: يوم٢ بريس ٤٠×٧', workoutDesc('2026-08-11').includes('× ٧ عدات @ ٤٠ كجم'), true);

// ── تجميد تمرين واحد لا يؤثر في البقية ──
setWorkoutCompletion((d, k) => !(d === '2026-08-09' && k === 'press'));
const d10 = workoutDesc('2026-08-11');
check('البريس وحده تجمّد (٦ عدات)', d10.includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('السحب الأفقي تقدّم رغم ذلك (٧ عدات)', d10.includes('السحب الأفقي — ٤ جلسات × ٧ عدات @ ٥٠ كجم'), true);
setWorkoutCompletion(null);

// ── الخطة المُهيكلة للواجهة التفاعلية ──
const { workoutPlan } = await import('../lib/engine/workout.js');
const plan1 = workoutPlan('2026-08-09');
check('خطة اليوم الأول ٨ بنود', plan1.items.length, 8);
check('أول بند البريس', plan1.items[0].key, 'press');
check('البريس ٤ جلسات', plan1.items[0].sets, 4);
check('السكوات حتى الفشل', plan1.items[3].kind, 'failure');
check('باي+تراي سوبر ست', plan1.items[6].kind, 'superset');
check('السوبر ست طرفان', plan1.items[6].parts.length, 2);
check('البلانك hold', plan1.items[7].kind, 'hold');
check('راحة البريس ١٢٠', plan1.items[0].rest, 120);
const plan2 = workoutPlan('2026-08-11');
check('خطة اليوم الثاني ٩ بنود', plan2.items.length, 9);
check('اليوم الثاني فيه فراشة', plan2.items[1].key, 'fly');
check('اليوم الثاني كتف أمامي فشل', plan2.items.find((i) => i.key === 'frontdelt').kind, 'failure');
check('اليوم الثاني هامر+تراي', plan2.items.find((i) => i.kind === 'superset').key, 'hammer+tri');
check('يوم الجري', workoutPlan('2026-08-13').type, 3);
check('يوم تطوير بلا خطة', workoutPlan('2026-08-10'), null);

// ── مجمعات أخطاء القرآن (متابعة الأخطاء عبر ثلاثة أماكن) ──────────────
const { quranTaskLines, tathbeetPoolKey, reviewPoolKey, hifzPoolKey } = await import('../lib/engine/quran.js');
// يوم حفظ (9/8): بندان فقط، بند الحفظ بلا مجمع أخطاء (لا تتبّع يوم الحفظ نفسه)
const tlH = quranTaskLines(q('2026-08-09'));
check('يوم حفظ: بندان', tlH.length, 2);
check('يوم حفظ: مجمع التسميع', tlH[0].pool, 'rv:1');
check('يوم حفظ: بند الحفظ بلا مجمع', tlH[1].pool, null);
// يوم تكرار الربع الأول (10/8): بندان، تكرار بمجمعه، بلا مراجعة أرباع سابقة (لا يوجد ربع قبل 1)
const tlR1 = quranTaskLines(q('2026-08-10'));
check('تكرار ربع1: بندان (لا مراجعة سابقة)', tlR1.length, 2);
check('تكرار ربع1: نص «× ٥ مرات»', tlR1[1].text.includes('× ٥ مرات'), true);
check('تكرار ربع1: مجمع hz:10:1', tlR1[1].pool, 'hz:10:1');
// يوم تكرار الربع الثامن (24/8): ٩ بنود — تسميع + تكرار + مراجعة الأرباع ١..٧، كل بند بمجمعه الخاص
const tlR8 = quranTaskLines(q('2026-08-24'));
check('تكرار ربع8: ٩ بنود (تسميع + تكرار + مراجعة ١..٧)', tlR8.length, 9);
check('تكرار ربع8: مجمع الربع الحالي', tlR8[1].pool, 'hz:10:8');
check('تكرار ربع8: مجمع مراجعة الربع1', tlR8[2].pool, 'hz:10:1');
check('تكرار ربع8: مجمع مراجعة الربع7', tlR8[8].pool, 'hz:10:7');
// نفس الربع يحمل نفس المجمع سواء في يوم تكراره أو حين يُراجَع لاحقًا ضمن تكرار ربع أعلى
check('استمرارية المجمع: hz:10:1 من تكرار الربع1 ومن مراجعة تكرار الربع8', hifzPoolKey(10, 1), tlR8[2].pool);
// مساعد مفاتيح التثبيت: يطابق الترتيب [فجر،ضحى،ظهرقبلية،ظهربعدية،عصر،مغرب،عشاءقبلية،عشاءبعدية]
const stR8 = q('2026-08-24'); // hifzJuz=10 → تثبيت [8,9]
check('تثبيت فجر = tb:8:1', tathbeetPoolKey(stR8, 0), 'tb:8:1');
check('تثبيت ضحى = tb:8:2', tathbeetPoolKey(stR8, 1), 'tb:8:2');
check('تثبيت عصر = tb:9:1 (يبدأ الجزء الثاني)', tathbeetPoolKey(stR8, 4), 'tb:9:1');
check('تثبيت عشاء بعدية = tb:9:4', tathbeetPoolKey(stR8, 7), 'tb:9:4');
check('reviewPoolKey/hifzPoolKey تطابق بناء الأسطر', reviewPoolKey(5), 'rv:5');
check('hifzPoolKey', hifzPoolKey(11, 3), 'hz:11:3');

// ── بين الأذان والإقامة: شعر في كل الصلوات، وسورة الكهف في صلاة الجمعة (٧ أغسطس) ──
const u7 = buildUnit('2026-08-14'); // جمعة
const u8 = buildUnit('2026-08-15'); // سبت
const dl = (u, slot) => u.find((e) => e.slot === slot).desc.split('\n');
check('فجر: شعر في السطر ٣', dl(u7, 'fajr')[2], '٣. بين الأذان والإقامة: كتابة شعر');
check('فجر: سنة الفجر بقيت في السطر ٢ (فهرس 1)', dl(u7, 'fajr')[1].startsWith('٢. سنة الفجر'), true);
check('ظهر الجمعة: سورة الكهف', dl(u7, 'dhuhr')[2], '٣. بين الأذان والإقامة: قراءة سورة الكهف');
check('ظهر الجمعة: صلاة الجمعة', dl(u7, 'dhuhr')[3], '٤. صلاة الجمعة');
check('ظهر السبت: شعر لا كهف', dl(u8, 'dhuhr')[2], '٣. بين الأذان والإقامة: كتابة شعر');
check('ظهر السبت: صلاة الظهر', dl(u8, 'dhuhr')[3], '٤. صلاة الظهر');
check('ظهر: البعدية في الفهرس 5 (خريطة المجمعات)', dl(u8, 'dhuhr')[5].startsWith('٦. سنة الظهر البعدية'), true);
check('عصر: شعر في السطر ٣', dl(u8, 'asr')[2], '٣. بين الأذان والإقامة: كتابة شعر');
check('عصر: سنة العصر في الفهرس 1', dl(u8, 'asr')[1].startsWith('٢. سنة العصر'), true);
check('مغرب: شعر بعد الترديد مباشرة (لا قبلية)', dl(u8, 'maghrib')[1], '٢. بين الأذان والإقامة: كتابة شعر');
check('مغرب: سنة المغرب في الفهرس 6 (خريطة المجمعات)', dl(u8, 'maghrib')[6].startsWith('٧. سنة المغرب'), true);
check('عشاء: شعر في السطر ٣', dl(u8, 'isha')[2], '٣. بين الأذان والإقامة: كتابة شعر');
check('عشاء: البعدية في الفهرس 5 (خريطة المجمعات)', dl(u8, 'isha')[5].startsWith('٦. سنة العشاء البعدية'), true);
check('الكهف مرة واحدة أسبوعيًا: لا كهف في فجر الجمعة', dl(u7, 'fajr')[2].includes('الكهف'), false);

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
