import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

// const SOCKET_URL = process.env.REACT_APP_SOCKET_URL_LOCAL;
const SOCKET_URL = "http://localhost:4001";
console.log("Connecting to:", SOCKET_URL);

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // refs for persisting states
  const runnerIdRef = useRef(null);
  const serviceTypeRef = useRef(null);
  const userIdRef = useRef(null);

  useEffect(() => {
    // Prevent multiple connections
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


      // Re-join runner room after reconnect
      if (runnerIdRef.current && serviceTypeRef.current) {
        s.emit('joinRunnerRoom', {
          runnerId: runnerIdRef.current,
          serviceType: serviceTypeRef.current
        });
      }

      // Re-join user personal room after reconnect
      if (userIdRef.current) {
        s.emit('rejoinUserRoom', { userId: userIdRef.current });
      }
    });


    if (runnerIdRef.current && serviceTypeRef.current) {
      console.log(' Re-joining runner room after reconnect:', runnerIdRef.current);
      s.emit('joinRunnerRoom', {
        runnerId: runnerIdRef.current,
        serviceType: serviceTypeRef.current
      });
    }

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
    // persist
    runnerIdRef.current = runnerId;
    serviceTypeRef.current = serviceType;

    if (socketRef.current?.connected) {
      socketRef.current.emit('joinRunnerRoom', { runnerId, serviceType });
      console.log(`Joining runner room: runners-${serviceType}`);
    }
  }, []);

  const joinUserRoom = useCallback((userId) => {
  userIdRef.current = userId; // persist for reconnects
  if (socketRef.current?.connected) {
    socketRef.current.emit('rejoinUserRoom', { userId });
  }
}, []);

  // : User joins chat (creates empty chat if first)
  const userJoinChat = useCallback((userId, runnerId, chatId, serviceType) => {
    const s = socketRef.current;
    if (!s?.connected) return;

    console.log('👤 User joining chat:', { userId, runnerId, chatId, serviceType });

    s.emit('userJoinChat', {
      userId,
      runnerId,
      chatId,
      serviceType
    });
  }, []);

  // NEW: Runner joins chat (creates chat with messages if first)
  const runnerJoinChat = useCallback((runnerId, userId, chatId, serviceType) => {
    const s = socketRef.current;
    if (!s?.connected) return;

    console.log('🏃 Runner joining chat:', { runnerId, userId, chatId, serviceType });

    s.emit('runnerJoinChat', {
      runnerId,
      userId,
      chatId,
      serviceType
    });
  }, []);

  // LEGACY: Generic joinChat (read-only, for reconnections or other cases)
  // This should NOT be used for initial chat creation anymore
  const joinChat = useCallback((chatId, taskData, onChatHistory, onMessage) => {
    const s = socketRef.current;
    if (!s?.connected) return;

    s.off('chatHistory');
    s.off('message');

    const serviceType = taskData?.serviceType ||
      (taskData?.taskType === 'shopping' ? 'run-errand' : 'pick-up');

    console.log('🔍 joinChat (legacy/readonly) called with:', {
      chatId,
      taskData,
      serviceType: serviceType,
      hasTaskId: !!taskData?.taskId,
      hasServiceType: !!serviceType
    });

    // Just join the room and listen, don't create chat
    s.emit('joinChat', {
      chatId,
      taskId: taskData?.taskId || taskData?.requestId,
      serviceType: serviceType
    });

    s.on('chatHistory', onChatHistory);
    s.on('message', onMessage);

    console.log(`Joined chat room: ${chatId}`);
  }, []);

  const sendMessage = useCallback((chatId, message) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendMessage', { chatId, message });
    }
  }, []);

  const deleteMessage = (chatId, messageId, deleteForEveryone = true, userId) => {
    if (socket) {
      socket.emit("deleteMessage", {
        chatId,
        messageId,
        userId,
        deleteForEveryone
      });
    }
  };

  const pickService = useCallback((requestId, runnerId, runnerName) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('pickService', { requestId, runnerId, runnerName });
    }
  }, []);

  const onNewServiceRequest = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('newServiceRequest', callback);
    }
  }, []);

  const onServicePicked = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('servicePicked', callback);
    }
  }, []);

  const onExistingRequests = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('existingRequests', callback);
    }
  }, []);

  const onRunnerAccepted = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('runnerAccepted', callback);
    }
  }, []);

  const updateStatus = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('updateStatus', data);
    }
  }, []);

  // media
  const sendMedia = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendMedia', data);
    }
  }, []);

  // listen for status updates
  const onStatusUpdated = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('statusUpdated', callback);
    }
  }, []);

  const onMediaSent = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('mediaSent', callback);
    }
  }, []);

  const onSystemMessage = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('message', (msg) => {
        if (msg.type === 'system' || msg.senderType === 'system') {
          callback(msg);
        }
      });
    }
  }, []);

  const startTrackRunner = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('startTrackRunner', data);
    }
  }, []);

  // ==================== FILE UPLOAD ====================

  /**
   * Upload file via socket
   * @param {Object} fileData - { chatId, file, fileName, fileType, senderId, senderType }
   */
  const uploadFile = useCallback((fileData) => {
    if (socketRef.current?.connected) {
      console.log('📤 Uploading file:', fileData.fileName);
      socketRef.current.emit('uploadFile', fileData);
    } else {
      console.error('Socket not connected');
    }
  }, []);

  /**
   * Listen for file upload success
   * @param {Function} callback - Receives { chatId, message, cloudinaryUrl }
   */
  const onFileUploadSuccess = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('fileUploadSuccess'); // Remove previous listener
      socketRef.current.on('fileUploadSuccess', (data) => {
        console.log('✅ File uploaded successfully:', data.cloudinaryUrl);
        callback(data);
      });
    }
  }, []);

  /**
   * Listen for file upload errors
   * @param {Function} callback - Receives { error, chatId }
   */
  const onFileUploadError = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('fileUploadError'); // Remove previous listener
      socketRef.current.on('fileUploadError', (data) => {
        console.error('❌ File upload failed:', data.error);
        callback(data);
      });
    }
  }, []);

  /**
   * Upload file with progress tracking (using FileReader)
   * @param {File} file - The file object
   * @param {Object} metadata - { chatId, senderId, senderType }
   * @returns {Promise} - Resolves when upload completes
   */
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
          file: reader.result, // base64 string
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

        // Listen for success/error once
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

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }, []);

  /**
 * Get special instructions for a chat
 * @param {string} chatId - The chat ID
 */
  const getSpecialInstructions = useCallback((chatId) => {
    if (socketRef.current?.connected) {
      console.log('📋 Requesting special instructions for chat:', chatId);
      socketRef.current.emit('getSpecialInstructions', { chatId });
    }
  }, []);

  /**
   * Listen for special instructions
   * @param {Function} callback - Receives { chatId, specialInstructions }
   */
  const onSpecialInstructions = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.off('specialInstructions'); // Remove previous listener
      socketRef.current.on('specialInstructions', (data) => {
        console.log('📋 Received special instructions:', data);
        callback(data);
      });
    }
  }, []);

  return {
    socket,
    isConnected,
    joinRunnerRoom,
    userJoinChat,
    runnerJoinChat,
    joinChat,
    sendMessage,
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

    // File upload methods
    uploadFile,
    onFileUploadSuccess,
    onFileUploadError,
    uploadFileWithProgress,
    deleteMessage,

    getSpecialInstructions,
    onSpecialInstructions,
  };
};