// أيام الصيام — يومُ صومٍ تسقط فيه وجبةُ النهار من الجدول.
//
// ثلاثة مصادر:
//   • الاثنين والخميس (سنّة راتبة)
//   • رمضان كلُّه
//   • أيامٌ مأثورة بتواريخ هجرية معلومة: عاشوراء وتاسوعاء، ويومُ عرفة،
//     وستٌّ من شوال (تُترك اختيارًا فقد لا تُصام متتابعة).
//
// التقويم الهجري من Intl بتقويم أم القرى — وهو المعتمد في السعودية،
// فتوافق أيامُه ما عليه الناس هناك.
const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

const hijriCache = new Map();

// "YYYY-MM-DD" ميلادي ← { y, m, d } هجري
export function toHijri(dIso) {
  if (hijriCache.has(dIso)) return hijriCache.get(dIso);
  const [y, m, d] = dIso.split('-').map(Number);
  const parts = hijriFmt.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  const out = { y: get('year'), m: get('month'), d: get('day') };
  hijriCache.set(dIso, out);
  return out;
}

// 0=الأحد … — من dates.js دون استيراد دائري
function dow(dIso) {
  const [y, m, d] = dIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const DEFAULT_FASTING = {
  mondayThursday: true,
  ramadan: true,
  ashura: true, // تاسوعاء وعاشوراء: ٩ و١٠ محرّم
  arafah: true, // يوم عرفة: ٩ ذو الحجة
  shawwal: false, // ستٌّ من شوال — تُصام متفرقة فلا تُفرض على الجدول
  whiteDays: false, // أيام البيض ١٣–١٥ (قال: يكفيني الاثنان والخميس)
};

// هل هذا اليوم صومٌ؟ ومعه سببُه ليُعرض
export function fastingDay(dIso, cfg = DEFAULT_FASTING) {
  const h = toHijri(dIso);
  if (cfg.ramadan && h.m === 9) return { fasting: true, reason: 'رمضان' };
  if (cfg.arafah && h.m === 12 && h.d === 9) return { fasting: true, reason: 'يوم عرفة' };
  if (cfg.ashura && h.m === 1 && (h.d === 9 || h.d === 10))
    return { fasting: true, reason: h.d === 9 ? 'تاسوعاء' : 'عاشوراء' };
  if (cfg.whiteDays && h.d >= 13 && h.d <= 15) return { fasting: true, reason: 'أيام البيض' };
  if (cfg.shawwal && h.m === 10 && h.d >= 2 && h.d <= 7) return { fasting: true, reason: 'ستٌّ من شوال' };
  // العيدان لا يُصامان — ولو وافقا اثنينًا أو خميسًا
  const eid = (h.m === 10 && h.d === 1) || (h.m === 12 && h.d >= 10 && h.d <= 13);
  if (eid) return { fasting: false, reason: '' };
  if (cfg.mondayThursday && (dow(dIso) === 1 || dow(dIso) === 4))
    return { fasting: true, reason: dow(dIso) === 1 ? 'الاثنين' : 'الخميس' };
  return { fasting: false, reason: '' };
}

export const isFasting = (dIso, cfg) => fastingDay(dIso, cfg).fasting;
