// تصدير iCalendar للاستيراد في Google Calendar أو أي تطبيق تقويم
function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line) {
  // طي الأسطر حسب RFC 5545: ≤ 75 أوكتت UTF-8 لكل سطر، دون قسمة أي محرف (آمن للرموز التعبيرية)
  const octets = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = octets(ch.codePointAt(0));
    if (bytes + b > 73) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

const dt = (s) => s.replace(/[-:]/g, '') + '00'; // "2026-07-31T18:39" → "20260731T183900"

export function buildIcs(events) {
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Haitham Calendar//AR//',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold('X-WR-CALNAME:جدول هيثم'),
    'X-WR-TIMEZONE:Asia/Riyadh',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Riyadh',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const ev of events) {
    L.push('BEGIN:VEVENT');
    L.push(fold(`UID:${ev.id}@haitham-calendar`));
    L.push('DTSTAMP:20260731T000000Z');
    L.push(`DTSTART;TZID=Asia/Riyadh:${dt(ev.start)}`);
    L.push(`DTEND;TZID=Asia/Riyadh:${dt(ev.end)}`);
    L.push(fold(`SUMMARY:${esc(ev.title)}`));
    if (ev.desc) L.push(fold(`DESCRIPTION:${esc(ev.desc)}`));
    if (ev.transparent) L.push('TRANSP:TRANSPARENT');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

export function downloadIcs(events, filename = 'haitham-schedule.ics') {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
