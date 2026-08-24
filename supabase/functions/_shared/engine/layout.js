// محرك القالب: يحوّل «قالب يوم» (بيانات محضة) إلى أحداث بأوقات فعلية.
// لا يعرف شيئًا عن جدول بعينه — كل ما يعرفه أن اليوم سلسلة بلوكات متلاصقة،
// نهايةُ كلٍّ منها مرساةٌ فلكية أو طولٌ ثابت، وبدايتُه نهايةُ سابقه (فصفر فجوات بالبناء).
//
// القالب:
//   { start: Anchor, blocks: [{ id, title, colorId, end: Anchor, sleep?, transparent?, ... }] }
// المرساة (Anchor) إحدى صور أربع:
//   { prayer: 'fajr'|'sunrise'|'dhuhr'|'asr'|'maghrib'|'isha', offset? }
//   { nightFraction: 1|2, offset? }   ثلث الليل أو ثلثاه (من المغرب إلى فجر الغد)
//   { lastThirdPrev: true }           مطلع الثلث الأخير من الليلة السابقة
//   { clock: n }                      ساعة ثابتة من منتصف الليل (٣:٠٠ ص = 180)
//   { len: n }                        طول ثابت من بداية البلوك
//   { balance: { target, min, max, keepAfter } }  نومة تُكمِل مجموع النوم إلى هدف ثابت
// ولأيّ مرساة فلكية أن تحمل { next: true } فتشير إلى نظيرتها من الغد — وبها يدور
// اليوم على أيّ بلوك شاء صاحبه: ما سبق البلوك المختار يُزاح إلى غدٍ فيبقى الترتيب.
import { addDays, minToDateTime } from './dates.js';
import { prayerTimes } from './prayers.js';

// كل المراسي بالدقائق منسوبةً إلى منتصف ليل dIso (وقد تتجاوز 1440 أو تسبق الصفر)
function anchorsFor(dIso, depth = 0) {
  const P0 = prayerTimes(addDays(dIso, -1));
  const P1 = prayerTimes(dIso);
  const P2 = prayerTimes(addDays(dIso, 1));
  const F = P1.fajr;
  const M = P1.maghrib;
  const F2 = P2.fajr + 1440;
  const prevM = P0.maghrib - 1440; // مغرب أمس (قيمة سالبة)
  const a = {
    fajr: F,
    sunrise: P1.sunrise,
    dhuhr: P1.dhuhr,
    asr: P1.asr,
    maghrib: M,
    isha: P1.isha,
    fajrNext: F2,
    night: (k) => M + Math.round((k * (F2 - M)) / 3),
    lastThirdPrev: prevM + Math.round((2 * (F - prevM)) / 3),
  };
  // مراسي الغد بإطار اليوم نفسه (بزيادة ١٤٤٠) — تُبنى مرة واحدة ولا تتوالد
  if (depth === 0) a.next = shiftDay(anchorsFor(addDays(dIso, 1), 1));
  return a;
}

// إزاحة مراسي يومٍ تالٍ إلى إطار اليوم الحالي
function shiftDay(a) {
  const out = { night: (k) => a.night(k) + 1440 };
  for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'fajrNext', 'lastThirdPrev'])
    out[k] = a[k] + 1440;
  return out;
}

function resolve(anchor, a0, start, balanceLen) {
  const off = anchor.offset || 0;
  const a = anchor.next && a0.next ? a0.next : a0;
  if (anchor.prayer) return a[anchor.prayer] + off;
  if (anchor.nightFraction) return a.night(anchor.nightFraction) + off;
  if (anchor.lastThirdPrev) return a.lastThirdPrev + off;
  if (anchor.fajrNext) return a.fajrNext + off;
  if (anchor.clock != null) return anchor.clock + (anchor.next ? 1440 : 0);
  if (anchor.balance) return start + balanceLen;
  return start + (anchor.len || 0);
}

