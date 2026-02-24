import { useState, useEffect, useCallback } from 'react';
import { getMessagingIfSupported, getToken, onMessage } from '../config/firebase';

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;

export const usePushNotifications = ({ userId, userType, socket }) => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notificationSupported, setNotificationSupported] = useState(false); 

  // Check support asynchronously on mount
  useEffect(() => {
    const checkSupport = async () => {
      if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
      }
      const messaging = await getMessagingIfSupported();
      if (!messaging) {
        console.warn('Firebase Messaging not supported on this browser');
        return;
      }
      setNotificationSupported(true);
    };

    checkSupport();
  }, []);

  const requestPermission = useCallback(async () => {
    if (!notificationSupported) {
      console.warn('Notifications not supported');
      return null;
    }

    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging) return null;

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        console.log('FCM Token:', token);
        setFcmToken(token);

        if (socket && userId && userType) {
          socket.emit('saveFcmToken', { userId, userType, fcmToken: token });
        }

        return token;
      }

      return null;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return null;
    }
  }, [userId, userType, socket, notificationSupported]);

  // ✅ Foreground message listener
  useEffect(() => {
    if (!notificationSupported) return;

    let unsubscribe = null;

    const setupListener = async () => {
      const messaging = await getMessagingIfSupported();
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message:', payload);
        if (payload.notification) {
          const { title, body } = payload.notification;
          new Notification(title, {
            body,
            icon: '/logo192.png',
            badge: '/logo192.png',
            data: payload.data,
          });
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [notificationSupported]);

  return {
    fcmToken,
    permission,
    notificationSupported,
    requestPermission,
  };
};