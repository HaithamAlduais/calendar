// نسخ ملفات المحرك التي يحتاجها خادم الإشعارات إلى مجلد الدالة.
//
// دوال Supabase تُحزَم من مجلد `supabase/` وحده، فلا تصل إلى `web/lib/engine`.
// وكانت الدالة تحمل نسخةً مكتوبةً باليد من المحرك، فكان كل تعديل في المحرك
// يحتاج نقلًا يدويًا — ومن نسي فسدت إشعاراته في صمت وهو يحسبها سليمة.
// فصار النقل آليًّا، ويحرسه فحصٌ يسقط إن تباعدت النسختان.
//
//   node scripts/sync-engine.mjs           ينسخ
//   node scripts/sync-engine.mjs --check   يتحقق فقط (يستعمله npm test)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'web', 'lib', 'engine');
const to = join(root, 'supabase', 'functions', '_shared', 'engine');
// المحرك يستورد قالب صاحب البرنامج افتراضًا، فيُنسخ معه
const presetFrom = join(root, 'web', 'lib', 'presets');
const presetTo = join(root, 'supabase', 'functions', '_shared', 'presets');
const PRESETS = ['haitham.js'];

// المحرك كلّه — كلُّه بيانات ودوالُّ محضة تعمل في Deno كما تعمل في المتصفح.
// والخادم لا يبني بنودًا (فالإشعار عنوانُ بلوكٍ ووقتُه)، لكنه يحتاج القوالب
// الافتراضية لمن اشترك بلا حساب.
const FILES = ['dates.js', 'prayers.js', 'layout.js', 'quran.js', 'workout.js', 'fasting.js', 'schedule.js'];

const check = process.argv.includes('--check');
mkdirSync(to, { recursive: true });
mkdirSync(presetTo, { recursive: true });

const jobs = [
  ...FILES.map((f) => ({ f, src: join(from, f), dst: join(to, f), label: 'engine/' + f })),
  ...PRESETS.map((f) => ({ f, src: join(presetFrom, f), dst: join(presetTo, f), label: 'presets/' + f })),
];

let drift = 0;
for (const job of jobs) {
  const f = job.label;
  const src = readFileSync(job.src);
  const dstPath = job.dst;
  const dst = existsSync(dstPath) ? readFileSync(dstPath) : null;
  if (dst && dst.equals(src)) continue;
  if (check) {
    console.log(`اختلاف: supabase/functions/_shared/engine/${f} ليس نسخة web/lib/engine/${f}`);
    drift++;
  } else {
    writeFileSync(dstPath, src);
    console.log(`نُسخ ${f}`);
  }
}

if (check) {
  if (drift) {
    console.log(`\n${drift} ملفًّا متباعدًا — شغّل: npm run sync:engine`);
    process.exit(1);
  }
  console.log(`محرك الخادم مطابق (${jobs.length} ملفات)`);
}
