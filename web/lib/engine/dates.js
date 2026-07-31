// أدوات التواريخ — كل التواريخ نصوص ISO ‏"YYYY-MM-DD" بتوقيت الرياض (لا صيف فيه)
export function parseIso(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function toIso(y, m, d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

export function addDays(s, n) {
  const { y, m, d } = parseIso(s);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// 0=الأحد … 5=الجمعة، 6=السبت
export function dow(s) {
  const { y, m, d } = parseIso(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(a, b) {
  const pa = parseIso(a), pb = parseIso(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

// دقيقة (قد تتجاوز 1440) + تاريخ أساس ← "YYYY-MM-DDTHH:MM"
export function minToDateTime(baseIso, min) {
  const dayShift = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const p = (n) => String(n).padStart(2, '0');
  return `${addDays(baseIso, dayShift)}T${p(Math.floor(m / 60))}:${p(m % 60)}`;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function arab(x) {
  return String(x).replace(/[0-9]/g, (d) => AR_DIGITS[+d]).replace(/\./g, '٫');
}

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
