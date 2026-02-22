import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4001';
// const SOCKET_URL=process.env.REACT_APP_SOCKET_URL;

console.log("Connecting to:", SOCKET_URL);

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  const runnerIdRef = useRef(null);
  const serviceTypeRef = useRef(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    if (socketRef.current) return;

    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    s.on('connect', () => {
      console.log('✅ Socket connected:', s.id);
      socketRef.current = s;
      setSocket(s);
      setIsConnected(true);

      if (runnerIdRef.current && serviceTypeRef.current) {
        s.emit('joinRunnerRoom', {
          runnerId: runnerIdRef.current,
          serviceType: serviceTypeRef.current
        });
      }

      if (userIdRef.current) {
        s.emit('rejoinUserRoom', { userId: userIdRef.current });
      }
    });

    s.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    s.on('connect_error', (error) => {
      console.error('Socket Connection Error:', error);
    });

    return () => {
      if (s) {
        s.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const joinRunnerRoom = useCallback((runnerId, serviceType) => {
    runnerIdRef.current = runnerId;
    serviceTypeRef.current = serviceType;
    if (socketRef.current?.connected) {
      socketRef.current.emit('joinRunnerRoom', { runnerId, serviceType });
    }
  }, []);

  const joinUserRoom = useCallback((userId) => {
    userIdRef.current = userId;
    if (socketRef.current?.connected) {
      socketRef.current.emit('rejoinUserRoom', { userId });
    }
  }, []);

  const userJoinChat = useCallback((userId, runnerId, chatId, serviceType) => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit('userJoinChat', { userId, runnerId, chatId, serviceType });
  }, []);

  const runnerJoinChat = useCallback((runnerId, userId, chatId, serviceType) => {
    const s = socketRef.current;
    if (!s?.connected) return;
    s.emit('runnerJoinChat', { runnerId, userId, chatId, serviceType });
  }, []);

  // LEGACY: read-only join — used by ChatScreen for history + messages
  const joinChat = useCallback((chatId, taskData, onChatHistory, onMessage) => {
    const s = socketRef.current;
    if (!s?.connected) return;

    s.off('chatHistory');
    s.off('message');

    const serviceType = taskData?.serviceType ||
      (taskData?.taskType === 'shopping' ? 'run-errand' : 'pick-up');

    // Emit userJoinChat so handleUserJoinChat runs (payment prompt logic lives there)
    // NOT 'joinChat' which hits the legacy readonly handler
    s.emit('userJoinChat', {
      chatId,
      userId: taskData?.userId,
      runnerId: taskData?.runnerId || taskData?.taskId,
      serviceType,
    });

    s.on('chatHistory', onChatHistory);
    s.on('message', onMessage);
  }, []);

  const sendMessage = useCallback((chatId, message) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendMessage', { chatId, message });
    }
  }, []);

  const deleteMessage = useCallback((chatId, messageId, deleteForEveryone = true, userId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('deleteMessage', { chatId, messageId, userId, deleteForEveryone });
    }
  }, []);

  const pickService = useCallback((requestId, runnerId, runnerName) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('pickService', { requestId, runnerId, runnerName });
    }
  }, []);

  const updateStatus = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('updateStatus', data);
    }
  }, []);

  const sendMedia = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendMedia', data);
    }
  }, []);

  const startTrackRunner = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('startTrackRunner', data);
    }
  }, []);

  // ─── Event listeners — all use socketRef so they're never stale ─────────────

  const onNewServiceRequest = useCallback((callback) => {
    if (socketRef.current) socketRef.current.on('newServiceRequest', callback);
  }, []);

  const onServicePicked = useCallback((callback) => {
    if (socketRef.current) socketRef.current.on('servicePicked', callback);
  }, []);

  const onExistingRequests = useCallback((callback) => {
    if (socketRef.current) socketRef.current.on('existingRequests', callback);
  }, []);

  const onRunnerAccepted = useCallback((callback) => {
    if (socketRef.current) socketRef.current.on('runnerAccepted', callback);
  }, []);

  const onStatusUpdated = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('statusUpdated');
      socketRef.current.on('statusUpdated', callback);
    }
  }, []);

  const onMediaSent = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('mediaSent');
      socketRef.current.on('mediaSent', callback);
    }
  }, []);

  const onSystemMessage = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('message', (msg) => {
        if (msg.type === 'system' || msg.senderType === 'system') callback(msg);
      });
    }
  }, []);

  // ── Payment / order events ───────────────────────────────────────────────────

  const onPromptRating = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('promptRating');
      socketRef.current.on('promptRating', callback);
    }
  }, []);

  const onOrderCreated = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('orderCreated');
      socketRef.current.on('orderCreated', callback);
    }
  }, []);

  const onPaymentConfirmed = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('paymentConfirmed');
      socketRef.current.on('paymentConfirmed', callback);
    }
  }, []);

  const onDeliveryConfirmed = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('deliveryConfirmed');
      socketRef.current.off('deliveryAutoConfirmed');
      socketRef.current.on('deliveryConfirmed', callback);
      socketRef.current.on('deliveryAutoConfirmed', callback);
    }
  }, []);

  const onMessageDeleted = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('messageDeleted');
      socketRef.current.on('messageDeleted', callback);
    }
  }, []);

  const onDisputeResolved = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('disputeResolved');
      socketRef.current.on('disputeResolved', callback);
    }
  }, []);

  const onReceiveTrackRunner = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('receiveTrackRunner');
      socketRef.current.on('receiveTrackRunner', callback);
    }
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────────

  const uploadFile = useCallback((fileData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('uploadFile', fileData);
    }
  }, []);

  const onFileUploadSuccess = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('fileUploadSuccess');
      socketRef.current.on('fileUploadSuccess', (data) => {
        console.log('✅ File uploaded:', data.cloudinaryUrl);
        callback(data);
      });
    }
  }, []);

  const onFileUploadError = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('fileUploadError');
      socketRef.current.on('fileUploadError', (data) => {
        console.error('❌ File upload failed:', data.error);
        callback(data);
      });
    }
  }, []);

  const uploadFileWithProgress = useCallback((file, metadata) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
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
          senderId: metadata.senderId,
          senderType: metadata.senderType,
          text: metadata.text || '',
          tempId: metadata.tempId,
          ...(metadata.replyTo && {
            replyTo: metadata.replyTo,
            replyToMessage: metadata.replyToMessage,
            replyToFrom: metadata.replyToFrom
          })
        };

        socketRef.current.emit('uploadFile', fileData);

        const successHandler = (data) => {
          socketRef.current.off('fileUploadSuccess', successHandler);
          socketRef.current.off('fileUploadError', errorHandler);
          resolve(data);
        };
        const errorHandler = (data) => {
          socketRef.current.off('fileUploadSuccess', successHandler);
          socketRef.current.off('fileUploadError', errorHandler);
          reject(new Error(data.error));
        };

        socketRef.current.once('fileUploadSuccess', successHandler);
        socketRef.current.once('fileUploadError', errorHandler);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  // ── Special instructions ─────────────────────────────────────────────────────

  const getSpecialInstructions = useCallback((chatId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('getSpecialInstructions', { chatId });
    }
  }, []);

  const onSpecialInstructions = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('specialInstructions');
      socketRef.current.on('specialInstructions', callback);
    }
  }, []);

  return {
    socket,
    isConnected,
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

    // Listeners
    onNewServiceRequest,
    onServicePicked,
    onExistingRequests,
    onRunnerAccepted,
    onStatusUpdated,
    onMediaSent,
    onSystemMessage,

    // Payment / order
    onPromptRating,
    onOrderCreated,
    onPaymentConfirmed,
    onDeliveryConfirmed,
    onMessageDeleted,
    onDisputeResolved,
    onReceiveTrackRunner,

    // File upload
    uploadFile,
    onFileUploadSuccess,
    onFileUploadError,
    uploadFileWithProgress,

    // Special instructions
    getSpecialInstructions,
    onSpecialInstructions,
  };
};