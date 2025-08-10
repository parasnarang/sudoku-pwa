const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `sudoku-master-v${CACHE_VERSION}`;
const STATIC_CACHE = `sudoku-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `sudoku-dynamic-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `sudoku-runtime-v${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/sudoku-engine.js',
    '/js/sudoku-generator.js',
    '/js/storage.js',
    '/js/settings-manager.js',
    '/js/user-progress.js',
    '/js/calendar-ui.js',
    '/js/tournament-ui.js',
    '/js/app-router.js',
    '/js/game-ui.js',
    '/images/icons/icon-192x192.png',
    '/images/icons/icon-512x512.png'
];

const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only',
    CACHE_ONLY: 'cache-only'
};

const ROUTE_PATTERNS = [
    { pattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i, strategy: CACHE_STRATEGIES.CACHE_FIRST, cache: STATIC_CACHE },
    { pattern: /\.(?:css|js)$/i, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, cache: STATIC_CACHE },
    { pattern: /\/api\//, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cache: DYNAMIC_CACHE },
    { pattern: /\/data\//, strategy: CACHE_STRATEGIES.NETWORK_FIRST, cache: DYNAMIC_CACHE },
    { pattern: /manifest\.json$/i, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, cache: STATIC_CACHE }
];

const OFFLINE_FALLBACK = '/index.html';
const OFFLINE_PAGE_URL = '/offline.html';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_MAX_ENTRIES = 100;

// Service Worker Installation
self.addEventListener('install', event => {
    console.log(`[SW] Installing Service Worker v${CACHE_VERSION}`);
    
    event.waitUntil(
        Promise.all([
            cacheStaticAssets(),
            createOfflinePage(),
            self.skipWaiting()
        ])
    );
});

async function cacheStaticAssets() {
    try {
        const cache = await caches.open(STATIC_CACHE);
        console.log('[SW] Caching static assets');
        
        const responses = await Promise.allSettled(
            STATIC_ASSETS.map(url => 
                fetch(url).then(response => {
                    if (response.ok) {
                        return cache.put(url, response);
                    }
                    throw new Error(`Failed to fetch ${url}: ${response.status}`);
                }).catch(error => {
                    console.warn(`[SW] Failed to cache ${url}:`, error);
                })
            )
        );
        
        console.log('[SW] Static assets cached successfully');
        return responses;
    } catch (error) {
        console.error('[SW] Failed to cache static assets:', error);
        throw error;
    }
}

async function createOfflinePage() {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const offlineHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sudoku Master - Offline</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 2rem;
        }
        .offline-content {
            max-width: 400px;
        }
        .offline-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 { margin-bottom: 1rem; }
        p { margin-bottom: 2rem; line-height: 1.6; opacity: 0.9; }
        .retry-btn {
            background: rgba(255,255,255,0.2);
            border: 2px solid rgba(255,255,255,0.3);
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
        }
        .retry-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="offline-content">
        <div class="offline-icon">📱</div>
        <h1>You're Offline</h1>
        <p>Don't worry! You can still play Sudoku. Your progress will sync when you're back online.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry Connection</button>
    </div>
</body>
</html>`;
        
        const response = new Response(offlineHTML, {
            headers: { 'Content-Type': 'text/html' }
        });
        
        await cache.put(OFFLINE_PAGE_URL, response);
        console.log('[SW] Offline page created');
    } catch (error) {
        console.error('[SW] Failed to create offline page:', error);
    }
}

// Service Worker Activation
self.addEventListener('activate', event => {
    console.log(`[SW] Activating Service Worker v${CACHE_VERSION}`);
    
    event.waitUntil(
        Promise.all([
            cleanupOldCaches(),
            self.clients.claim()
        ])
    );
});

async function cleanupOldCaches() {
    try {
        const cacheNames = await caches.keys();
        const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, RUNTIME_CACHE];
        
        const deletePromises = cacheNames
            .filter(cacheName => !currentCaches.includes(cacheName))
            .map(cacheName => {
                console.log('[SW] Deleting old cache:', cacheName);
                return caches.delete(cacheName);
            });
        
        await Promise.all(deletePromises);
        console.log('[SW] Cache cleanup completed');
        
        // Cleanup old entries in current caches
        await cleanupCacheEntries();
    } catch (error) {
        console.error('[SW] Cache cleanup failed:', error);
    }
}

async function cleanupCacheEntries() {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        if (requests.length > CACHE_MAX_ENTRIES) {
            const requestsWithDates = await Promise.all(
                requests.map(async request => ({
                    request,
                    response: await cache.match(request)
                }))
            );
            
            // Sort by date header or use current time as fallback
            requestsWithDates.sort((a, b) => {
                const dateA = new Date(a.response.headers.get('date') || Date.now());
                const dateB = new Date(b.response.headers.get('date') || Date.now());
                return dateA - dateB;
            });
            
            // Remove oldest entries
            const entriesToRemove = requestsWithDates.slice(0, requests.length - CACHE_MAX_ENTRIES);
            await Promise.all(
                entriesToRemove.map(entry => cache.delete(entry.request))
            );
            
            console.log(`[SW] Removed ${entriesToRemove.length} old cache entries`);
        }
    } catch (error) {
        console.error('[SW] Failed to cleanup cache entries:', error);
    }
}

