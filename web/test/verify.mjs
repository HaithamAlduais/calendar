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
  'rest,sleep1,qiyam,fajr,routine,sleep2,family1,work1,dhuhr,work2,asr,work3,maghrib,family2,isha,family'
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
check('u30 الأسرة الصباحية تنتهي بالهاجِرة', T(bySlot.family1.end), fmtTime(hajira));
check('u30 وجبة ٢ في مهام الهاجِرة', txt(bySlot.work1).includes('وجبة رقم ٢'), true);
check('u30 المهام من الهاجِرة إلى الظهر', `${T(bySlot.work1.start)}-${T(bySlot.work1.end)}`, `${fmtTime(hajira)}-${fmtTime(p30.dhuhr)}`);
check('u30 الأسرة تلي نومَ الصباح', bySlot.family1.start, bySlot.sleep2.end);
// النسبة: المهام ساعتان زمانيتان والزوجة ساعة — لا العكس
ok('u30 المهام ضعفُ الأسرة', dur(bySlot.work1) > 1.8 * dur(bySlot.family1), `${dur(bySlot.work1)} vs ${dur(bySlot.family1)}`);
check('u30 الأسرة الصباحية مقفلة', bySlot.family1.locked, true);

// ٦) الظهر فمهام فالعصر فمهام فالمغرب
check('u30 dhuhr', `${T(bySlot.dhuhr.start)}-${T(bySlot.dhuhr.end)}`, '12:00-12:45');
check('u30 work2 ينتهي بالعصر', T(bySlot.work2.end), '15:26');
check('u30 work3 ينتهي بالمغرب', T(bySlot.work3.end), '18:39');
check('u30 maghrib', `${T(bySlot.maghrib.start)}-${T(bySlot.maghrib.end)}`, '18:39-19:09');

// ٧) زوجة من المغرب إلى العشاء، ثم العشاء، ثم أسرة إلى الفَحْمة
check('u30 أسرة المساء', `${T(bySlot.family2.start)}-${T(bySlot.family2.end)}`, '19:09-20:09');
check('u30 أسرة المساء مقفلة', bySlot.family2.locked, true);
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
  check('الأسرة في كل يوم', a.family1 + '/' + a.family2, 'أسرة/أسرة');
  check('الجمعة: المهام عائلة', a.work1 + '/' + a.work2 + '/' + a.work3, 'عائلة/عائلة/عائلة');
  check('السبت: المهام مهام', b.work1, 'مهام');
}

// ── آلة حالة القرآن: الحزبُ مدارُها ─────────────────────────────────────
// البذرةُ حزبُ ١٩ ربعُ ١ (الجزء ١٠)، فالتثبيتُ أحزابُ ١٥–١٨ والمراجعةُ ١–١٤.
// والحفظُ لا يتقدّم إلا في يوم القرآن — ويومُ التمرين لا يمسّه.
const q = (d) => quranStateFor(d);
const st0 = q(D(0));
check('البذرة: حزب ١٩ ربع ١ حفظ', [st0.hifzHizb, st0.hifzQuarter, st0.hifzMode].join('/'), '19/1/حفظ');
check('البذرة: الجزء يُشتقّ من الحزب', st0.hifzJuz, 10);
check('قبل البذرة = البذرة', JSON.stringify(q(D(-6))), JSON.stringify(st0));

// نافذتا التثبيت والمراجعة
const { tathbeetWindow, reviewMax, reviewHizbs, hizbPages, hizbQuarterPages } = await import('../lib/engine/quran.js');
const tw = tathbeetWindow(st0);
check('التثبيت: الأحزاب ١٥–١٨ (الجزءان ٨ و٩)', tw.from + '–' + tw.to, '15–18');
check('المراجعة تنتهي عند الحزب ١٤ (آخر الجزء ٧)', reviewMax(st0), 14);

