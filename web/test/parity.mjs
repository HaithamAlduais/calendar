// اختبار المطابقة — معيار قبول التحويل إلى برنامج عام:
// نُدخل جدول هيثم بنموذج البيانات العام وحده (haitham-config.mjs، لا يستورد أي افتراض)،
// ثم نثبت أن ناتجه مطابقٌ حرفًا بحرف للجدول المُودَع (golden.json) على ٦٠ يومًا.
//
// إن عجز النموذج عن وصف جدوله، أو غيّر التحرير في المحرك شيئًا من ناتجه، سقط هذا الاختبار.
import { readFileSync } from 'node:fs';
import { setScheduleConfig, buildUnit } from '../lib/engine/schedule.js';
import { setPrayerConfig } from '../lib/engine/prayers.js';
import { setQuranConfig } from '../lib/engine/quran.js';
import { setWorkoutConfig } from '../lib/engine/workout.js';
import { addDays } from '../lib/engine/dates.js';
import { templates, weekPlan, prayer, quran, workout } from './haitham-config.mjs';

const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));

// لا شيء من الافتراضات: كل شيء من ملف الإعداد
setPrayerConfig(prayer);
setQuranConfig(quran);
setWorkoutConfig(workout);
setScheduleConfig({ templates, weekPlan });

let pass = 0;
const fails = [];
let d = golden.from;
for (let i = 0; i < golden.days; i++) {
  const built = buildUnit(d).map((e) => [
    e.slot,
    e.start,
    e.end,
    e.title,
    e.items.map((x) => x.id).join(','),
    e.items.map((x) => x.text).join('|'),
  ]);
  const want = golden.units[i];
  if (built.length !== want.length) {
    fails.push(`${d}: عدد البلوكات ${built.length} بدل ${want.length}`);
  } else {
    for (let b = 0; b < want.length; b++)
      for (let f = 0; f < want[b].length; f++) {
        const FIELDS = ['slot', 'start', 'end', 'title', 'items', 'texts'];
        if (built[b][f] !== want[b][f]) {
          fails.push(`${d} ${want[b][0]} ${FIELDS[f]}:\n  جاء: ${String(built[b][f]).slice(0, 120)}\n  المتوقع: ${String(want[b][f]).slice(0, 120)}`);
        } else pass++;
      }
  }
  d = addDays(d, 1);
}

for (const f of fails.slice(0, 10)) console.log('FAIL ' + f);
if (fails.length > 10) console.log(`… و${fails.length - 10} اختلافًا آخر`);
console.log(
  `\nالمطابقة: ${pass} حقلًا مطابقًا عبر ${golden.days} يومًا` +
    (fails.length ? ` — ${fails.length} اختلافًا` : ' — لا اختلاف')
);
process.exit(fails.length ? 1 : 0);
