// Permite abrir la app sin internet. Cambia VERSION cuando publiques cambios.
const VERSION = 'ml-v7';
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

  // Archivos de la app: primero internet (para recibir cambios); sin internet, lo guardado.
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
