// يُنشئ لقطة الجدول المرجعية (golden.json) من المحرك بإعداداته الافتراضية.
// لا تُشغّله إلا حين تتعمّد تغيير الجدول — فاللقطة هي التي تحرس ألّا يتغيّر بلا قصد.
// الاستعمال: pnpm test:golden ثم راجع الفرق في git قبل الإيداع.
import { writeFileSync } from 'node:fs';
import { buildUnit } from '../lib/engine/schedule.js';
import { addDays } from '../lib/engine/dates.js';
import { QURAN_SEED } from '../lib/engine/quran.js';

const DAYS = 60;
const from = QURAN_SEED.date;
const units = [];
let d = from;
for (let i = 0; i < DAYS; i++) {
  units.push(
    buildUnit(d).map((e) => [
      e.slot,
      e.start,
      e.end,
      e.title,
      e.items.map((x) => x.id).join(','),
      e.items.map((x) => x.text).join('|'),
    ])
  );
  d = addDays(d, 1);
}
const out = new URL('./golden.json', import.meta.url);
writeFileSync(out, JSON.stringify({ from, days: DAYS, units }));
console.log(`لقطة مرجعية جديدة: ${DAYS} وحدة من ${from}`);
