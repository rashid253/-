// ============================================
// DUBAI ROYAL COMMERCE - SERVICE WORKER v2.0
// Premium PWA with Offline Support & Push Notifications
// ============================================

const CACHE_NAME = 'dubai-royal-v1';
const STATIC_CACHE = 'dubai-static-v1';
const DYNAMIC_CACHE = 'dubai-dynamic-v1';
const API_CACHE = 'dubai-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/card.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',
  'https://unpkg.com/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js'
];

// Image domains to cache
const IMAGE_DOMAINS = [
  'images.unsplash.com',
  'plus.unsplash.com'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate Event - Clean Old Caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
            .map((key) => {
              console.log('[Service Worker] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch Event - Cache Strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Handle API requests (Supabase)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Handle image requests
  if (event.request.destination === 'image' || IMAGE_DOMAINS.some(domain => url.hostname.includes(domain))) {
    event.respondWith(handleImageRequest(event.request));
    return;
  }
  
  // Handle page navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }
  
  // Handle static assets
  event.respondWith(handleStaticRequest(event.request));
});

// ========== HANDLE API REQUESTS (Supabase) ==========
async function handleApiRequest(request) {
  // Network First, then cache
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] API fetch failed, serving from cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for API
    return new Response(
      JSON.stringify({ error: 'You are offline. Please check your connection.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ========== HANDLE IMAGE REQUESTS ==========
async function handleImageRequest(request) {
  // Cache First, then Network
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a placeholder image when offline
    return new Response(
      '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#f1f5f9"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="#64748b" text-anchor="middle">Image Offline</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// ========== HANDLE NAVIGATION REQUESTS ==========
async function handleNavigationRequest(request) {
  // Network First, fallback to cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Navigation fetch failed, serving from cache:', error);
    
    // Try to get from cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to card.html
    const fallbackResponse = await caches.match('/card.html');
    if (fallbackResponse) {
      return fallbackResponse;
    }
    
    // Ultimate fallback - offline page
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Dubai Royal Commerce</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: 'Inter', sans-serif;
              background: linear-gradient(135deg, #bf9530, #aa771c);
              color: white;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
              text-align: center;
            }
            .offline-card {
              background: rgba(255,255,255,0.95);
              border-radius: 32px;
              padding: 40px;
              max-width: 400px;
              box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            }
            h1 { color: #bf9530; margin-bottom: 20px; }
            p { color: #1e293b; margin-bottom: 30px; }
            button {
              background: linear-gradient(135deg, #bf9530, #aa771c);
              color: white;
              border: none;
              padding: 14px 32px;
              border-radius: 40px;
              font-weight: 700;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="offline-card">
            <i class="fas fa-crown" style="font-size: 48px; color: #bf9530;"></i>
            <h1>You're Offline</h1>
            <p>Please check your internet connection to continue shopping at Dubai Royal Commerce.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// ========== HANDLE STATIC ASSETS ==========
async function handleStaticRequest(request) {
  // Cache First, then Network
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Static asset fetch failed:', error);
    return new Response('', { status: 404 });
  }
}

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Dubai Royal Commerce',
        body: event.data.text(),
        icon: 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=192',
        badge: 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=192'
      };
    }
  }
  
  const options = {
    body: data.body || 'New update from Dubai Royal Commerce',
    icon: data.icon || 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=192',
    badge: data.badge || 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=192',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/card.html',
      timestamp: new Date().getTime(),
      businessId: data.businessId || null
    },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'track', title: 'Track Order' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: 'dubai-royal',
    renotify: true,
    requireInteraction: true,
    silent: false
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Dubai Royal Commerce',
      options
    )
  );
});

// ========== NOTIFICATION CLICK HANDLER ==========
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/card.html';
  
  if (event.action === 'dismiss') {
    return;
  }
  
  if (event.action === 'track') {
    // Open tracking page
    event.waitUntil(
      clients.openWindow('/card.html?page=track')
    );
    return;
  }
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
  
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

// Sync orders when back online
async function syncOrders() {
  try {
    const cache = await caches.open('pending-orders');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      const orderData = await response.json();
      
      // Send to Supabase
      const fetchResponse = await fetch(request.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });
      
      if (fetchResponse.ok) {
        await cache.delete(request);
        
        // Notify user
        self.registration.showNotification('Order Synced', {
          body: 'Your order has been placed successfully!',
          icon: 'https://images.unsplash.com/photo-1580757468214-c73f7062a5cb?w=192'
        });
      }
    }
  } catch (error) {
    console.log('[Service Worker] Sync failed:', error);
  }
}

// Sync cart when back online
async function syncCart() {
  // Implement cart sync logic
  console.log('[Service Worker] Syncing cart...');
}

// ========== PERIODIC BACKGROUND SYNC ==========
self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic sync:', event.tag);
  
  if (event.tag === 'check-deliveries') {
    event.waitUntil(checkDeliveryUpdates());
  }
});

// Check for delivery updates periodically
async function checkDeliveryUpdates() {
  try {
    const clients = await self.clients.matchAll();
    
    // Notify clients to check deliveries
    clients.forEach(client => {
      client.postMessage({
        type: 'CHECK_DELIVERIES',
        timestamp: new Date().getTime()
      });
    });
  } catch (error) {
    console.log('[Service Worker] Periodic check failed:', error);
  }
}

// ========== MESSAGE HANDLER ==========
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(DYNAMIC_CACHE)
        .then(() => {
          console.log('[Service Worker] Dynamic cache cleared');
        })
    );
  }
  
  if (event.data.type === 'GET_CACHE_STATUS') {
    event.ports[0].postMessage({
      cacheName: CACHE_NAME,
      staticCache: STATIC_CACHE,
      dynamicCache: DYNAMIC_CACHE,
      apiCache: API_CACHE
    });
  }
});

// ========== ONLINE/OFFLINE DETECTION ==========
self.addEventListener('online', () => {
  console.log('[Service Worker] Back online');
  
  // Trigger background sync
  self.registration.sync.register('sync-orders').catch(() => {});
  self.registration.sync.register('sync-cart').catch(() => {});
});

self.addEventListener('offline', () => {
  console.log('[Service Worker] Offline mode active');
});

console.log('[Service Worker] Dubai Royal Commerce SW loaded');
