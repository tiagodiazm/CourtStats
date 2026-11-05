// CourtStats PRO - service worker
// PARA PUBLICAR UNA ACTUALIZACIÓN: cambiá VERSION (v1 -> v2 -> v3...) y subí los archivos.
const VERSION = 'v1';
const CORE = 'courtstats-core-' + VERSION;
const LIBS = 'courtstats-libs-v1'; // librerías con versión fija; cambiar el nombre solo si cambian sus URLs
const CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
const LIB_NOCORS = [
  'https://cdn.tailwindcss.com/3.4.17',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];
const LIB_CORS = ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2'];
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'cdn.tailwindcss.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE);
    for (const f of CORE_FILES) {
      const r = await fetch(new Request(f, { cache: 'reload' }));
      if (!r.ok) throw new Error('No se pudo descargar ' + f);
      await core.put(f, r);
    }
    // Las librerías externas se guardan "a mejor esfuerzo": si falla alguna, se guardan luego al usarlas online.
    const libs = await caches.open(LIBS);
    const get = async (u, mode) => { if (await libs.match(u)) return; await libs.put(u, await fetch(new Request(u, { mode }))); };
    await Promise.allSettled([...LIB_NOCORS.map(u => get(u, 'no-cors')), ...LIB_CORS.map(u => get(u, 'cors'))]);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('courtstats-core-') && n !== CORE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// La nueva versión espera hasta que el usuario toque "Actualizar" en la app.
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html', { cacheName: CORE }).then(r => r || fetch(req)));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.open(CORE).then(async c => (await c.match(req)) || fetch(req)));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(LIBS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
  }
});
