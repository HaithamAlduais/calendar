// حساب مواقيت الصلاة فلكيًا — خوارزمية PrayTimes بمعايير أم القرى المعدلة للرياض
// الفجر 18.5° تحت الأفق، الشروق/المغرب 0.833°، الظهر الزوال، العصر ظل المثل، العشاء المغرب + 90 د
import { parseIso } from './dates.js';

const LAT = 24.7136;
const LNG = 46.6753;
const TZ = 3;
const FAJR_ANGLE = 18.5;
const RIM = 0.833; // الانكسار الجوي + نصف قطر قرص الشمس

const dtr = (d) => (d * Math.PI) / 180;
const rtd = (r) => (r * 180) / Math.PI;
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixHour = (a) => fix(a, 24);
const fixAngle = (a) => fix(a, 360);

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
  const num = -Math.sin(dtr(angle)) - Math.sin(dtr(decl)) * Math.sin(dtr(LAT));
  const den = Math.cos(dtr(decl)) * Math.cos(dtr(LAT));
  const hourAngle = rtd(Math.acos(num / den)) / 15;
  return midDay(jDate, t) + dir * hourAngle;
}

// العصر: ظل المثل (معامل 1)
function asrTime(jDate, factor, t) {
  const { decl } = sunPosition(jDate + t);
  const angle = -rtd(Math.atan(1 / (factor + Math.tan(dtr(Math.abs(LAT - decl))))));
  return sunAngleTime(jDate, angle, t, 1);
}

// المواقيت بالدقائق من منتصف الليل بتوقيت الرياض، مقربة لأقرب دقيقة
// ذاكرة مؤقتة: الوحدة الواحدة تستدعي ثلاثة أيام، والواجهة تستدعيها في كل رسم
const ptCache = new Map();

export function prayerTimes(dateIso) {
  const hit = ptCache.get(dateIso);
  if (hit) return hit;
  const { y, m, d } = parseIso(dateIso);
  const jDate = julian(y, m, d) - LNG / (15 * 24);

  // تمريرة واحدة بأجزاء اليوم القياسية (مطابقة لمرجعية PrayTimes التي بُني عليها التقويم اليدوي)
  const fajr = sunAngleTime(jDate, FAJR_ANGLE, 5 / 24, -1);
  const sunrise = sunAngleTime(jDate, RIM, 6 / 24, -1);
  const dhuhr = midDay(jDate, 12 / 24);
  const asr = asrTime(jDate, 1, 13 / 24);
  const maghrib = sunAngleTime(jDate, RIM, 18 / 24, 1);

  const toMin = (t) => Math.round(fixHour(t + TZ - LNG / 15) * 60);
  // المغرب يقرَّب لأعلى (الأحوط، ومطابق للمرجع اليدوي في التقويم)
  const mag = Math.ceil(fixHour(maghrib + TZ - LNG / 15) * 60);
  const out = {
    fajr: toMin(fajr),
    sunrise: toMin(sunrise),
    dhuhr: toMin(dhuhr),
    asr: toMin(asr),
    maghrib: mag,
    isha: mag + 90, // أم القرى: المغرب + ٩٠ دقيقة (وفي رمضان ١٢٠ — يُعدَّل حينها)
  };
  ptCache.set(dateIso, out);
  return out;
}

export function fmtTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`;
}
