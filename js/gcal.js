// مزامنة Google Calendar عبر حساب المستخدم (OAuth في المتصفح — لا خادم ولا مفاتيح مخزنة خارج جهازك)
// تتطلب Client ID من Google Cloud Console بأصل http://localhost:8080
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

let accessToken = null;
let tokenClient = null;

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('تعذّر تحميل مكتبة Google — تحقق من الاتصال بالإنترنت'));
    document.head.appendChild(s);
  });
}

export function isConnected() {
  return !!accessToken;
}

export async function connect(clientId) {
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        resolve();
      },
      error_callback: (err) => reject(new Error(err.type || 'فشل تسجيل الدخول')),
    });
    tokenClient.requestAccessToken();
  });
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401) {
    accessToken = null; // حتى يعيد «اتصال» فتح OAuth فعليًا
    throw new Error('انتهت صلاحية الجلسة — اضغط «اتصال بحساب Google» مرة أخرى');
  }
  if (!r.ok) throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

const rfc3339 = (s) => `${s}:00+03:00`;

function toBody(ev) {
  return {
    summary: ev.title + (ev.done ? ' ✅' : ''),
    description: ev.desc || '',
    colorId: String(ev.colorId),
    transparency: ev.transparent ? 'transparent' : 'opaque',
    start: { dateTime: rfc3339(ev.start), timeZone: 'Asia/Riyadh' },
    end: { dateTime: rfc3339(ev.end), timeZone: 'Asia/Riyadh' },
    extendedProperties: { private: { hcApp: '1', hcUid: ev.id } },
  };
}

async function listRange(fromIso, toIso, extraParams = '') {
  const items = [];
  let pageToken = '';
  do {
    // timeZone=Asia/Riyadh يضمن أن dateTime في الرد بجدار الرياض فتصح مقارنة التغيير
    const url =
      `${API}?maxResults=2500&singleEvents=true&timeZone=Asia%2FRiyadh&timeMin=${encodeURIComponent(rfc3339(fromIso + 'T00:00'))}` +
      `&timeMax=${encodeURIComponent(rfc3339(toIso + 'T23:59'))}${extraParams}` +
      (pageToken ? `&pageToken=${pageToken}` : '');
    const data = await api(url);
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return items;
}

// دفع الأحداث: إدراج الجديد وتحديث المتغيّر وتخطي المطابق — بلا أي تكرار
export async function pushEvents(events, fromIso, toIso, onProgress) {
  const existing = await listRange(fromIso, toIso, '&privateExtendedProperty=hcApp%3D1');
  const byUid = new Map();
  for (const g of existing) {
    const uid = g.extendedProperties?.private?.hcUid;
    if (uid) byUid.set(uid, g);
  }
  let inserted = 0, updated = 0, skipped = 0, i = 0;
  for (const ev of events) {
    const body = toBody(ev);
    const g = byUid.get(ev.id);
    if (!g) {
      await api(API, { method: 'POST', body: JSON.stringify(body) });
      inserted++;
    } else {
      const same =
        g.summary === body.summary &&
        (g.description || '') === body.description &&
        String(g.colorId || '') === body.colorId &&
        g.start?.dateTime?.slice(0, 16) === ev.start &&
        g.end?.dateTime?.slice(0, 16) === ev.end;
      if (same) {
        skipped++;
      } else {
        await api(`${API}/${g.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        updated++;
      }
    }
    onProgress?.(++i, events.length);
  }
  return { inserted, updated, skipped };
}

// سحب أحداث Google الخارجية (غير الموسومة بتطبيقنا) لعرضها في التقويم
export async function pullEvents(fromIso, toIso) {
  const items = await listRange(fromIso, toIso);
  const out = [];
  for (const g of items) {
    if (g.extendedProperties?.private?.hcApp === '1') continue;
    if (!g.start?.dateTime) continue; // نتجاهل أحداث اليوم الكامل
    const wall = (s) => {
      const d = new Date(s);
      const t = new Date(d.getTime() + 3 * 3600000); // إلى جدار الرياض
      const p = (n) => String(n).padStart(2, '0');
      return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
    };
    out.push({
      id: `g:${g.id}`,
      title: g.summary || '(بلا عنوان)',
      start: wall(g.start.dateTime),
      end: wall(g.end.dateTime),
      colorId: Number(g.colorId) || 7,
      desc: g.description || '',
      external: true,
    });
  }
  return out;
}