// طول نومة التوازن: تُكمِل بقية نوم اليوم إلى الهدف، وتنكمش إن ضاق ما بعدها
function balanceLength(tpl, a) {
  const i = tpl.blocks.findIndex((b) => b.end.balance);
  if (i < 0) return 0;
  const cfg = tpl.blocks[i].end.balance;
  const min = cfg.min ?? 0;
  // تمريرة أولى بأقلّ طول: نهايات البلوكات الأخرى مراسٍ مطلقة فلا تتأثر بالطول
  const first = layoutMinutes(tpl, a, min);
  const others = first
    .filter((b, k) => b.sleep && k !== i)
    .reduce((s, b) => s + (b.endMin - b.startMin), 0);
  const next = first[i + 1];
  const room = next ? next.endMin - first[i].startMin - (cfg.keepAfter ?? 0) : Infinity;
  return Math.max(min, Math.min(cfg.max ?? Infinity, (cfg.target ?? 0) - others, room));
}

function layoutMinutes(tpl, a, balanceLen) {
  let t = resolve(tpl.start, a, 0, 0);
  return tpl.blocks.map((b) => {
    const startMin = t;
    t = resolve(b.end, a, startMin, balanceLen);
    return { ...b, startMin, endMin: t };
  });
}

// ── بداية اليوم: أيّ بلوك يفتتح الوحدة، وأيّ مرساة تفتتحه ──
// القالب يُحفظ دائمًا بترتيبه الأصلي، والدوران يُطبَّق عند البناء لا عند الحفظ،
// فيبقى التحرير على حاله ويبقى الرجوع ممكنًا بإلغاء الاختيار.
export const isAbsolute = (a) =>
  !!(a && (a.prayer || a.nightFraction || a.lastThirdPrev || a.fajrNext || a.clock != null));

// البلوكات التي تصلح بدايةً ليوم: من سبقه ينتهي بمرساة مطلقة يمكن أن تكون بدايةً
export function startCandidates(tpl) {
  return tpl.blocks
    .map((b, i) => ({ b, prev: i === 0 ? null : tpl.blocks[i - 1] }))
    .filter(({ prev }) => prev === null || isAbsolute(prev.end))
    .map(({ b }) => ({ id: b.id, title: b.title }));
}

export function rotateTemplate(tpl, dayStart) {
  if (!dayStart) return tpl;
  let blocks = tpl.blocks;
  let start = tpl.start;
  if (dayStart.blockId) {
    const i = blocks.findIndex((b) => b.id === dayStart.blockId);
    if (i > 0) {
      const prev = blocks[i - 1];
      if (!isAbsolute(prev.end)) return tpl; // لا مرساة تصلح بدايةً، فلا دوران
      // ما سبق البلوك المختار يُزاح إلى غدٍ، فيبقى الترتيب الزمني صاعدًا
      const wrapped = blocks.slice(0, i).map((b) => ({
        ...b,
        end: isAbsolute(b.end) ? { ...b.end, next: true } : { ...b.end },
      }));
      blocks = [...blocks.slice(i), ...wrapped];
      start = { ...prev.end };
      delete start.next;
    }
  }
  if (dayStart.anchor) start = dayStart.anchor;
  return { ...tpl, start, blocks };
}

// يومٌ سليم: لا بلوك ينتهي قبل أن يبدأ
export function isMonotone(dIso, tpl) {
  const a = anchorsFor(dIso);
  return layoutMinutes(tpl, a, balanceLength(tpl, a)).every((b) => b.endMin >= b.startMin);
}

// وقت بداية وحدة dIso نصًّا — تستعمله الواجهة لتحديد الوحدة الجارية
export function unitStart(dIso, tpl) {
  return minToDateTime(dIso, resolve(tpl.start, anchorsFor(dIso), 0, 0));
}

// أحداث يوم dIso من قالبه. itemsFor(block, dIso) يعيد بنود البلوك (ما يخصّ الجدول نفسه)
export function buildDay(dIso, tpl, itemsFor) {
  const a = anchorsFor(dIso);
  return layoutMinutes(tpl, a, balanceLength(tpl, a)).map((b) => ({
    id: `${dIso}#${b.id}`,
    unit: dIso,
    slot: b.id,
    title: b.title,
    start: minToDateTime(dIso, b.startMin),
    end: minToDateTime(dIso, b.endMin),
    colorId: b.colorId,
    items: itemsFor(b, dIso).map((x) => ({ ...x })), // نسخة لكل يوم
    transparent: !!b.transparent,
  }));
}
