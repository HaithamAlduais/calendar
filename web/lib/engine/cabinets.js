// الخزانات — الطبقة التي تُغذّي بلوكات المهام
//
// خزانة: أمر جلل تريد إنهاءه (مشروع، سنة دراسية، روتين). لها هدف وموعد نهائي، واختياريان.
// درج:   هدف جزئي داخلها (الفيز الأول). له هدف وموعد نهائي، واختياريان.
// مهمة:  داخل الدرج. تُوضع في بلوك مهام بعينه، ولها تكرار وبداية وموعد نهائي.
//
// توارث الموعد النهائي: المهمة ← الدرج ← الخزانة. فإن لم يكن ثمة موعد استمرت المهمة
// إلى غير أمد حتى يُضغط «إتمام الهدف» فتختفي.
import { daysBetween, dow } from './dates.js';

export const emptyCabinets = () => ({ cabinets: [], drawers: [], items: [] });

export function effectiveDeadline(item, drawer, cabinet) {
  return item.deadline || (drawer && drawer.deadline) || (cabinet && cabinet.deadline) || null;
}

// هل المهمة مستحقّة في هذا اليوم؟ التكرار إمّا بأيام الأسبوع، وإمّا كل N يوم، وإمّا مرة واحدة
export function dueOn(item, dIso) {
  if (dIso < item.from) return false;
  const r = item.repeat || { mode: 'once' };
  if (r.mode === 'once') return dIso === item.from;
  if (r.mode === 'weekly') return (r.days || []).includes(dow(dIso));
  if (r.mode === 'everyN') return daysBetween(item.from, dIso) % Math.max(1, r.n) === 0;
  return false;
}

// مهام يوم dIso موزَّعةً على بلوكاتها: slot ← [{ item, drawer, cabinet, deadline }]
// المهمة بلا بلوك محدَّد تذهب إلى بلوك درجها الموضوع في التقويم إن وُضع،
// وإلا إلى fallbackSlot (أول بلوك مهام في اليوم)
export function itemsForDay(dIso, data, fallbackSlot) {
  const out = new Map();
  const drawers = new Map((data.drawers || []).map((x) => [x.id, x]));
  const cabinets = new Map((data.cabinets || []).map((x) => [x.id, x]));
  for (const item of data.items || []) {
    if (item.doneAt) continue; // أُتمّ هدفها فاختفت
    const drawer = drawers.get(item.drawerId);
    const cabinet = drawer && cabinets.get(drawer.cabinetId);
    if ((drawer && drawer.doneAt) || (cabinet && cabinet.doneAt)) continue;
    const deadline = effectiveDeadline(item, drawer, cabinet);
    if (deadline && dIso > deadline) continue; // انقضى موعدها
    if (!dueOn(item, dIso)) continue;
    const slot = item.slot || (drawer && drawer.slot) || fallbackSlot;
    if (!out.has(slot)) out.set(slot, []);
    out.get(slot).push({ item, drawer, cabinet, deadline });
  }
  return out;
}

// وصف التكرار نصًّا للعرض
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export function repeatLabel(repeat, arab) {
  const r = repeat || { mode: 'once' };
  if (r.mode === 'once') return 'مرة واحدة';
  if (r.mode === 'weekly') {
    const days = (r.days || []).slice().sort((a, b) => a - b);
    if (days.length === 7) return 'كل يوم';
    return days.length ? days.map((d) => DAY_NAMES[d]).join('، ') : 'بلا أيام';
  }
  if (r.n === 1) return 'كل يوم';
  if (r.n === 2) return 'يومًا بعد يوم';
  return `كل ${arab(r.n)} أيام`;
}

// عدّ مهام الدرج وما أُتمّ منها — لشريط تقدّم الخزانة
export function counts(data, { cabinetId, drawerId } = {}) {
  const drawers = new Map((data.drawers || []).map((x) => [x.id, x]));
  let total = 0;
  let done = 0;
  for (const item of data.items || []) {
    if (drawerId && item.drawerId !== drawerId) continue;
    if (cabinetId && drawers.get(item.drawerId)?.cabinetId !== cabinetId) continue;
    total++;
    if (item.doneAt) done++;
  }
  return { total, done };
}
