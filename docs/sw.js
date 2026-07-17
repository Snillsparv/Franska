// Service worker: appskal + data i precache, ljud cache-first vid uppspelning.
const VERSION = 'v1';
const SKAL_CACHE = `franska-skal-${VERSION}`;
const LJUD_CACHE = 'franska-ljud-v1';

const SKAL = [
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js', 'js/data.js', 'js/state.js', 'js/audio.js', 'js/srs.js',
  'js/kort.js', 'js/dashboard.js', 'js/nummer.js', 'js/siffror.js',
  'js/uttal.js', 'js/monolog.js', 'js/grammatik.js', 'js/installningar.js',
  'data/ord.json', 'data/kursplan.json', 'data/siffror.json',
  'ikon/ikon.svg', 'ikon/ikon-192.png', 'ikon/ikon-512.png',
];
// innehåll som kan saknas i början — cachea om de finns
const VALFRITT = ['data/uttal.json', 'data/grammatik.json'];
for (let d = 1; d <= 30; d++) VALFRITT.push(`data/monolog/dag_${String(d).padStart(2, '0')}.json`);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(SKAL_CACHE);
    await cache.addAll(SKAL);
    await Promise.allSettled(VALFRITT.map(async f => {
      const svar = await fetch(f);
      if (svar.ok) await cache.put(f, svar);
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const namn of await caches.keys()) {
      if (namn.startsWith('franska-skal-') && namn !== SKAL_CACHE) await caches.delete(namn);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/audio/')) {
    // ljud: cache först, annars nät + spara
    e.respondWith((async () => {
      const cache = await caches.open(LJUD_CACHE);
      const traff = await cache.match(e.request);
      if (traff) return traff;
      const svar = await fetch(e.request);
      if (svar.ok) cache.put(e.request, svar.clone());
      return svar;
    })());
    return;
  }

  // appskal och data: cache först, uppdatera i bakgrunden (stale-while-revalidate)
  e.respondWith((async () => {
    const cache = await caches.open(SKAL_CACHE);
    const begard = e.request.mode === 'navigate' ? 'index.html' : e.request;
    const traff = await cache.match(begard);
    const fromNat = fetch(e.request).then(svar => {
      if (svar.ok) cache.put(begard, svar.clone());
      return svar;
    }).catch(() => null);
    return traff || (await fromNat) || Response.error();
  })());
});
