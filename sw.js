'use strict';

const CACHE = 'rjbus-shell-v6';
const FILES = ['./', './index.html', './style.css?v=3', './app.js?v=5', './map.js?v=4', './core.js?v=3', './config.js?v=3', './data/network.json?v=3', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => (key.startsWith('rjbus-shell-') || key === 'rjbus-v1') && key !== CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const allowed = new Set(FILES.map(file => new URL(file, self.registration.scope).href));
  if (event.request.method !== 'GET' || !allowed.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request);
      return cached || new Response('Sem conexão. Abra o RJ Bus online uma vez para preparar o acesso offline.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