// Fetch Event Handler
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip cross-origin requests
    if (url.origin !== location.origin) return;

    // Handle different request types
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(handleCacheFirst(request, STATIC_CACHE));
    } else {
        const route = ROUTE_PATTERNS.find(pattern => pattern.pattern.test(url.pathname));
        
        if (route) {
            event.respondWith(handleRequest(request, route.strategy, route.cache));
        } else {
            // Default strategy for unknown routes
            event.respondWith(handleCacheFirst(request, RUNTIME_CACHE));
        }
    }
});

async function handleRequest(request, strategy, cacheName) {
    switch (strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
            return handleCacheFirst(request, cacheName);
        case CACHE_STRATEGIES.NETWORK_FIRST:
            return handleNetworkFirst(request, cacheName);
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
            return handleStaleWhileRevalidate(request, cacheName);
        case CACHE_STRATEGIES.NETWORK_ONLY:
            return fetch(request);
        case CACHE_STRATEGIES.CACHE_ONLY:
            return caches.match(request);
        default:
            return handleCacheFirst(request, cacheName);
    }
}

async function handleCacheFirst(request, cacheName) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse && !isExpired(cachedResponse)) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(cacheName);
            const responseToCache = networkResponse.clone();
            
            // Add timestamp header
            const headers = new Headers(responseToCache.headers);
            headers.set('sw-cache-timestamp', Date.now().toString());
            
            const timestampedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });
            
            await cache.put(request, timestampedResponse);
        }
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Cache first strategy failed:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return handleOfflineFallback(request);
    }
}

async function handleNetworkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Network first fallback to cache:', request.url);
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return handleOfflineFallback(request);
    }
}

async function handleStaleWhileRevalidate(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await caches.match(request);
        
        const fetchPromise = fetch(request).then(response => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        }).catch(error => {
            console.warn('[SW] Background fetch failed:', error);
            return null;
        });

        return cachedResponse || await fetchPromise || handleOfflineFallback(request);
    } catch (error) {
        console.error('[SW] Stale while revalidate failed:', error);
        return handleOfflineFallback(request);
    }
}

async function handleOfflineFallback(request) {
    const url = new URL(request.url);
    
    if (request.destination === 'document') {
        const offlinePage = await caches.match(OFFLINE_PAGE_URL);
        return offlinePage || caches.match(OFFLINE_FALLBACK);
    }
    
    if (request.destination === 'image') {
        return new Response('', {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'image/svg+xml' }
        });
    }
    
    return new Response(JSON.stringify({
        error: 'offline',
        message: 'This content is not available offline',
        url: url.pathname
    }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
    });
}

function isExpired(response) {
    const timestamp = response.headers.get('sw-cache-timestamp');
    if (!timestamp) return false;
    
    const age = Date.now() - parseInt(timestamp);
    return age > CACHE_MAX_AGE;
}

// Background Sync
self.addEventListener('sync', event => {
    console.log('[SW] Background sync event:', event.tag);
    
    switch (event.tag) {
        case 'sudoku-progress-sync':
            event.waitUntil(syncUserProgress());
            break;
        case 'sudoku-achievements-sync':
            event.waitUntil(syncAchievements());
            break;
        case 'sudoku-settings-sync':
            event.waitUntil(syncSettings());
            break;
        default:
            console.log('[SW] Unknown sync tag:', event.tag);
    }
});

async function syncUserProgress() {
    try {
        console.log('[SW] Syncing user progress...');
        
        // Get pending sync data from IndexedDB or cache
        const pendingData = await getPendingSyncData('progress');
        if (!pendingData) return;
        
        // Attempt to sync with server (if available)
        const success = await attemptServerSync('/api/sync/progress', pendingData);
        
        if (success) {
            await clearPendingSyncData('progress');
            console.log('[SW] User progress synced successfully');
            
            // Notify clients of successful sync
            await notifyClients('SYNC_SUCCESS', { type: 'progress' });
        }
    } catch (error) {
        console.error('[SW] Failed to sync user progress:', error);
        await notifyClients('SYNC_FAILED', { type: 'progress', error: error.message });
    }
}

async function syncAchievements() {
    try {
        console.log('[SW] Syncing achievements...');
        
        const pendingData = await getPendingSyncData('achievements');
        if (!pendingData) return;
        
        const success = await attemptServerSync('/api/sync/achievements', pendingData);
        
        if (success) {
            await clearPendingSyncData('achievements');
            console.log('[SW] Achievements synced successfully');
            await notifyClients('SYNC_SUCCESS', { type: 'achievements' });
        }
    } catch (error) {
        console.error('[SW] Failed to sync achievements:', error);
        await notifyClients('SYNC_FAILED', { type: 'achievements', error: error.message });
    }
}

