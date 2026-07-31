// عامل الخدمة — يجعل التطبيق يعمل دون اتصال:
// الشبكة أولًا (فالتحديثات فورية) مع الرجوع للنسخة المخبأة عند الانقطاع
const CACHE = 'haitham-calendar-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/schedule.js',
  './js/prayers.js',
  './js/quran.js',
  './js/workout.js',
  './js/dates.js',
  './js/gcal.js',
  './js/ics.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // طلبات Google تمر مباشرة
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
  );
});
