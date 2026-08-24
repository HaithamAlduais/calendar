// حساب إشعارات مشترك واحد من إعداداته — منطقٌ محضٌ بلا شبكة ولا قاعدة،
// فيُشغّل في Deno داخل الدالة، ويُختبر في Node مع بقية فحوص المحرك.
//
// وكان هذا الحساب مكتوبًا داخل الدالة بموقعٍ وقوالبَ مثبَّتة، فكان كل مشترك
// يتلقّى إشعارات جدول غيره. صار يقرأ إعدادات صاحبه ويبني يومه بها.
import { dow, toIso } from './engine/dates.js';
import { setPrayerConfig } from './engine/prayers.js';
import { buildDay, rotateTemplate } from './engine/layout.js';
import { DEFAULT_TEMPLATES, DEFAULT_WEEK_PLAN } from './engine/schedule.js';

const DAYMS = 86400000;

// من اشترك بلا حساب فإعداداته في جهازه وحده لا يبلغها الخادم، فيُبنى يومه
// على افتراض البرنامج. وهو ما كان يجري قبل هذا التعديل لكلّ المشتركين —
// فمن لم يدخل لم ينقص شيئًا، ومن دخل صار له جدولُه هو.
export const FALLBACK = {
  lat: 24.7136,
  lng: 46.6753,
  tz: 3,
  method: 'ummAlQura',
  asrFactor: 1,
  templates: DEFAULT_TEMPLATES,
  weekPlan: DEFAULT_WEEK_PLAN,
  dayStart: null,
};

// وإعداداتٌ خاوية حقًّا (لا قوالب) لا تُنتج شيئًا — تستعملها الفحوص
export const EMPTY = { ...FALLBACK, templates: {}, weekPlan: [] };

export function isoOfEpochDay(e) {
  const dt = new Date(e * DAYMS);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// "YYYY-MM-DDTHH:MM" بتوقيت المستخدم ← دقائق يونكس
export function toUnixMin(stamp, tz) {
  return Math.floor(Date.parse(stamp + ':00Z') / 60000) - Math.round(tz * 60);
}

const ARD = '٠١٢٣٤٥٦٧٨٩';
const arab = (x) => String(x).replace(/[0-9]/g, (d) => ARD[+d]);
export function fmt12(stamp) {
  const h = +stamp.slice(11, 13);
  const mm = +stamp.slice(14, 16);
  const ap = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 || 12;
  return mm === 0 ? `${arab(h12)} ${ap}` : `${arab(h12)}:${arab(String(mm).padStart(2, '0'))} ${ap}`;
}

// بلوكات ثلاثة أيام حول يوم المشترك الجاري، بأوقاتها بدقائق يونكس.
// ثلاثةٌ لأن الوحدة تمتدّ عبر منتصف الليل، فبلوك الليلة قد يكون من يوم أمس.
export function blocksAround(s, nowMs = Date.now()) {
  const ids = Object.keys(s.templates || {});
  if (!ids.length) return [];
  setPrayerConfig({
    lat: s.lat,
    lng: s.lng,
    tz: s.tz,
    method: s.method,
    asrFactor: s.asrFactor,
    roundMaghribUp: true,
  });
  const today = Math.floor((nowMs + s.tz * 3600e3) / DAYMS);
  const out = [];
  for (let k = -1; k <= 1; k++) {
    const d = isoOfEpochDay(today + k);
    if (s.startDate && d < s.startDate) continue; // ما قبل يوم بدايته لا يُنبَّه عليه
    const pick = (s.weekPlan || [])[dow(d)];
    const tpl = s.templates[pick] || s.templates[ids[0]];
    if (!tpl) continue;
    for (const ev of buildDay(d, rotateTemplate(tpl, s.dayStart), () => []))
      out.push({ title: ev.title, minute: toUnixMin(ev.start, s.tz), at: ev.start });
  }
  return out;
}

// تنبيهان لكل بلوك: قبله بثلاثين دقيقة وعند بدئه
export function duePayloads(s, nowMin, nowMs = Date.now()) {
  const out = [];
  for (const b of blocksAround(s, nowMs)) {
    if (b.minute === nowMin)
      out.push({
        title: `🕌 ${b.title} — الآن`,
        body: `بدأ وقت «${b.title}» (${fmt12(b.at)})`,
        tag: `s${b.minute}`,
      });
    if (b.minute - 30 === nowMin)
      out.push({
        title: `⏰ ${b.title} بعد ٣٠ دقيقة`,
        body: `يبدأ «${b.title}» الساعة ${fmt12(b.at)}`,
        tag: `p${b.minute}`,
      });
  }
  return out;
}
