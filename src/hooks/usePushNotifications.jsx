import { useState, useEffect, useCallback } from 'react';
import { messaging, getToken, onMessage } from '../config/firebase';

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY || "BLJmLISd-7ABy8Ev7YzYBYeUR_IhH3M4MVkyDfclM373ObiwUvCHYG0xr_kMsJKn-VqwfWTgjIF4seCzKc1J5q0";

export const usePushNotifications = ({ userId, userType, socket }) => {
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState(Notification.permission);
  const [notificationSupported, setNotificationSupported] = useState(true);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      setNotificationSupported(false);
    }
  }, []);

  // Request permission and get FCM token
  const requestPermission = useCallback(async () => {
    if (!notificationSupported) {
      console.warn('Notifications not supported');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        console.log(' Notification permission granted');
        
        // Get FCM token
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        console.log('FCM Token:', token);
        setFcmToken(token);
        
        // Send token to backend via socket
        if (socket && userId && userType) {
          socket.emit('saveFcmToken', {
            userId,
            userType,
            fcmToken: token,
          });
          console.log('FCM token sent to backend');
        }

        return token;
      } else {
        console.log('Notification permission denied');
        return null;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return null;
    }
  }, [userId, userType, socket, notificationSupported]);

  // Listen for foreground messages (when app is open)
  useEffect(() => {
    if (!notificationSupported) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      // Show browser notification even when app is open but chat is not active
      if (payload.notification) {
        const { title, body } = payload.notification;
        
        // Create notification manually for foreground
        new Notification(title, {
          body,
          icon: '/logo192.png',
          badge: '/logo192.png',
          data: payload.data,
        });
      }
    });

    return () => unsubscribe();
  }, [notificationSupported]);

  // Auto-request permission on mount if user/runner is logged in
  useEffect(() => {
    if (userId && userType && permission === 'default') {
      // Don't auto-request, let user trigger it
      console.log('Ready to request notification permission');
    }
  }, [userId, userType, permission]);

  return {
    fcmToken,
    permission,
    notificationSupported,
    requestPermission,
  };
};