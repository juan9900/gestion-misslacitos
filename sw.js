// Permite abrir la app sin internet. Cambia VERSION cuando publiques cambios.
const VERSION = 'ml-v11';
const BASE = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
// Librerías y fuentes (con versión fija): se guardan la primera vez que se usan.
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = req.url;
  if (req.method !== 'GET') return;
  const propio = url.startsWith(self.location.origin);
  const cdn = CDN.some(p => url.startsWith(p));
  // Todo lo demás (por ejemplo la base de datos de Supabase) va directo a internet, sin guardar.
  if (!propio && !cdn) return;

  if (cdn) {
    // Archivos con versión fija: primero lo guardado.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
      return res;
    })));
    return;
  }

  // Archivos de la app: primero internet (para recibir cambios). Si ya hay una copia guardada y la red
  // tarda más de 3 segundos, se abre la copia guardada; la respuesta que llegue tarde actualiza la copia.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (!guardado) {
      return red.catch(() => req.mode === 'navigate'
        ? cache.match('index.html').then(r => r || Response.error())
        : Response.error());
    }
    e.waitUntil(red.catch(() => {}));
    return Promise.race([
      red.then(res => (res && res.ok) ? res : guardado).catch(() => guardado),
      new Promise(r => setTimeout(() => r(guardado), 3000))
    ]);
  })());
});
