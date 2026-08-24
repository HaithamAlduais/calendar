// تحقّق من مرونة المحرّك: بداية اليوم على أيّ بلوك أو أيّ ساعة، ومدد الصلاة،
// وبلوكات المهام المستقاة من البيانات. هذه القدرات هي ما يجعل البرنامج لغيره
// لا لصاحبه وحده، فلها فحصٌ قائم بنفسه لا يختلط بفحص جدوله.
import { buildDay, rotateTemplate, startCandidates, isMonotone, isAbsolute } from '../lib/engine/layout.js';
import { DEFAULT_TEMPLATES, taskSlots } from '../lib/engine/schedule.js';
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

const WD = DEFAULT_TEMPLATES.weekday;
const FR = DEFAULT_TEMPLATES.friday;
const noItems = () => [];
const T = (s) => s.slice(11, 16);
const build = (d, tpl) => buildDay(d, tpl, noItems);
// أيامٌ من أطراف السنة: الانقلابان يمدّان الليل ويقصرانه فيكشفان ما لا يكشفه المعتدل
const SAMPLE = ['2026-01-15', '2026-03-20', '2026-06-21', '2026-09-23', '2026-12-21'];

// ── ١. القالب كما كُتب: متلاصق وصاعد ──────────────────────────────
function assertSound(label, tpl) {
  for (const d of SAMPLE) {
    const evs = build(d, tpl);
    ok(`${label} ${d}: صاعد`, isMonotone(d, tpl));
    for (let i = 1; i < evs.length; i++)
      ok(
        `${label} ${d}: لا فجوة عند ${evs[i].slot}`,
        evs[i].start === evs[i - 1].end,
        `${evs[i - 1].end} ≠ ${evs[i].start}`
      );
    const span = (new Date(evs.at(-1).end) - new Date(evs[0].start)) / 60000;
    ok(`${label} ${d}: الوحدة ≈ يوم`, span > 1380 && span < 1500, `= ${Math.round(span)} د`);
  }
}
assertSound('أيام العمل', WD);
assertSound('الجمعة', FR);

// ── ٢. اليوم حلقة: كل بداية مرشّحة تُنتج يومًا سليمًا ──────────────
const cands = startCandidates(WD);
ok('مرشّحو البداية أكثر من واحد', cands.length >= 6, `= ${cands.length}`);
ok(
  'الفجر والمغرب والنوم من المرشّحين',
  ['fajr', 'maghrib', 'sleep2'].every((id) => cands.some((c) => c.id === id))
);
for (const c of cands) assertSound(`بداية عند «${c.title}» (${c.id})`, rotateTemplate(WD, { blockId: c.id }));

// ── ٣. الدوران يحفظ البلوكات ولا يزيد ولا ينقص ────────────────────
for (const c of cands) {
  const rot = rotateTemplate(WD, { blockId: c.id });
  check(`«${c.id}»: عدد البلوكات`, rot.blocks.length, WD.blocks.length);
  check(`«${c.id}»: أوّل بلوك`, rot.blocks[0].id, c.id);
  check(
    `«${c.id}»: المجموعة نفسها`,
    rot.blocks
      .map((b) => b.id)
      .sort()
      .join(),
    WD.blocks
      .map((b) => b.id)
      .sort()
      .join()
  );
}

// ── ٤. البداية عند الفجر: اليوم من فجرٍ إلى فجر ───────────────────
const atFajr = rotateTemplate(WD, { blockId: 'fajr' });
check('بداية الفجر: أوّل بلوك', atFajr.blocks[0].id, 'fajr');
check('بداية الفجر: آخر بلوك', atFajr.blocks.at(-1).id, 'sleep2');
ok('بداية الفجر: آخر بلوك ينتهي بفجر الغد', atFajr.blocks.at(-1).end.next === true);
{
  const evs = build('2026-06-21', atFajr);
  const nextDayFajr = build('2026-06-22', atFajr)[0].start;
  check('بداية الفجر: تنتهي الوحدة بفجر الغد', evs.at(-1).end, nextDayFajr);
}

// ── ٥. البداية عند المغرب: ليلُه من ليلته ونهارُه من غده ──────────
const atMaghrib = rotateTemplate(WD, { blockId: 'maghrib' });
check('بداية المغرب: أوّل بلوك', atMaghrib.blocks[0].id, 'maghrib');
check('بداية المغرب: آخر بلوك', atMaghrib.blocks.at(-1).id, 'work3');
{
  const evs = build('2026-09-23', atMaghrib);
  const bySlot = Object.fromEntries(evs.map((e) => [e.slot, e]));
  // بلوكات النهار انتقلت إلى الغد فتاريخُها تاريخُه
  check('بداية المغرب: المغرب اليوم', bySlot.maghrib.start.slice(0, 10), '2026-09-23');
  check('بداية المغرب: الفجر غدًا', bySlot.fajr.start.slice(0, 10), '2026-09-24');
  check('بداية المغرب: الظهر غدًا', bySlot.dhuhr.start.slice(0, 10), '2026-09-24');
  ok('بداية المغرب: العصر بعد الظهر', bySlot.asr.start > bySlot.dhuhr.end);
}

