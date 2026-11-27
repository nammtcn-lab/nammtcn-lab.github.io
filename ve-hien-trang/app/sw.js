// Tự động sinh khi build
const CACHE = 'vht-mwz1yy0c';
const ASSETS = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./assets/qr-ca-phe-CEwEgGZ7.jpg","./assets/nam-chan-dung-uhv4FZw9.png","./assets/bia-sach-DwHrrOvq.jpg","./assets/vn-sans-DJfwRWrj.ttf","./assets/index-DB8FAE6c.css","./assets/index-DrSSnnbb.js","./assets/pdf-Bk2WR5zM.js","./assets/pdf.worker-YXtj75XS.js","./assets/jspdf.es.min-D-JktwTl.js","./assets/html2canvas.esm-CBrSDip1.js","./assets/purify.es-BwoZCkIS.js","./assets/index.es-D7wsnTzF.js","./assets/_commonjsHelpers-C4iS2aBk.js"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
