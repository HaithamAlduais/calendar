// فحص إشعارات الخادم — المنطق المحض في supabase/functions/_shared/notify.js
//
// الخلل الذي يحرسه هذا الفحص: كانت الدالة تحمل جدول صاحب البرنامج مثبَّتًا،
// فيتلقّى كلُّ مشترك إشعارات رجلٍ آخر في مدينةٍ أخرى. فههنا نبني مشتركَين
// مختلفَي الموقع والقالب، ونثبت أن لكلٍّ أوقاتَه ولا يتقاطعان.
import { blocksAround, duePayloads, toUnixMin, fmt12, FALLBACK } from '../../supabase/functions/_shared/notify.js';
import { DEFAULT_TEMPLATES, DEFAULT_WEEK_PLAN } from '../lib/engine/schedule.js';

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

// لحظةٌ ثابتة كي لا يتعلّق الفحص بساعة تشغيله
const NOW = Date.UTC(2026, 8, 23, 9, 0); // ٢٣ سبتمبر ٢٠٢٦، ١٢:٠٠ ظهرًا بالرياض
const nowMin = Math.floor(NOW / 60000);

const riyadh = {
  ...FALLBACK,
  lat: 24.7136,
  lng: 46.6753,
  tz: 3,
  method: 'ummAlQura',
  templates: DEFAULT_TEMPLATES,
  weekPlan: DEFAULT_WEEK_PLAN,
};
// مشترك آخر: القاهرة، طريقة مصرية، وقالبٌ واحد لكل الأسبوع يبدأ يومه بالمغرب
const cairoTpl = { day: DEFAULT_TEMPLATES.weekday };
const cairo = {
  ...FALLBACK,
  lat: 30.0444,
  lng: 31.2357,
  tz: 2,
  method: 'egypt',
  templates: cairoTpl,
  weekPlan: ['day', 'day', 'day', 'day', 'day', 'day', 'day'],
  dayStart: { blockId: 'maghrib' },
};

// ── ١. لكلٍّ بلوكاته، ولا يتشابه وقتاهما ─────────────────────────
const bR = blocksAround(riyadh, NOW);
const bC = blocksAround(cairo, NOW);
ok('الرياض: بلوكات', bR.length >= 40, `= ${bR.length}`);
ok('القاهرة: بلوكات', bC.length >= 40, `= ${bC.length}`);

const fajrR = bR.find((b) => b.title === 'الفجر');
const fajrC = bC.find((b) => b.title === 'الفجر');
ok('لكلٍّ فجرُه', fajrR.minute !== fajrC.minute, `${fajrR.minute} = ${fajrC.minute}`);
// القاهرة غربَ الرياض وبفارق توقيت ساعة، فيتأخر فجرها بالتوقيت العالمي
ok('فجر القاهرة بعد فجر الرياض عالميًّا', fajrC.minute > fajrR.minute);

// ── ٢. الإعداد يُغيّر الإشعار فعلًا ──────────────────────────────
{
  // نجد بلوكًا للرياض ونتحقق أن الإشعار يخرج في دقيقته لا في غيرها
  const b = bR.find((x) => x.minute > nowMin);
  check('إشعار عند البدء', duePayloads(riyadh, b.minute, NOW).some((p) => p.tag === `s${b.minute}`), true);
  check('وتنبيه قبله بثلاثين', duePayloads(riyadh, b.minute - 30, NOW).some((p) => p.tag === `p${b.minute}`), true);
  check('ولا شيء في دقيقة بينهما', duePayloads(riyadh, b.minute - 7, NOW).length, 0);
}

// ── ٣. تغيير مدة الصلاة يُزيح الإشعار ────────────────────────────
{
  const shifted = {
    ...riyadh,
    templates: {
      ...DEFAULT_TEMPLATES,
      weekday: {
        ...DEFAULT_TEMPLATES.weekday,
        blocks: DEFAULT_TEMPLATES.weekday.blocks.map((b) =>
          b.id === 'fajr' ? { ...b, end: { len: 20 } } : b
        ),
      },
    },
  };
  const after = (s) => blocksAround(s, NOW).filter((x) => x.title === 'مهام').map((x) => x.minute);
  const a = after(riyadh);
  const c = after(shifted);
  ok('فجرٌ أقصر ← بلوك المهام يبدأ أبكر', c.some((m, i) => m < a[i]), `${a[0]} → ${c[0]}`);
}

// ── ٤. من دار يومه على المغرب اختلف ترتيب بلوكاته ────────────────
{
  // أوّل الوحدات المبنيّة يفتتحه المغرب — فالبلوك الأسبق زمنًا هو مغربُه
  const first = [...bC].sort((a, b) => a.minute - b.minute)[0];
  ok('يوم القاهرة يفتتحه المغرب', first.title === 'المغرب', `= ${first.title}`);
  // وأمّا الرياض فيفتتحه النوم، فالفرق في البداية لا في المواقيت وحدها
  const firstR = [...bR].sort((a, b) => a.minute - b.minute)[0];
  ok('ويوم الرياض يفتتحه النوم', firstR.title === 'نوم', `= ${firstR.title}`);
}

// ── ٥. المشترك بلا إعدادات لا يُرسَل إليه شيء ────────────────────
check('بلا حساب ← لا بلوكات', blocksAround(FALLBACK, NOW).length, 0);
check('بلا حساب ← لا إشعارات', duePayloads(FALLBACK, nowMin, NOW).length, 0);

// ── ٦. تحويل الوقت وصياغته ───────────────────────────────────────
check('دقائق يونكس بتوقيت ٣', toUnixMin('2026-09-23T12:00', 3), Math.floor(Date.UTC(2026, 8, 23, 9, 0) / 60000));
check('دقائق يونكس بتوقيت ٢', toUnixMin('2026-09-23T12:00', 2), Math.floor(Date.UTC(2026, 8, 23, 10, 0) / 60000));
check('صياغة الظهر', fmt12('2026-09-23T12:00'), '١٢ م');
check('صياغة ٤:٠٥ ص', fmt12('2026-09-23T04:05'), '٤:٠٥ ص');
check('صياغة منتصف الليل', fmt12('2026-09-23T00:30'), '١٢:٣٠ ص');

// ── ٧. يوم البداية يمنع التنبيه على ما قبله ──────────────────────
check('ما قبل يوم البداية لا يُنبَّه', blocksAround({ ...riyadh, startDate: '2027-01-01' }, NOW).length, 0);

// ── ٨. البلوكات تغطّي ما حول اللحظة، فلا تفوت ليلةٌ عبر منتصف الليل ─
{
  const mins = bR.map((b) => b.minute).sort((a, b) => a - b);
  ok('تغطية قبل اللحظة', mins[0] < nowMin - 600, `${mins[0]} vs ${nowMin}`);
  ok('وتغطية بعدها', mins[mins.length - 1] > nowMin + 600);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