// ── ٦. بداية بساعة ثابتة ──────────────────────────────────────────
{
  const at3 = rotateTemplate(WD, { blockId: 'sleep2', anchor: { clock: 180 } });
  const evs = build('2026-06-21', at3);
  check('الساعة ٣:٠٠: بداية الوحدة', T(evs[0].start), '03:00');
  ok('الساعة ٣:٠٠: يومٌ سليم', isMonotone('2026-06-21', at3));
  // ساعةٌ متأخرة تقلب اليوم، فيردّها الفحص لا الواجهة وحدها
  const at9 = rotateTemplate(WD, { blockId: 'sleep2', anchor: { clock: 540 } });
  ok('٩:٠٠ ص بداية غير صالحة تُكشف', !isMonotone('2026-06-21', at9));
}

// ── ٧. مدد الصلاة: صورتان، والإزاحة عن الصلاة نفسِها هي المدة ─────
{
  const dur = (tpl, id) => {
    const evs = build('2026-09-23', tpl);
    const e = evs.find((x) => x.slot === id);
    return (new Date(e.end) - new Date(e.start)) / 60000;
  };
  check('مدة الفجر', dur(WD, 'fajr'), 45);
  check('مدة العصر', dur(WD, 'asr'), 45);
  check('مدة المغرب', dur(WD, 'maghrib'), 30);
  check('مدة الظهر', dur(WD, 'dhuhr'), 45);
  // الجمعة: البلوك يبدأ قبل الأذان بساعة فيسع الخطبة — والمدة نفسها بعده
  check('مدة الجمعة = الظهر + ساعة', dur(FR, 'dhuhr'), 105);
  const dhuhrWd = WD.blocks.find((b) => b.id === 'dhuhr');
  check('بلوك الظهر مرساتُه نفسُه', dhuhrWd.end.prayer, 'dhuhr');
  check('وإزاحتُه هي مدتُه', dhuhrWd.end.offset, 45);
  // ولذلك: تغييرُ المدة إلى ٢٠ يجب أن يمسّ الإزاحة لا الطول
  const short = {
    ...WD,
    blocks: WD.blocks.map((b) => (b.id === 'dhuhr' ? { ...b, end: { ...b.end, offset: 20 } } : b)),
  };
  check('الظهر ٢٠ د بعد التعديل', dur(short, 'dhuhr'), 20);
  const shortFri = {
    ...FR,
    blocks: FR.blocks.map((b) => (b.id === 'dhuhr' ? { ...b, end: { ...b.end, offset: 20 } } : b)),
  };
  check('والجمعة تبقى أطول بساعة', dur(shortFri, 'dhuhr'), 80);
}

// ── ٨. بلوكات المهام من البيانات ──────────────────────────────────
{
  const slots = taskSlots();
  check('بلوكات المهام', slots.join(), 'quran,work1,work2,work3,family,rest');
  ok('النوم ليس بلوك مهام', !slots.includes('sleep1') && !slots.includes('nap'));
  ok('الصلوات ليست بلوكات مهام', !slots.some((s) => ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(s)));
  // بلوكٌ جديد يُعلَّم task فيصير مستقبِلًا بلا تعديل سطر
  const extra = { ...WD, blocks: [...WD.blocks, { id: 'x', title: 'ت', colorId: 6, task: true, end: { len: 1 } }] };
  ok('البلوك الجديد يُعدّ بلوك مهام', extra.blocks.filter((b) => b.task).length === 7);
}

// ── ٩. المراسي المطلقة تُعرف ──────────────────────────────────────
check('الصلاة مطلقة', isAbsolute({ prayer: 'fajr' }), 'true');
check('ثلث الليل مطلق', isAbsolute({ nightFraction: 1 }), 'true');
check('الساعة مطلقة', isAbsolute({ clock: 0 }), 'true');
check('الطول ليس مطلقًا', isAbsolute({ len: 45 }), 'false');
check('التوازن ليس مطلقًا', isAbsolute({ balance: {} }), 'false');

// ── ١٠. الدوران لا يمسّ القالب الأصل ──────────────────────────────
{
  const before = JSON.stringify(WD);
  rotateTemplate(WD, { blockId: 'maghrib' });
  rotateTemplate(WD, { blockId: 'fajr', anchor: { clock: 60 } });
  check('القالب الأصل لم يتغيّر', JSON.stringify(WD), before);
  ok('إلغاء الاختيار يرجع بالقالب', rotateTemplate(WD, null) === WD);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
