import { useState, useEffect, useCallback } from 'react';
import { getMessagingIfSupported, getToken, onMessage } from '../config/firebase';
import appIcon from '../assets/Sendrey-Logo-Variants-09.png';

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;

export const USER_ORDER_TYPES = [
  'payment_request', 'delivery_confirmation_request', 'rating_prompt',
  'item_approval_request', 'delivery_confirmed', 'dispute_raised', 'dispute_resolved',
];

export const RUNNER_ORDER_TYPES = [
  'payment_success', 'item_approved', 'item_rejected', 'escrow_released',
  'delivery_confirmed', 'dispute_raised', 'dispute_resolved',
];

export const ORDER_TYPES = [...new Set([...USER_ORDER_TYPES, ...RUNNER_ORDER_TYPES])];

export const usePushNotifications = ({ userId, userType, socket, onIncomingCall, onNotificationTap }) => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notificationSupported, setNotificationSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      if (!('Notification' in window)) return;
      const messaging = await getMessagingIfSupported();
      if (!messaging) return;
      setNotificationSupported(true);
    };
    checkSupport();
  }, []);

  useEffect(() => {
    if (!notificationSupported) return;

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
              body, icon: appIcon, badge: appIcon, data,
              tag: data?.chatId || data?.type || 'default',
            });
          });
        }

        if (data?.type === 'incoming_call' && onIncomingCall) { onIncomingCall(data); return; }
        if (data?.type === 'message') onNotificationTap(data);
        if (data?.type === 'new_request_nearby' && onNotificationTap) { onNotificationTap(data); return; }
        if ((data?.type === 'team_invite' || data?.type === 'team_notify') && onNotificationTap) { onNotificationTap(data); return; }
        if ((data?.type === 'dispute_raised' || data?.type === 'dispute_resolved' || data?.type === 'dispute_lock') && onNotificationTap) onNotificationTap(data);
        if ((data?.type === 'schedule_reminder' || data?.type === 'schedule_warning') && onNotificationTap) onNotificationTap(data);
        if (ORDER_TYPES.includes(data?.type) && onNotificationTap) onNotificationTap(data);
        if (data?.type === 'user_offline') onNotificationTap(data);
        if ((data?.type === 'withdrawal_requested' || data?.type === 'withdrawal_released') && onNotificationTap) onNotificationTap(data);
        if ((data?.type === 'kyc_nin_submitted' || data?.type === 'kyc_license_submitted' || data?.type === 'kyc_selfie_submitted' || data?.type === 'kyc_document_approved' || data?.type === 'kyc_document_rejected' || data?.type === 'kyc_selfie_approved') && onNotificationTap) onNotificationTap(data);
        if (data?.type === 'account_banned') onNotificationTap(data);
        if (data?.type === 'runner_offline') onNotificationTap(data);
      });

      const handleSwMessage = (event) => {
        if (event.data?.type === 'incoming_call' && onIncomingCall) onIncomingCall(event.data);
      };
      navigator.serviceWorker?.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };

    setupListener();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [notificationSupported, onIncomingCall, onNotificationTap]);

  const requestPermission = useCallback(async () => {
    const messaging = await getMessagingIfSupported();
    if (!messaging) return null;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        await navigator.serviceWorker.ready;
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        setFcmToken(token);

        const emitToken = () => {
          if (socket?.connected && userId && userType) {
            socket.emit('saveFcmToken', { userId, userType, fcmToken: token });
          }
        };
        emitToken();
        if (!socket?.connected && socket) socket.once('connect', emitToken);
        return token;
      }
      return null;
    } catch (err) {
      console.error('[Push] requestPermission error:', err);
      return null;
    }
  }, [userId, userType, socket]);

  return { fcmToken, permission, notificationSupported, requestPermission };
};