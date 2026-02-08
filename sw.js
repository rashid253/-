// Service Worker for Dynamic Business Card PWA
// Version: 5.0 - Multi-Business Support

const CACHE_VERSION = 'business-pwa-dynamic-v5';
const CACHE_NAME = `${CACHE_VERSION}-cache`;

// Essential files to cache (no icons needed - they're dynamic)
const ESSENTIAL_FILES = [
  './',
  './card.html',
  './manifest.json',
  './offline.html'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing for business PWA:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache essential files
      caches.open(CACHE_NAME)
        .then(cache => {
          console.log('[Service Worker] Caching essential files');
          return cache.addAll(ESSENTIAL_FILES.map(url => 
            new Request(url, { cache: 'reload' })
          ));
        }),
      // Activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating:', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete old business caches
            if (cacheName.startsWith('business-pwa-') && cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - smart caching for dynamic content
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  
  // Handle different types of requests
  if (isEssentialFile(request)) {
    // Essential files - cache first
    event.respondWith(serveEssentialFile(request));
  } else if (isCardPageWithId(request)) {
    // Card.html with business ID - special dynamic handling
    event.respondWith(serveDynamicCardPage(request));
  } else if (isExternalResource(request)) {
    // External resources - network first
    event.respondWith(serveExternalResource(request));
  } else {
    // Other requests - network first with cache fallback
    event.respondWith(serveNetworkFirst(request));
  }
});

// Check if request is for essential file
function isEssentialFile(request) {
  const url = new URL(request.url);
  return ESSENTIAL_FILES.some(file => 
    url.pathname.endsWith(file.replace('./', '')) ||
    url.href.includes(file.replace('./', ''))
  );
}

// Check if request is for card.html with business ID
function isCardPageWithId(request) {
  const url = new URL(request.url);
  return url.pathname.includes('card.html') && url.search.includes('id=');
}

// Check if request is for external resource
function isExternalResource(request) {
  const url = new URL(request.url);
  const externalDomains = [
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com',
    'dfvnefbxgayxqgjjgtrr.supabase.co'
  ];
  
  return externalDomains.some(domain => url.hostname.includes(domain));
}

// Serve essential files (cache first)
async function serveEssentialFile(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      updateCacheInBackground(request);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache the response
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Essential file fetch failed:', error);
    
    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match('./offline.html');
    }
    
    throw error;
  }
}

// Serve dynamic card pages (network first, cache fallback)
async function serveDynamicCardPage(request) {
  try {
    // Always try network first for dynamic business pages
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Dynamic page fetch failed, trying cache:', request.url);
    
    // Try to get from cache
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

// Serve external resources (network first, cache fallback)
async function serveExternalResource(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses (but don't block)
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME)
        .then(cache => cache.put(request, responseClone))
        .catch(err => console.log('[Service Worker] Cache write error:', err));
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] External resource failed, trying cache:', request.url);
    
    // Try cache
    return caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      });
  }
}

// Serve other requests (network first with cache fallback)
async function serveNetworkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network request failed, trying cache:', request.url);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For HTML requests, return offline page
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match('./offline.html');
    }
    
    throw error;
  }
}

// Update cache in background
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response);
    }
  } catch (error) {
    // Silently fail - background update
  }
}

// Handle offline fallback for navigation requests
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('./offline.html'))
    );
  }
});

// Handle messages from the page
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => console.log('[Service Worker] Cache cleared'))
      .catch(err => console.error('[Service Worker] Cache clear failed:', err));
  }
});

// Handle push notifications
self.addEventListener('push', event => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'New update from your business app',
        icon: data.icon || './icon-192.png',
        badge: './icon-72.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || './',
          timestamp: Date.now()
        },
        actions: [
          {
            action: 'open',
            title: 'Open App'
          }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'Business App', options)
      );
    } catch (error) {
      console.log('[Service Worker] Push data parsing failed:', error);
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || './';
    
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        // Check if there's already a window/tab open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// Periodic cache cleanup (optional - for advanced use)
async function cleanupOldCacheEntries() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const cachedDate = new Date(dateHeader).getTime();
          if (cachedDate < oneWeekAgo) {
            await cache.delete(request);
          }
        }
      }
    }
  } catch (error) {
    console.log('[Service Worker] Cache cleanup failed:', error);
  }
}

// Optional: Background sync (if browser supports it)
if ('SyncManager' in self) {
  self.addEventListener('sync', event => {
    if (event.tag === 'sync-business-data') {
      console.log('[Service Worker] Background sync triggered');
      // Implement background sync logic here
    }
  });
}

// Listen for PWA install event
self.addEventListener('appinstalled', event => {
  console.log('[Service Worker] PWA was installed');
  
  // Clear old caches on new installation
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME) {
          return caches.delete(cacheName);
        }
      })
    );
  });
});
