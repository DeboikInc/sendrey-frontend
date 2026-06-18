importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyC3mfmOxYuYKEqOknxD9Gj1c87uA84PCf4",
    authDomain: "sendrey-6f52d.firebaseapp.com",
    projectId: "sendrey-6f52d",
    storageBucket: "sendrey-6f52d.firebasestorage.app",
    messagingSenderId: "614208198291",
    appId: "1:614208198291:web:7bc336ca0828e7744d5f66",
    measurementId: "G-LTLJNR3FXL"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message:', payload);

    const title = payload.notification?.title || payload.data?.type || 'Sendrey';
    const body = payload.notification?.body || '';

    const notificationOptions = {
        body,
        icon: '/public/Sendrey-Logo-Variants-09.png',
        badge: '/public/Sendrey-Logo-Variants-09.png',
        data: payload.data,
        tag: payload.data?.chatId || 'default',
        requireInteraction: true,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    // console.log(' Notification clicked:', event.notification.data);
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