// حساب مواقيت الصلاة فلكيًا (خوارزمية PrayTimes) — الموقع وطريقة الحساب من إعدادات المستخدم
// الشروق/المغرب على 0.833° (الانكسار الجوي ونصف قطر القرص)، والظهر الزوال
import { parseIso } from './dates.js';

// طرق الحساب المشهورة: زاوية الفجر، والعشاء إمّا زاوية وإمّا دقائق بعد المغرب
export const METHODS = {
  ummAlQura: { name: 'أم القرى (مكة المكرمة)', fajr: 18.5, ishaAfterMaghrib: 90 },
  mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  isna: { name: 'الجمعية الإسلامية لأمريكا الشمالية', fajr: 15, isha: 15 },
  egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
  karachi: { name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
  dubai: { name: 'دائرة الشؤون الإسلامية — دبي', fajr: 18.2, isha: 18.2 },
};

// الافتراض: الرياض بمعايير أم القرى — وهو ما بُني عليه تقويم هيثم اليدوي.
// تقريب المغرب لأعلى (ceil) هو ما طابق ذلك المرجع، فبقي افتراضًا.
const DEFAULTS = {
  lat: 24.7136,
  lng: 46.6753,
  tz: 3,
  method: 'ummAlQura',
  asrFactor: 1, // ظل المثل (الجمهور)، و٢ للحنفية
  roundMaghribUp: true,
};

let cfg = { ...DEFAULTS };
const ptCache = new Map();

export function prayerConfig() {
  return { ...cfg };
}

// تغيير الموقع أو الطريقة يُبطل الذاكرة المؤقتة
export function setPrayerConfig(patch) {
  cfg = { ...cfg, ...patch };
  ptCache.clear();
  return prayerConfig();
}

const dtr = (d) => (d * Math.PI) / 180;
const rtd = (r) => (r * 180) / Math.PI;
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixHour = (a) => fix(a, 24);
const fixAngle = (a) => fix(a, 360);
const RIM = 0.833;

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

// ميل الشمس ومعادلة الزمن (تقريب فلكي قياسي)
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * Math.sin(dtr(g)) + 0.020 * Math.sin(dtr(2 * g)));
  const e = 23.439 - 0.00000036 * D;
  const RA = rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(L)), Math.cos(dtr(L)))) / 15;
  return {
    decl: rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(L)))),
    eqt: q / 15 - fixHour(RA),
  };
}

function midDay(jDate, t) {
  return fixHour(12 - sunPosition(jDate + t).eqt);
}

// الوقت الذي تبلغ فيه الشمس زاوية معينة تحت الأفق (dir: -1 صباحًا، +1 مساءً)
function sunAngleTime(jDate, angle, t, dir) {
  const { decl } = sunPosition(jDate + t);
  const num = -Math.sin(dtr(angle)) - Math.sin(dtr(decl)) * Math.sin(dtr(cfg.lat));
  const den = Math.cos(dtr(decl)) * Math.cos(dtr(cfg.lat));
  const hourAngle = rtd(Math.acos(num / den)) / 15;
  return midDay(jDate, t) + dir * hourAngle;
}

// العصر: ظل المثل (معامل ١) أو ظل المثلين (معامل ٢ عند الحنفية)
function asrTime(jDate, factor, t) {
  const { decl } = sunPosition(jDate + t);
  const angle = -rtd(Math.atan(1 / (factor + Math.tan(dtr(Math.abs(cfg.lat - decl))))));
  return sunAngleTime(jDate, angle, t, 1);
}

// المواقيت بالدقائق من منتصف الليل بالتوقيت المحلي، مقرَّبة لأقرب دقيقة
// ذاكرة مؤقتة: الوحدة الواحدة تستدعي ثلاثة أيام، والواجهة تستدعيها في كل رسم
export function prayerTimes(dateIso) {
  const hit = ptCache.get(dateIso);
  if (hit) return hit;
  const method = METHODS[cfg.method] || METHODS.ummAlQura;
  const { y, m, d } = parseIso(dateIso);
  const jDate = julian(y, m, d) - cfg.lng / (15 * 24);

  // تمريرة واحدة بأجزاء اليوم القياسية (مطابقة لمرجعية PrayTimes)
  const fajr = sunAngleTime(jDate, method.fajr, 5 / 24, -1);
  const sunrise = sunAngleTime(jDate, RIM, 6 / 24, -1);
  const dhuhr = midDay(jDate, 12 / 24);
  const asr = asrTime(jDate, cfg.asrFactor, 13 / 24);
  const maghrib = sunAngleTime(jDate, RIM, 18 / 24, 1);

  const local = (t) => fixHour(t + cfg.tz - cfg.lng / 15) * 60;
  const toMin = (t) => Math.round(local(t));
  const mag = cfg.roundMaghribUp ? Math.ceil(local(maghrib)) : toMin(maghrib);
  const out = {
    fajr: toMin(fajr),
    sunrise: toMin(sunrise),
    dhuhr: toMin(dhuhr),
    asr: toMin(asr),
    maghrib: mag,
    // العشاء: دقائق بعد المغرب (أم القرى) أو زاوية تحت الأفق
    isha: method.ishaAfterMaghrib != null
      ? mag + method.ishaAfterMaghrib
      : toMin(sunAngleTime(jDate, method.isha, 18 / 24, 1)),
  };
  ptCache.set(dateIso, out);
  return out;
}

export function fmtTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`;
}