// دورةُ الحفظ: يومَ قرآنٍ حفظٌ وتكرار، ثم يومَ قرآنٍ قراءةٌ للأرباع، ثم الربع التالي.
// وأيامُ القرآن يومٌ بعد يوم، فالخطوةُ الواحدة يومان.
const modeAt = (n) => { const x = q(D(n)); return x.hifzHizb + ':' + x.hifzQuarter + ':' + x.hifzMode; };
check('يوم القرآن الأول: حفظ ربع ١', modeAt(0), '19:1:حفظ');
// يومُ التمرين لا خطوةَ فيه: حالتُه هي حالةُ يوم القرآن الذي يليه بعينها
ok('يوم التمرين لا يقدّم الحفظ', modeAt(1) === modeAt(2), modeAt(1) + ' ≠ ' + modeAt(2));
check('يوم القرآن الثاني: قراءة الأرباع', modeAt(2), '19:1:قراءة');
check('يوم القرآن الثالث: حفظ ربع ٢', modeAt(4), '19:2:حفظ');
check('الربع الرابع بعد ست دورات', modeAt(12), '19:4:حفظ');
check('وبعد قراءته ينتقل إلى الحزب ٢٠', modeAt(16), '20:1:حفظ');

// وباكتمال الحزب ٢٠ يدخل الجزء ٨ كاملًا في المراجعة
const stNext = q(D(16));
check('التثبيت بعد الانتقال: ١٦–١٩', tathbeetWindow(stNext).from + '–' + tathbeetWindow(stNext).to, '16–19');
check('ودخل الحزب ١٥ في المراجعة', reviewMax(stNext), 15);

// المراجعة تدور كل ليلة حزبين، ولا تنتظر يوم القرآن
check('المراجعة حزبان كل ليلة', reviewHizbs(q(D(0))).join(','), '1,2');
check('وليلة الغد الحزبان التاليان', reviewHizbs(q(D(1))).join(','), '3,4');
ok('المراجعة تلتفّ إلى أولها', reviewHizbs(q(D(7)))[0] === 1, reviewHizbs(q(D(7))).join(','));

// التثبيت في السنن: نصفُ حزبٍ لكل سنّة، فجزءان في اليوم
const fajr0 = buildUnit(D(0)).find((e) => e.slot === 'fajr');
check('تثبيت الفجر = الحزب ١٥', txt(fajr0).includes('سنة الفجر — الحزب ١٥'), true);
const isha0 = buildUnit(D(0)).find((e) => e.slot === 'isha');
check('تثبيت العشاء = الحزب ١٨ (آخر النافذة)', txt(isha0).includes('الحزب ١٨'), true);

// المراجعة انتقلت إلى الوتر من القيام — ولم تبقَ في الروتين
const qiyam0 = buildUnit(D(0)).find((e) => e.slot === 'qiyam');
ok('المراجعة في وتر القيام', /صلاة الوتر — تسميع المراجعة/.test(txt(qiyam0)), txt(qiyam0).slice(0, 90));
const routine0 = buildUnit(D(0)).find((e) => e.slot === 'routine');
check('ولا مراجعة في الروتين', /تسميع المراجعة/.test(txt(routine0)), false);
check('والروتين يوم القرآن حفظٌ وتكرار', /حفظ الربع ١ من الحزب ١٩/.test(txt(routine0)) && /تكرار الربع ١/.test(txt(routine0)), true);

// ── تقدّم التمرين: قاعدةً لا أرقامًا محفوظة ──
// W(0) أولُ أيام التمرين، وأيامُه كلَّ يومين (يومُ تمرين فيومُ قرآن)
const W = (n) => addDays(HC.workout.start, n);
const { workoutDesc: wd } = await import('../lib/engine/workout.js');

{
  // نقرأ عدّاتِ البريس ووزنَه في أول اثنتي عشرة جلسة
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const line = wd(W(i * 2)).split(String.fromCharCode(10)).find((l) => l.includes('الدفع العلوي'));
    const reps = (line.match(/× ([٠-٩]+) عدات/) || [])[1];
    const kg = (line.match(/@ ([٠-٩٫]+) كجم/) || [])[1];
    seen.push(reps + '@' + kg);
  }
  const A = (x) => String(x).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
  const ex = HC.workout.exercises.press;
  // الجلسة الأولى: أدنى النطاق بوزن البداية
  check('التمرين: أول جلسة أدنى النطاق', seen[0], A(ex.lo) + '@' + A(ex.w0));
  // ثم عدةٌ في كل جلسة حتى أعلى النطاق
  const span = ex.hi - ex.lo; // ٣ خطوات
  check('التمرين: بلوغ أعلى النطاق', seen[span], A(ex.hi) + '@' + A(ex.w0));
  // ثم يزيد الوزن ويعود إلى أدنى النطاق
  check('التمرين: زيادة الوزن بعد أعلى النطاق', seen[span + 1], A(ex.lo) + '@' + A(ex.w0 + ex.inc));
  // ودورةٌ ثانية مثلها
  check('التمرين: الدورة الثانية', seen[2 * (span + 1)], A(ex.lo) + '@' + A(ex.w0 + 2 * ex.inc));
  ok('التمرين: لا تكرار في الجلسات', new Set(seen).size === seen.length, seen.join(' '));
}

