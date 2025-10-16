// Service Worker for Push Notifications
// Multi-Room Chat - GitHub Copilot Implementation

console.log('Service Worker loaded');

// Install event - cache basic resources
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { 
                title: 'Nowa wiadomość', 
                body: event.data.text() || 'Masz nową wiadomość w czacie!'
            };
        }
    }

    const options = {
        title: data.title || 'Multi-Room Chat',
        body: data.body || 'Nowa wiadomość w czacie!',
        icon: '/css/chat-icon.png',
        badge: '/css/chat-badge.png',
        data: {
            url: data.url || '/',
            room: data.room || 'general',
            username: data.username || 'Użytkownik'
        },
        actions: [
            {
                action: 'open',
                title: 'Otwórz czat',
                icon: '/css/open-icon.png'
            },
            {
                action: 'close',
                title: 'Zamknij',
                icon: '/css/close-icon.png'
            }
        ],
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(options.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Default action or 'open' action
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Check if chat is already open
                for (let client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new chat window
                if (clients.openWindow) {
                    const url = event.notification.data?.url || '/';
                    return clients.openWindow(url);
                }
            })
    );
});

// Background sync for offline message queue (future feature)
self.addEventListener('sync', event => {
    console.log('Background sync triggered:', event);
    if (event.tag === 'chat-message-sync') {
        event.waitUntil(syncChatMessages());
    }
});

// Sync offline messages when connection is restored
async function syncChatMessages() {
    try {
        // This would sync any queued messages when online
        console.log('Syncing offline messages...');
        // Implementation for future offline support
    } catch (error) {
        console.error('Error syncing messages:', error);
    }
}

// Message handling from main app
self.addEventListener('message', event => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});