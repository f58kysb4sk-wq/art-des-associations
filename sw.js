/* L’Art des Associations — service worker
   Pour forcer une nouvelle version de l’application après une modification du code,
   changez simplement le numéro ci-dessous (les palettes publiées depuis l’administration
   n’en ont pas besoin : elles sont toujours chargées en priorité depuis le réseau). */
const VERSION = 'ada-2026-11-23-1';
const SHELL = VERSION + '-shell';
const MEDIA = 'ada-media-v1';
const FONTS = 'ada-fonts-v1';
const PRECACHE = [
  './', 'index.html', 'assets/app.css', 'assets/core.js', 'assets/app.js', 'data/catalogue.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg', 'icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.endsWith('-shell') && k !== SHELL).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

/* Réseau d’abord (contenu toujours à jour), copie locale si hors connexion. */
async function networkFirst(req, preload) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([preload || fetch(req), timeout(6000)]).then((r) => r || fetch(req));
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
    throw err;
  }
}

/* Cache d’abord pour les images et polices (fichiers qui ne changent pas). */
async function cacheFirst(req, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) {
    cache.put(req, res.clone());
    if (max) cache.keys().then((keys) => { if (keys.length > max) cache.delete(keys[0]); });
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes('/admin/')) return; // l’administration n’est jamais mise en cache
    if (url.searchParams.has('apercu')) return;
    if (url.pathname.includes('/media/') || url.pathname.includes('/icons/')) { e.respondWith(cacheFirst(req, MEDIA, 400)); return; }
    e.respondWith(networkFirst(req, req.mode === 'navigate' ? e.preloadResponse : null));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req, FONTS, 40));
  }
});
