/* global self, URL, Response, fetch */
// Keine Datenspeicherung. Nur gewöhnliche Seitennavigation erhält einen Offline-Hinweis.
self.addEventListener('install', (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await self.caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('zaeme-public-shell-'))
          .map((name) => self.caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.search ||
    !/^\/(?:|welcome|household|inventory(?:\/[\w/-]+)?|shopping(?:\/[\w/-]+)?|capture(?:\/(?:scan|manual))?)$/.test(
      url.pathname,
    )
  )
    return;
  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(
      () =>
        new Response(
          '<!doctype html><html lang="de-CH"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>zäme · Offline</title><main><h1>Keine Netzwerkverbindung</h1><p>Verbinde dich mit dem Internet, um deinen aktuellen Haushalt zu öffnen.</p><a href="/">Erneut öffnen</a></main></html>',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'Referrer-Policy': 'no-referrer',
            },
          },
        ),
    ),
  );
});
