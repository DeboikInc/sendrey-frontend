import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;
const MAX_RECONNECTION_ATTEMPTS = 12;
const INITIAL_RECONNECTION_DELAY = 10000; // 10 seconds
const POLLING_INTERVAL = 5000; // 5 seconds - check connection status

// console.log("Connecting to:", SOCKET_URL);

// Global socket instance - persists across hook instances
let globalSocket = null;
let globalSocketInitialized = false; // eslint-disable-line no-unused-vars
let globalListenersAttached = false;

export const useSocket = () => {
  const [socket, setSocket] = useState(globalSocket); // eslint-disable-line no-unused-vars
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);
  const socketRef = useRef(globalSocket);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const pollingTimerRef = useRef(null);

  const runnerIdRef = useRef(null);
  const serviceTypeRef = useRef(null);
  const userIdRef = useRef(null);
  const connectRef = useRef(null);

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  // Polling function - checks if we need to connect
  const pollForConnection = useCallback(() => {
    // Only poll if we're not connected and not already trying to reconnect
    if (!isConnected && !socketRef.current && !reconnectTimerRef.current) {
      // console.log('Polling: No active connection, attempting to connect...');
      if (connectRef.current) {
        connectRef.current();
      }
    }
  }, [isConnected]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECTION_ATTEMPTS) {
      // console.log('Max reconnection attempts reached, enabling polling mode');

      // Start polling every 5 seconds to check connection
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(pollForConnection, POLLING_INTERVAL);
      }
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const delay = INITIAL_RECONNECTION_DELAY * Math.pow(1.5, reconnectAttemptsRef.current);
    // console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      if (connectRef.current) {
        connectRef.current();
      }
    }, delay);
  }, [pollForConnection]);

  // Initialize global socket only once
  useEffect(() => {
    // If global socket already exists and is connected, use it
    if (globalSocket?.connected) {
      // console.log('Using existing global socket:', globalSocket.id);
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      setIsConnected(true);
      return;
    }

    // If global socket exists but disconnected, try to reconnect
    if (globalSocket && !globalSocket.connected) {
      // console.log('Global socket exists but disconnected, reconnecting...');
      globalSocket.connect();
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      return;
    }

    // Create new socket only if none exists
    if (!globalSocket) {
      // console.log('Creating new global socket connection...');

      const s = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true, // Allow socket.io to handle basic reconnection
        reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: false, // Don't force new connection
        autoConnect: true,
      });

      globalSocket = s;
      socketRef.current = s;
      setSocket(s);

      // Set up event listeners once
      if (!globalListenersAttached) {
        globalListenersAttached = true;

        s.on('connect', () => {
          // console.log('Global socket connected:', s.id);
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;

          // Stop polling since we're connected
          if (pollingTimerRef.current) {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }

          // Rejoin rooms after connection
          if (runnerIdRef.current && serviceTypeRef.current) {
            s.emit('joinRunnerRoom', {
              runnerId: runnerIdRef.current,
              serviceType: serviceTypeRef.current
            });
          }

          if (userIdRef.current) {
            s.emit('rejoinUserRoom', { userId: userIdRef.current, userType: 'user'  });
          }
        });

        s.on('disconnect', (reason) => {
          // console.log('❌ Global socket disconnected:', reason);
          setIsConnected(false);

          // Don't clear globalSocket on disconnect - we want to reuse it

          if (reason !== 'io client disconnect') {
            attemptReconnect();
          }
        });

        s.on('connect_error', (error) => {
          console.error('Socket Connection Error:', error);
          setIsConnected(false);

          // Don't clear globalSocket on error
          attemptReconnect();
        });

        s.on('connect_timeout', () => {
          console.error('Socket Connection Timeout');
          setIsConnected(false);
          attemptReconnect();
        });
      }
    }

    // Cleanup on unmount - but don't disconnect global socket
    return () => {
      // Don't disconnect global socket - let it persist for other components
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [attemptReconnect, pollForConnection]);

  // Store connect function in ref
  const connect = useCallback(() => {
    if (globalSocket?.connected) {
      // console.log('Already connected, reusing socket');
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      setIsConnected(true);
      return;
    }

    if (globalSocket) {
      // console.log('Reconnecting existing global socket');
      globalSocket.connect();
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      return;
    }

    // If no global socket exists, the init useEffect will create one
    // console.log('No global socket exists, initialization will create one');
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket.connect();
    } else {
      connect();
    }
  }, [connect]);

  const joinRunnerRoom = useCallback((runnerId, serviceType) => {
    runnerIdRef.current = runnerId;
    serviceTypeRef.current = serviceType;
    if (globalSocket?.connected) {
      globalSocket.emit('joinRunnerRoom', { runnerId, serviceType });
    } else {
      console.warn('Cannot join runner room - socket not connected');
    }
  }, []);

  const joinUserRoom = useCallback((userId) => {
    userIdRef.current = userId;
    if (globalSocket?.connected) {
      globalSocket.emit('rejoinUserRoom', { userId });
    } else {
      console.warn('Cannot join user room - socket not connected');
    }
  }, []);

  const userJoinChat = useCallback((userId, runnerId, chatId, serviceType) => {
    if (!globalSocket?.connected) {
      console.warn('Cannot join chat - socket not connected');
      return;
    }
    globalSocket.emit('userJoinChat', { userId, runnerId, chatId, serviceType });
  }, []);

  const runnerJoinChat = useCallback((runnerId, userId, chatId, serviceType) => {
    if (!globalSocket?.connected) {
      console.warn('Cannot join chat - socket not connected');
      return;
    }
    globalSocket.emit('runnerJoinChat', { runnerId, userId, chatId, serviceType });
  }, []);

  const joinChat = useCallback((chatId, taskData, onChatHistory, onMessage) => {
    if (!globalSocket?.connected) {
      console.warn('Cannot join chat - socket not connected');
      return;
    }

    globalSocket.off('chatHistory');
    globalSocket.off('message');

    const serviceType = taskData?.serviceType ||
      (taskData?.taskType === 'shopping' ? 'run-errand' : 'pick-up');

    globalSocket.emit('userJoinChat', {
      chatId,
      userId: taskData?.userId,
      runnerId: taskData?.runnerId || taskData?.taskId,
      serviceType,
    });

    globalSocket.on('chatHistory', onChatHistory);
    globalSocket.on('message', onMessage);
  }, []);

  const sendMessage = useCallback((chatId, message) => {
    if (globalSocket?.connected) {
      globalSocket.emit('sendMessage', { chatId, message });
    } else {
      console.warn('Cannot send message - socket not connected');
    }
  }, []);

  const deleteMessage = useCallback((chatId, messageId, deleteForEveryone = true, userId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('deleteMessage', { chatId, messageId, userId, deleteForEveryone });
    } else {
      console.warn('Cannot delete message - socket not connected');
    }
  }, []);

  const pickService = useCallback((requestId, runnerId, runnerName) => {
    if (globalSocket?.connected) {
      globalSocket.emit('pickService', { requestId, runnerId, runnerName });
    } else {
      console.warn('Cannot pick service - socket not connected');
    }
  }, []);

  const updateStatus = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('updateStatus', data);
    } else {
      console.warn('Cannot update status - socket not connected');
    }
  }, []);

  const sendMedia = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('sendMedia', data);
    } else {
      console.warn('Cannot send media - socket not connected');
    }
  }, []);

  const startTrackRunner = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('startTrackRunner', data);
    } else {
      console.warn('Cannot start tracking - socket not connected');
    }
  }, []);

  // Event listeners
  const onNewServiceRequest = useCallback((callback) => {
    if (globalSocket) globalSocket.on('newServiceRequest', callback);
  }, []);

  const onServicePicked = useCallback((callback) => {
    if (globalSocket) globalSocket.on('servicePicked', callback);
  }, []);

  const onExistingRequests = useCallback((callback) => {
    if (globalSocket) globalSocket.on('existingRequests', callback);
  }, []);

  const onRunnerAccepted = useCallback((callback) => {
    if (globalSocket) globalSocket.on('runnerAccepted', callback);
  }, []);

  const onStatusUpdated = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('statusUpdated');
      globalSocket.on('statusUpdated', callback);
    }
  }, []);

  const onMediaSent = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('mediaSent');
      globalSocket.on('mediaSent', callback);
    }
  }, []);

  const onSystemMessage = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.on('message', (msg) => {
        if (msg.type === 'system' || msg.senderType === 'system') callback(msg);
      });
    }
  }, []);

  const onPromptRating = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('promptRating');
      globalSocket.on('promptRating', callback);
    }
  }, []);

  const onOrderCreated = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('orderCreated');
      globalSocket.on('orderCreated', callback);
    }
  }, []);

  const onPaymentSuccess = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('paymentSuccess');
      globalSocket.on('paymentSuccess', callback);
    }
  }, []);

  const onPaymentConfirmed = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('paymentConfirmed');
      globalSocket.on('paymentConfirmed', callback);
    }
  }, []);

  const onDeliveryConfirmed = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('deliveryConfirmed');
      globalSocket.off('deliveryAutoConfirmed');
      globalSocket.on('deliveryConfirmed', callback);
      globalSocket.on('deliveryAutoConfirmed', callback);
    }
  }, []);

  const onMessageDeleted = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('messageDeleted');
      globalSocket.on('messageDeleted', callback);
    }
  }, []);

  const onDisputeResolved = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('disputeResolved');
      globalSocket.on('disputeResolved', callback);
    }
  }, []);

  const onReceiveTrackRunner = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('receiveTrackRunner');
      globalSocket.on('receiveTrackRunner', callback);
    }
  }, []);

  const uploadFile = useCallback((fileData) => {
    if (globalSocket?.connected) {
      globalSocket.emit('uploadFile', fileData);
    } else {
      console.warn('Cannot upload file - socket not connected');
    }
  }, []);

  const onFileUploadSuccess = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('fileUploadSuccess');
      globalSocket.on('fileUploadSuccess', (data) => {
        // console.log(' File uploaded:', data.cloudinaryUrl);
        callback(data);
      });
    }
  }, []);

  const onFileUploadError = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('fileUploadError');
      globalSocket.on('fileUploadError', (data) => {
        console.error('❌ File upload failed:', data.error);
        callback(data);
      });
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
          type: metadata.type || null,        // ← THIS WAS MISSING — tells server the message type
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

  const getSpecialInstructions = useCallback((chatId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('getSpecialInstructions', { chatId });
    } else {
      console.warn('Cannot get special instructions - socket not connected');
    }
  }, []);

  const onSpecialInstructions = useCallback((callback) => {
    if (globalSocket) {
      globalSocket.off('specialInstructions');
      globalSocket.on('specialInstructions', callback);
    }
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
    onPaymentSuccess
  };
};