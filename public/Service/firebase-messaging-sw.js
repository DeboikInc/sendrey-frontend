importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    
    apiKey: "AIzaSyB25zioy2uYOixC3CkGpqHRxAxChPL62bM",
    authDomain: "sendrey-cb4e6.firebaseapp.com",
    projectId: "sendrey-cb4e6",
    storageBucket: "sendrey-cb4e6.firebasestorage.app",
    messagingSenderId: "160371187185",
    appId: "1:160371187185:web:b282e7657aeb7079b4b850",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Background message:', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: payload.data,
        tag: payload.data?.chatId || 'default',
        requireInteraction: true,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log(' Notification clicked:', event.notification.data);
    event.notification.close();

    const data = event.notification.data;
    const urlToOpen = data.chatId ? `/chat/${data.chatId}` : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if app is already open
                for (let client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if not
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});