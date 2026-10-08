// NETLOG Service Worker : coque d'application hors ligne.
// Ne touche jamais aux appels Supabase ni aux autres domaines.
const CACHE = 'netlog-shell-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Uniquement les GET du même domaine : Supabase, polices, CDN... passent sans interception
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Fichiers du build (noms hashés) : cache d'abord, sinon réseau puis mise en cache
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Pages : réseau d'abord (toujours la dernière version), cache en secours hors ligne
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(new URL('./', self.location).href))
        )
    );
  }
});
