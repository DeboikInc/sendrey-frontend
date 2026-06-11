import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getMessagingIfSupported, getToken, onMessage } from '../config/firebase';
import appIcon from '../assets/Sendrey-Logo-Variants-09.png';

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;
// console.log('VAPID:', process.env.REACT_APP_VAPID_KEY ? 'exists' : 'missing');

const isNative = Capacitor.isNativePlatform(); // true on iOS/Android, false on web

export const USER_ORDER_TYPES = [
  'payment_request',
  'delivery_confirmation_request',
  'rating_prompt',
  'item_approval_request',
  'delivery_confirmed',
  'dispute_raised',
  'dispute_resolved',
];

export const RUNNER_ORDER_TYPES = [
  'payment_success',
  'item_approved',
  'item_rejected',
  'escrow_released',
  'delivery_confirmed',
  'dispute_raised',
  'dispute_resolved',
];

export const ORDER_TYPES = [...new Set([...USER_ORDER_TYPES, ...RUNNER_ORDER_TYPES])];

export const usePushNotifications = ({
  userId, userType, socket, onIncomingCall,
  onNotificationTap
}) => {
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

        // common
        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data);
        }

        // all user
        if ((data?.type === 'team_invite' || data?.type === 'team_notify') && onNotificationTap) {
          onNotificationTap(data);
          return;
        }

        if ((data?.type === 'dispute_raised' ||
          data?.type === 'dispute_resolved' ||
          data?.type === 'dispute_lock') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'schedule_reminder' || data?.type === 'schedule_warning') && onNotificationTap) {
          onNotificationTap(data);
        }

        if (ORDER_TYPES.includes(data?.type) && onNotificationTap) {
          onNotificationTap(data);
        }

        // all runner
        if ((data?.type === 'withdrawal_requested' || data?.type === 'withdrawal_released') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'kyc_nin_submitted' || data?.type === 'kyc_license_submitted' || data?.type === 'kyc_selfie_submitted' || data?.type === 'kyc_document_approved' || data?.type === 'kyc_document_rejected' || data?.type === 'kyc_selfie_approved') && onNotificationTap) {
          onNotificationTap(data);
        }

      });

      // Notification tapped (app backgrounded or closed)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data;
        console.log('[Push] Notification tapped:', data);

        // common
        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data);
        }

        // errand
        if (data?.type === 'new_request_nearby' && onNotificationTap) {
          onNotificationTap(data);  // ← add this
        }

        // all user
        if ((data?.type === 'team_invite' || data?.type === 'team_notify') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'dispute_raised' ||
          data?.type === 'dispute_resolved' ||
          data?.type === 'dispute_lock') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'schedule_reminder' || data?.type === 'schedule_warning') && onNotificationTap) {
          onNotificationTap(data);
        }

        if (ORDER_TYPES.includes(data?.type) && onNotificationTap) {
          onNotificationTap(data);
        }


        // all runner
        if ((data?.type === 'withdrawal_requested' || data?.type === 'withdrawal_released') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'kyc_nin_submitted' || data?.type === 'kyc_license_submitted' || data?.type === 'kyc_selfie_submitted' || data?.type === 'kyc_document_approved' || data?.type === 'kyc_document_rejected' || data?.type === 'kyc_selfie_approved') && onNotificationTap) {
          onNotificationTap(data);
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
  }, [userId, userType, socket, onIncomingCall, onNotificationTap]);

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

        const title = payload.notification?.title || data?.type || 'Sendrey';
        const body = payload.notification?.body || '';

        if (Notification.permission === 'granted' && title) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
              body,
              icon: appIcon,
              badge: appIcon,
              data,
              tag: data?.chatId || data?.type || 'default',
            });
          });
        }

        console.log('[Push] Message received in foreground:', payload);

        // common
        // Route incoming call to handler instead of showing dumb notification
        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data);
          return;
        }

        //  all user
        if (data?.type === 'new_request_nearby' && onNotificationTap) {
          onNotificationTap(data);
          return;
        }


        if ((data?.type === 'team_invite' || data?.type === 'team_notify') && onNotificationTap) {
          onNotificationTap(data);
          return;
        }

        if ((data?.type === 'dispute_raised' ||
          data?.type === 'dispute_resolved' ||
          data?.type === 'dispute_lock') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'schedule_reminder' || data?.type === 'schedule_warning') && onNotificationTap) {
          onNotificationTap(data);
        }

        if (ORDER_TYPES.includes(data?.type) && onNotificationTap) {
          onNotificationTap(data);
        }


        // all runners
        if ((data?.type === 'withdrawal_requested' || data?.type === 'withdrawal_released') && onNotificationTap) {
          onNotificationTap(data);
        }

        if ((data?.type === 'kyc_nin_submitted' || data?.type === 'kyc_license_submitted' || data?.type === 'kyc_selfie_submitted' || data?.type === 'kyc_document_approved' || data?.type === 'kyc_document_rejected' || data?.type === 'kyc_selfie_approved') && onNotificationTap) {
          onNotificationTap(data);
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
  }, [notificationSupported, onIncomingCall, onNotificationTap]);

  // Web permission request
  const requestPermission = useCallback(async () => {
    if (isNative) return null;

    const messaging = await getMessagingIfSupported();
    if (!messaging) return null;

    console.log('[Push] Requesting permission...');

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {

        await navigator.serviceWorker.ready;
        console.log('[Push] SW ready');

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        console.log('[Push] Web FCM token:', !!token, token?.substring(0, 20));
        setFcmToken(token);

        const emitToken = () => {
          if (socket?.connected && userId && userType) {
            console.log('[Push] emitting saveFcmToken');
            socket.emit('saveFcmToken', { userId, userType, fcmToken: token });
          }
        };

        // Try immediately
        emitToken();

        // If socket not connected yet, wait for connect event
        if (!socket?.connected && socket) {
          console.log('[Push] socket not ready, waiting for connect...');
          socket.once('connect', emitToken);
        }

        return token;
      }
      return null;
    } catch (err) {
      console.error('[Push] requestPermission error:', err);
      return null;
    }
  }, [userId, userType, socket]);

  return {
    fcmToken,
    permission,
    notificationSupported: isNative ? true : notificationSupported,
    requestPermission,
  };
};

