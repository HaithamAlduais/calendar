// عامل الخدمة — الشبكة أولًا مع الرجوع للنسخة المخبأة عند الانقطاع
const CACHE = 'haitham-week-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// إشعارات الدفع من خادم Supabase — تصل حتى والتطبيق مغلق
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'تقويم هيثم', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(d.title || 'تقويم هيثم', {
      body: d.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: d.tag || undefined,
      dir: 'rtl',
      lang: 'ar',
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
      for (const w of ws) if ('focus' in w) return w.focus();
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))
      )
  );
});
