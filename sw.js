// Service Worker for Digital Business Card App - Dynamic PWA Version
const CACHE_VERSION = 'digital-business-dynamic-v1';
const CACHE_NAME = `${CACHE_VERSION}-cache`;

// Minimal static assets to cache
const STATIC_ASSETS = [
  './',
  './card.html',
  './offline.html'
];

// Install event
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.startsWith('digital-business-') && cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Special handling for card.html with parameters
  if (url.pathname.includes('card.html') && url.search) {
    event.respondWith(serveDynamicPage(request));
    return;
  }
  
  // For other requests
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Update cache in background
          updateCacheInBackground(request);
          return cachedResponse;
        }
        
        return fetch(request)
          .then(networkResponse => {
            // Don't cache external resources or large files
            if (shouldCache(request, networkResponse)) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Return offline page for HTML requests
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('./offline.html');
            }
            throw new Error('Network error');
          });
      })
  );
});

// Serve dynamic pages (card.html with business ID)
async function serveDynamicPage(request) {
  try {
    // Always try network first for dynamic content
    const networkResponse = await fetch(request);
    
    // Cache the response
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Dynamic page fetch failed:', error);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to base card.html
    const fallbackResponse = await caches.match('./card.html');
    if (fallbackResponse) {
      return fallbackResponse;
    }
    
    // Return offline page
    return caches.match('./offline.html');
  }
}

// Check if response should be cached
function shouldCache(request, response) {
  const url = new URL(request.url);
  
  // Don't cache:
  // - External domains (except CDN fonts/icons)
  // - Very large responses
  // - Non-successful responses
  if (!response.ok || response.status !== 200) {
    return false;
  }
  
  // Cache our own pages and assets
  if (url.origin === location.origin) {
    return true;
  }
  
  // Cache essential external resources
  const externalDomains = [
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];
  
  if (externalDomains.some(domain => url.hostname.includes(domain))) {
    return true;
  }
  
  return false;
}

// Update cache in background
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response.ok && shouldCache(request, response)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response);
    }
  } catch (error) {
    // Silently fail - it's a background update
  }
}

// Handle offline fallback
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('./offline.html'))
    );
  }
});

// Handle messages
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