// الجريُ في يوم التمرين نفسِه — لا يومًا مستقلًّا
{
  const d = wd(W(0));
  ok('الجري مع الحديد في اليوم نفسه', d.includes('عدو') && d.includes('الدفع العلوي'), d.slice(0, 80));
  check('يومُ القرآن لا تمرين فيه', wd(W(1)), '');
}

// البلانك يزيد ثوانيَه كل جلسة
{
  const sec = (d) => (wd(d).split(String.fromCharCode(10)).find((l) => l.includes('بلانك')) || '');
  ok('بلانك يبدأ ٤٠ ث', sec(W(0)).includes('٤٠ ث'), sec(W(0)));
  ok('وبلانك الجلسة التالية أطول', sec(W(2)).includes('٤٢٫٥ ث'), sec(W(2)));
}

// ── التقدّم المشروط بالإنجاز: اليوم الفائت تُعاد مهمته ولا يتقدم شيء ──
const { setQuranCompletion, clearQuranCache } = await import('../lib/engine/quran.js');
const { setWorkoutCompletion, workoutDesc } = await import('../lib/engine/workout.js');

// فوات يوم البذرة كاملًا: اليوم التالي يعيد نفس الحالة تمامًا
setQuranCompletion((d) => (d === D(0) ? { review: false, hifz: false } : { review: true, hifz: true }));
check('فوات يوم البذرة → المراجعة تعيد موضعها', reviewHizbs(q(D(1))).join(','), '1,2');
check('والحفظ يعيد ربعه', modeAt(2), '19:1:حفظ');
check('ثم يتقدم طبيعيًا بعد إنجازه', modeAt(4), '19:1:قراءة');
// إنجاز جزئي: التسميع أُنجز والحفظ فات — يتقدم مسار دون الآخر
setQuranCompletion((d) => (d === D(0) ? { review: true, hifz: false } : { review: true, hifz: true }));
check('إنجاز المراجعة وحدها يقدّمها وحدها', reviewHizbs(q(D(1))).join(',') + ' | ' + modeAt(2), '3,4 | 19:1:حفظ');
setQuranCompletion(null);
clearQuranCache();

