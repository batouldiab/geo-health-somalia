/* Service worker for the Bakool facility finder: offline after the first visit.
 *
 * Two caches. The small one (page, hashed bundles, data files, manifest) is versioned
 * by VERSION and rebuilt when the data changes. The large one (/models/, /ort/, /voice/:
 * the speech model, the ONNX runtime and any clips, about 70 MB) is kept across data
 * versions, so updating the facility list costs 55 KB and never a re-download of the
 * model. On install, the finder page, the hashed scripts and stylesheets it names and
 * the data files are pre-cached. At run time every same-origin GET is served cache-first
 * and stored when fetched. Nothing cross-origin is cached: the finder has no basemap, so
 * it needs nothing from another host. A navigation that fails falls back to the cached
 * finder page. Bump VERSION when data files or this file change.
 */
const VERSION = 'geo-health-finder-v3';
const MODELS = 'geo-health-models-v1';
const PAGE = '/finder.html';
const PRECACHE = [
  PAGE,
  '/finder.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/data/access10_v1.json.gz',
  '/data/facilities_v1.json.gz',
  '/data/places_bakool_v1.json.gz',
  '/data/adm2_bakool_v1.json.gz',
];

function isModelFile(pathname) {
  return pathname.startsWith('/models/') || pathname.startsWith('/ort/') || pathname.startsWith('/voice/');
}

/** the hashed script and stylesheet files the page references (Vite renames them on every build) */
async function pageAssets(cache) {
  const page = await cache.match(PAGE);
  if (!page) return [];
  const html = await page.text();
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then(async (cache) => {
        await Promise.allSettled(PRECACHE.map((u) => cache.add(u)));
        await Promise.allSettled((await pageAssets(cache)).map((u) => cache.add(u)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MODELS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function store(cacheName, req, res) {
  const copy = res.clone();
  // a partial (206) response to a media range request cannot be stored; ignore that quietly
  caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => undefined);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // the finder page is kept fresh online; with no network, any navigation lands on the saved finder
    event.respondWith(
      fetch(req).then((res) => {
        if (url.pathname === PAGE && res.ok) store(VERSION, PAGE, res);
        return res;
      }).catch(() => caches.match(PAGE)),
    );
    return;
  }

  const cacheName = isModelFile(url.pathname) ? MODELS : VERSION;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // a hosting fallback that answers a missing file with the HTML page must not be kept as that file
        const html = (res.headers.get('content-type') || '').includes('text/html');
        if (res.ok && !html && (res.type === 'basic' || res.type === 'default')) store(cacheName, req, res);
        return res;
      });
    }),
  );
});