async function syncSettings() {
    try {
        console.log('[SW] Syncing settings...');
        
        const pendingData = await getPendingSyncData('settings');
        if (!pendingData) return;
        
        const success = await attemptServerSync('/api/sync/settings', pendingData);
        
        if (success) {
            await clearPendingSyncData('settings');
            console.log('[SW] Settings synced successfully');
            await notifyClients('SYNC_SUCCESS', { type: 'settings' });
        }
    } catch (error) {
        console.error('[SW] Failed to sync settings:', error);
        await notifyClients('SYNC_FAILED', { type: 'settings', error: error.message });
    }
}

async function getPendingSyncData(type) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const response = await cache.match(`/sync/${type}`);
        return response ? await response.json() : null;
    } catch (error) {
        console.error(`[SW] Failed to get pending sync data for ${type}:`, error);
        return null;
    }
}

async function attemptServerSync(endpoint, data) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        return response.ok;
    } catch (error) {
        console.warn('[SW] Server sync failed, will retry later:', error);
        return false;
    }
}

async function clearPendingSyncData(type) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.delete(`/sync/${type}`);
    } catch (error) {
        console.error(`[SW] Failed to clear pending sync data for ${type}:`, error);
    }
}

// Push Notifications
self.addEventListener('push', event => {
    console.log('[SW] Push notification received');
    
    const options = {
        body: 'Time for your daily Sudoku challenge!',
        icon: '/images/icons/icon-192x192.png',
        badge: '/images/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1',
            url: '/'
        },
        actions: [
            {
                action: 'play-now',
                title: 'Play Now',
                icon: '/images/icons/play-icon.png'
            },
            {
                action: 'dismiss',
                title: 'Later',
                icon: '/images/icons/dismiss-icon.png'
            }
        ],
        requireInteraction: true
    };
    
    if (event.data) {
        try {
            const pushData = event.data.json();
            Object.assign(options, pushData);
        } catch (error) {
            console.error('[SW] Failed to parse push data:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification('Sudoku Master', options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'play-now') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(clientList => {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                return clients.openWindow('/');
            })
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification
        return;
    } else {
        // Default action - open app
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(clientList => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow('/');
            })
        );
    }
});

// Message Handling
self.addEventListener('message', event => {
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CHECK_UPDATE':
            event.ports[0].postMessage({
                type: 'UPDATE_STATUS',
                hasUpdate: false,
                version: CACHE_VERSION
            });
            break;
            
        case 'CACHE_DAILY_PUZZLE':
            event.waitUntil(cacheDailyPuzzle(data));
            break;
            
        case 'SCHEDULE_SYNC':
            event.waitUntil(scheduleBackgroundSync(data.tag, data.data));
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(clearSpecificCache(data.cacheName));
            break;
            
        default:
            console.log('[SW] Unknown message type:', type);
    }
});

async function cacheDailyPuzzle(puzzleData) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const response = new Response(JSON.stringify(puzzleData), {
            headers: {
                'Content-Type': 'application/json',
                'sw-cache-timestamp': Date.now().toString()
            }
        });
        
        await cache.put(`/puzzle/daily/${puzzleData.date}`, response);
        console.log('[SW] Daily puzzle cached:', puzzleData.date);
    } catch (error) {
        console.error('[SW] Failed to cache daily puzzle:', error);
    }
}

async function scheduleBackgroundSync(tag, data) {
    try {
        if (data) {
            const cache = await caches.open(DYNAMIC_CACHE);
            const response = new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' }
            });
            await cache.put(`/sync/${tag.replace('sudoku-', '').replace('-sync', '')}`, response);
        }
        
        await self.registration.sync.register(tag);
        console.log('[SW] Background sync scheduled:', tag);
    } catch (error) {
        console.error('[SW] Failed to schedule background sync:', error);
    }
}

async function clearSpecificCache(cacheName) {
    try {
        const success = await caches.delete(cacheName);
        console.log(`[SW] Cache ${cacheName} cleared:`, success);
        await notifyClients('CACHE_CLEARED', { cacheName, success });
    } catch (error) {
        console.error(`[SW] Failed to clear cache ${cacheName}:`, error);
    }
}

async function notifyClients(type, data) {
    try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach(client => {
            client.postMessage({ type, data, timestamp: Date.now() });
        });
    } catch (error) {
        console.error('[SW] Failed to notify clients:', error);
    }
}

// Periodic Background Tasks
self.addEventListener('periodicsync', event => {
    if (event.tag === 'daily-cleanup') {
        event.waitUntil(performDailyCleanup());
    }
});

async function performDailyCleanup() {
    try {
        console.log('[SW] Performing daily cleanup...');
        
        await cleanupCacheEntries();
        await cleanupExpiredData();
        
        console.log('[SW] Daily cleanup completed');
    } catch (error) {
        console.error('[SW] Daily cleanup failed:', error);
    }
}

async function cleanupExpiredData() {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response && isExpired(response)) {
                await cache.delete(request);
                console.log('[SW] Removed expired cache entry:', request.url);
            }
        }
    } catch (error) {
        console.error('[SW] Failed to cleanup expired data:', error);
    }
}

console.log(`[SW] Service Worker v${CACHE_VERSION} loaded`);