import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

let globalSocket = null;

const createSocket = () => {
  if (globalSocket) return globalSocket;

  globalSocket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: false,
    autoConnect: true,
  });

  return globalSocket;
};

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);
  const runnerIdRef = useRef(null);
  const serviceTypeRef = useRef(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    const s = createSocket();

    const onConnect = () => {
      console.log('[Socket] Connected:', s.id);
      setIsConnected(true);

      // Rejoin rooms on every connect/reconnect
      if (runnerIdRef.current && serviceTypeRef.current) {
        s.emit('joinRunnerRoom', {
          runnerId: runnerIdRef.current,
          serviceType: serviceTypeRef.current,
        });
      }
      if (userIdRef.current) {
        s.emit('rejoinUserRoom', { userId: userIdRef.current, userType: 'user' });
      }
    };

    const onDisconnect = (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      setIsConnected(false);
      // Socket.IO's built-in reconnection handles the rest
      // Force connect for transport-level failures
      if (reason === 'transport close' || reason === 'transport error') {
        setTimeout(() => {
          if (!s.connected) s.connect();
        }, 1000);
      }
    };

    const onConnectError = (err) => {
      console.error('[Socket] Connect error:', err.message);
      setIsConnected(false);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    // Sync initial state
    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
    };
  }, []);

  const reconnect = useCallback(() => {
    if (globalSocket) {
      if (globalSocket.connected) {
        globalSocket.disconnect();
      }
      setTimeout(() => globalSocket.connect(), 100);
    }
  }, []);

  const joinRunnerRoom = useCallback((runnerId, serviceType) => {
    runnerIdRef.current = runnerId;
    serviceTypeRef.current = serviceType;
    if (globalSocket?.connected) {
      globalSocket.emit('joinRunnerRoom', { runnerId, serviceType });
    }
  }, []);

  const joinUserRoom = useCallback((userId) => {
    userIdRef.current = userId;
    if (globalSocket?.connected) {
      globalSocket.emit('rejoinUserRoom', { userId, userType: 'user' });
    }
  }, []);

  const userJoinChat = useCallback((userId, runnerId, chatId, serviceType) => {
    globalSocket?.emit('userJoinChat', { userId, runnerId, chatId, serviceType });
  }, []);

  const runnerJoinChat = useCallback((runnerId, userId, chatId, serviceType) => {
    globalSocket?.emit('runnerJoinChat', { runnerId, userId, chatId, serviceType });
  }, []);

  const joinChat = useCallback((chatId, taskData) => {
    const serviceType = taskData?.serviceType ||
      (taskData?.taskType === 'run-errand' ? 'run-errand' : 'pick-up');
    globalSocket?.emit('userJoinChat', {
      chatId,
      userId: taskData?.userId,
      runnerId: taskData?.runnerId || taskData?.taskId,
      serviceType,
    });
  }, []);

  const sendMessage = useCallback((chatId, message) => {
    if (globalSocket?.connected) {
      globalSocket.emit('sendMessage', { chatId, message });
    } else {
      console.warn('[Socket] Cannot send message — not connected');
    }
  }, []);

  const deleteMessage = useCallback((chatId, messageId, deleteForEveryone = true, userId) => {
    globalSocket?.emit('deleteMessage', { chatId, messageId, userId, deleteForEveryone });
  }, []);

  const pickService = useCallback((requestId, runnerId, runnerName) => {
    globalSocket?.emit('pickService', { requestId, runnerId, runnerName });
  }, []);

  const updateStatus = useCallback((data) => {
    globalSocket?.emit('updateStatus', data);
  }, []);

  const sendMedia = useCallback((data) => {
    globalSocket?.emit('sendMedia', data);
  }, []);

  const startTrackRunner = useCallback((data) => {
    globalSocket?.emit('startTrackRunner', data);
  }, []);

  const uploadFile = useCallback((fileData) => {
    if (globalSocket?.connected) {
      globalSocket.emit('uploadFile', fileData);
    } else {
      console.warn('[Socket] Cannot upload file — not connected');
    }
  }, []);

  const uploadFileWithProgress = useCallback((file, metadata) => {
    return new Promise((resolve, reject) => {
      if (!globalSocket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = {
          chatId: metadata.chatId,
          file: reader.result,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          type: metadata.type || null,
          senderId: metadata.senderId,
          senderType: metadata.senderType,
          text: metadata.text || '',
          tempId: metadata.tempId || null,
          ...(metadata.replyTo && {
            replyTo: metadata.replyTo,
            replyToMessage: metadata.replyToMessage,
            replyToFrom: metadata.replyToFrom,
          }),
        };
        globalSocket.emit('uploadFile', fileData);

        const successHandler = (data) => {
          globalSocket.off('fileUploadSuccess', successHandler);
          globalSocket.off('fileUploadError', errorHandler);
          resolve(data);
        };
        const errorHandler = (data) => {
          globalSocket.off('fileUploadSuccess', successHandler);
          globalSocket.off('fileUploadError', errorHandler);
          reject(new Error(data.error));
        };
        globalSocket.once('fileUploadSuccess', successHandler);
        globalSocket.once('fileUploadError', errorHandler);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  // ── Event listener helpers ─────────────────────────────────────────────────
  const on = (event, cb) => { if (globalSocket) { globalSocket.off(event); globalSocket.on(event, cb); } };

  const onNewServiceRequest = useCallback((cb) => { if (globalSocket) globalSocket.on('newServiceRequest', cb); }, []);
  const onServicePicked = useCallback((cb) => { if (globalSocket) globalSocket.on('servicePicked', cb); }, []);
  const onExistingRequests = useCallback((cb) => { if (globalSocket) globalSocket.on('existingRequests', cb); }, []);
  const onRunnerAccepted = useCallback((cb) => { if (globalSocket) globalSocket.on('runnerAccepted', cb); }, []);
  const onStatusUpdated = useCallback((cb) => on('statusUpdated', cb), []);
  const onMediaSent = useCallback((cb) => on('mediaSent', cb), []);
  const onPromptRating = useCallback((cb) => on('promptRating', cb), []);
  const onOrderCreated = useCallback((cb) => on('orderCreated', cb), []);
  const onPaymentSuccess = useCallback((cb) => on('paymentSuccess', cb), []);
  const onPaymentConfirmed = useCallback((cb) => on('paymentConfirmed', cb), []);
  const onMessageDeleted = useCallback((cb) => on('messageDeleted', cb), []);
  const onDisputeResolved = useCallback((cb) => on('disputeResolved', cb), []);
  const onReceiveTrackRunner = useCallback((cb) => on('receiveTrackRunner', cb), []);
  const onSpecialInstructions = useCallback((cb) => on('specialInstructions', cb), []);

  const onDeliveryConfirmed = useCallback((cb) => {
    if (globalSocket) {
      globalSocket.off('deliveryConfirmed');
      globalSocket.off('deliveryAutoConfirmed');
      globalSocket.on('deliveryConfirmed', cb);
      globalSocket.on('deliveryAutoConfirmed', cb);
    }
  }, []);

  const onSystemMessage = useCallback((cb) => {
    if (globalSocket) {
      globalSocket.on('message', (msg) => {
        if (msg.type === 'system' || msg.senderType === 'system') cb(msg);
      });
    }
  }, []);

  const onFileUploadSuccess = useCallback((cb) => {
    if (globalSocket) {
      globalSocket.off('fileUploadSuccess');
      globalSocket.on('fileUploadSuccess', cb);
    }
  }, []);

  const onFileUploadError = useCallback((cb) => {
    if (globalSocket) {
      globalSocket.off('fileUploadError');
      globalSocket.on('fileUploadError', cb);
    }
  }, []);

  const getSpecialInstructions = useCallback((chatId) => {
    globalSocket?.emit('getSpecialInstructions', { chatId });
  }, []);

  return {
    socket: globalSocket,
    isConnected,
    reconnect,
    joinRunnerRoom,
    joinUserRoom,
    userJoinChat,
    runnerJoinChat,
    joinChat,
    sendMessage,
    deleteMessage,
    pickService,
    updateStatus,
    sendMedia,
    startTrackRunner,
    onNewServiceRequest,
    onServicePicked,
    onExistingRequests,
    onRunnerAccepted,
    onStatusUpdated,
    onMediaSent,
    onSystemMessage,
    onPromptRating,
    onOrderCreated,
    onPaymentConfirmed,
    onDeliveryConfirmed,
    onMessageDeleted,
    onDisputeResolved,
    onReceiveTrackRunner,
    uploadFile,
    onFileUploadSuccess,
    onFileUploadError,
    uploadFileWithProgress,
    getSpecialInstructions,
    onSpecialInstructions,
    onPaymentSuccess,
  };
};