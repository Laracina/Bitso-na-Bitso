/**
 * Service Worker Évolué - Bitchô Na Bitchô (Tendance 2026)
 * Stratégie : Stale-While-Revalidate & Network Intercept pour Mode Déconnecté
 */

const CACHE_NAME = 'bitcho-cache-v1';
const ASSETS_TO_CACHE = [
  '',
  'index(2).html',
  'IB.css',
  'IB.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Phase d'installation : Mise en cache du Shell applicatif
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Phase d'activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de Fetch : Stale-While-Revalidate pour les assets
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes vers l'API externe ou Supabase pour le cache classique
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Lance la mise à jour en arrière-plan
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Silencieux si hors ligne */});
        
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

// Événement Background Sync pour la resynchronisation automatique en ligne
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(self.registration.showNotification('Bitchô Na Bitchô', {
      body: 'Connexion retrouvée : Synchronisation de vos opérations financières en cours...',
      icon: 'icons/icon-192x192.png'
    }));
  }
});