// فوات التمرين الأول كاملًا: يوم التمرين التالي يعرض أهدافه نفسها (بريس ٦ لا ٧)
setWorkoutCompletion((d) => d !== W(0));
check('فوات يوم١ → يوم٢ بريس ٤٠×٦', workoutDesc(W(2)).includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
setWorkoutCompletion(null);
check('بعد الاسترجاع: يوم٢ بريس ٤٠×٧', workoutDesc(W(2)).includes('× ٧ عدات @ ٤٠ كجم'), true);

// ── تجميد تمرين واحد لا يؤثر في البقية ──
setWorkoutCompletion((d, k) => !(d === W(0) && k === 'press'));
const d10 = workoutDesc(W(2));
check('البريس وحده تجمّد (٦ عدات)', d10.includes('الدفع العلوي (بريس مائل) — ٤ جلسات × ٦ عدات @ ٤٠ كجم'), true);
check('السحب الأفقي تقدّم رغم ذلك (٧ عدات)', d10.includes('السحب الأفقي — ٤ جلسات × ٧ عدات @ ٥٠ كجم'), true);
setWorkoutCompletion(null);

// ── الخطة المُهيكلة للواجهة التفاعلية ──
const { workoutPlan } = await import('../lib/engine/workout.js');
const plan1 = workoutPlan(W(0));
check('خطة اليوم الأول ١١ بندًا (حديد + جري)', plan1.items.length, 11);
check('أول بند البريس', plan1.items[0].key, 'press');
check('البريس ٤ جلسات', plan1.items[0].sets, 4);
check('السكوات حتى الفشل', plan1.items[3].kind, 'failure');
check('باي+تراي سوبر ست', plan1.items[6].kind, 'superset');
check('السوبر ست طرفان', plan1.items[6].parts.length, 2);
check('البلانك hold', plan1.items[7].kind, 'hold');
check('راحة البريس ١٢٠', plan1.items[0].rest, 120);
const plan2 = workoutPlan(W(2));
check('خطة اليوم الثاني ١٢ بندًا (حديد + جري)', plan2.items.length, 12);
check('اليوم الثاني فيه فراشة', plan2.items[1].key, 'fly');
check('اليوم الثاني كتف أمامي فشل', plan2.items.find((i) => i.key === 'frontdelt').kind, 'failure');
check('اليوم الثاني هامر+تراي', plan2.items.find((i) => i.kind === 'superset').key, 'hammer+tri');
// الجري صار في يوم التمرين نفسِه، فالدورة نسختان لا ثلاث
check('الدورة نسختان', HC.workout.days.length, 2);
check('اليوم الرابع يعود إلى النسخة الأولى', workoutPlan(W(4)).type, 1);
ok('الجري في كل يوم تمرين', plan1.items.some((i) => i.key === 'sprint') && plan2.items.some((i) => i.key === 'sprint'));
check('يوم القرآن بلا خطة تمرين', workoutPlan(W(1)), null);

// ── مجمعات أخطاء القرآن (متابعة الأخطاء عبر ثلاثة أماكن) ──────────────
const { quranTaskLines, tathbeetPoolKey, reviewPoolKey, hifzPoolKey } = await import('../lib/engine/quran.js');
// يوم حفظ (يوم البذرة): بندان فقط، بند الحفظ بلا مجمع أخطاء (لا تتبّع يوم الحفظ نفسه)
const tlH = quranTaskLines(q(D(0)));
check('يوم الحفظ: بندان — الحفظ ثم تكراره', tlH.map((l) => l.key).join(','), 'hifz,repeat');
check('الحفظ نفسه بلا مجمع', tlH[0].pool, null);
check('التكرار على مجمع الربع', tlH[1].pool, 'hz:h19:1');

// يوم القراءة: بندٌ لكل ربعٍ بلغه الحفظ، ولكلٍّ مجمعُه
const tlR = quranTaskLines(q(D(6))); // حزب ١٩ ربع ٢ قراءة
check('يوم القراءة: ربعان', tlR.map((l) => l.key).join(','), 'read1,read2');
check('قراءة الربع ١ على مجمعه', tlR[0].pool, 'hz:h19:1');
check('قراءة الربع ٢ على مجمعه', tlR[1].pool, 'hz:h19:2');
check('استمرارية المجمع: تكرارُ الربع ١ وقراءتُه موضعٌ واحد', hifzPoolKey(19, 1), tlR[0].pool);

// التثبيت: نصفان لكل حزبٍ من أحزاب النافذة الأربعة
const stT = q(D(0));
check('تثبيت فجر = tb:h15:1', tathbeetPoolKey(stT, 0), 'tb:h15:1');
check('تثبيت ضحى = tb:h15:2', tathbeetPoolKey(stT, 1), 'tb:h15:2');
check('تثبيت عصر = tb:h17:1', tathbeetPoolKey(stT, 4), 'tb:h17:1');
check('تثبيت عشاء بعدية = tb:h18:2', tathbeetPoolKey(stT, 7), 'tb:h18:2');
check('reviewPoolKey بالحزب', reviewPoolKey(5), 'rv:h5');
check('hifzPoolKey بالحزب', hifzPoolKey(19, 3), 'hz:h19:3');

// الأرباع تُغطّي الحزب كلَّه بلا فجوة ولا تداخل
{
  const qs = [1, 2, 3, 4].map((k) => hizbQuarterPages(19, k));
  const whole = hizbPages(19);
  check('الربع الأول يبدأ من أول الحزب', qs[0].s, whole.s);
  check('الربع الرابع ينتهي بآخره', qs[3].e, whole.e);
  ok('لا فجوة بين الأرباع', qs.every((r, i) => i === 0 || r.s <= qs[i - 1].e + 1), JSON.stringify(qs));
}

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
