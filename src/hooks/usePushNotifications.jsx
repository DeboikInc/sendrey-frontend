import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessagingIfSupported, getToken, onMessage } from '../config/firebase';
import appIcon from '../assets/Sendrey-Logo-Variants-09.png';

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;

const isNative = Capacitor.isNativePlatform(); // true on iOS/Android, false on web

export const usePushNotifications = ({ userId, userType, socket, onIncomingCall }) => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notificationSupported, setNotificationSupported] = useState(false);

  // ── Native (Capacitor) setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    const setup = async () => {
      // Register listeners first, before requesting permission
      await PushNotifications.addListener('registration', (token) => {
        console.log('[Push] FCM token:', token.value);
        setFcmToken(token.value);
        setPermission('granted');

        if (socket && userId && userType) {
          socket.emit('saveFcmToken', { userId, userType, fcmToken: token.value });
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err);
      });

      // Foreground notification received
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const data = notification.data;
        console.log('[Push] Foreground notification:', notification);

        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data);
        }
      });

      // Notification tapped (app backgrounded or closed)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data;
        console.log('[Push] Notification tapped:', data);

        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data);
        }
      });

      // Now request permission
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
      } else {
        setPermission('denied');
      }
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [userId, userType, socket, onIncomingCall]);

  // ── Web setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isNative) return;

    const checkSupport = async () => {
      if (!('Notification' in window)) return;
      const messaging = await getMessagingIfSupported();
      if (!messaging) return;
      setNotificationSupported(true);
    };

    checkSupport();
  }, []);

  // Web foreground listener
  useEffect(() => {
    if (isNative || !notificationSupported) return;

    let unsubscribe = null;

    const setupListener = async () => {
      const messaging = await getMessagingIfSupported();
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload) => {
        const data = payload.data;

        // Route incoming call to handler instead of showing dumb notification
        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data);
          return;
        }

        if (payload.notification) {
          const { title, body } = payload.notification;
          new Notification(title, { body, icon: appIcon, badge: appIcon, data });
        }
      });

      // Handle SW postMessage (notification tapped while app open)
      const handleSwMessage = (event) => {
        if (event.data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(event.data);
        }
      };
      navigator.serviceWorker?.addEventListener('message', handleSwMessage);

      return () => {
        navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
      };
    };

    setupListener();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [notificationSupported, onIncomingCall]);

  // Web permission request
  const requestPermission = useCallback(async () => {
    if (isNative || !notificationSupported) return null;

    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging) return null;

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        setFcmToken(token);
        if (socket && userId && userType) {
          socket.emit('saveFcmToken', { userId, userType, fcmToken: token });
        }
        return token;
      }
      return null;
    } catch (err) {
      console.error('[Push] requestPermission error:', err);
      return null;
    }
  }, [userId, userType, socket, notificationSupported]);

  return {
    fcmToken,
    permission,
    notificationSupported: isNative ? true : notificationSupported,
    requestPermission,
  };
};