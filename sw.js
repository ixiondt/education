// Letters & Numbers — Service Worker
// Cache-first for app shell, stale-while-revalidate for fonts/audio.

const VERSION = 'lnum-v5.17';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './letters.js',
  './world.js',
  './curriculum.js',
  // v5.16 — game engine + first game (Letter Lander)
  './game-engine.js',
  './game-letter-lander.js',
  // v5.17 — full arcade Math Blaster homage
  './game-number-blaster.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

// ----- Install: precache app shell ------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ----- Activate: clean old versions, then tell open tabs to reload --
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        /* Notify each open tab that a new version is ready. The page
           listens for this and does a single soft reload, so users don't
           have to manually unregister the SW after every deploy. */
        clients.forEach((c) => c.postMessage({ type: 'NEW_VERSION', version: VERSION }));
      })
  );
});

// ----- Fetch ----------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Stale-while-revalidate for Google Fonts (cached after first online load)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Cache custom audio drop-ins on first load
  if (url.pathname.includes('/audio/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Same-origin app shell + assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Anything else: network, fall back to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp.ok && resp.type !== 'opaque') {
      const cache = await caches.open(VERSION);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    // Last-ditch: try the app shell for navigations (offline navigation fallback)
    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((resp) => {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ----- Update prompt support ------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
