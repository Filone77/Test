/* HydroCalc — Service Worker (cache « app shell » pour usage hors-ligne) */
var CACHE = 'hydrocalc-v2';
var ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'assets/icon.svg',
  'assets/css/styles.css',
  'assets/js/hydraulics.js', 'assets/js/hydraulics-ext.js', 'assets/js/references.js',
  'assets/js/i18n.js', 'assets/js/ui.js', 'assets/js/modules.js', 'assets/js/modules-ext.js',
  'assets/js/export.js', 'assets/js/import-xlsx.js', 'assets/js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (a) { return c.add(a).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return resp;
      }).catch(function () { return caches.match('index.html'); });
    })
  );
});
