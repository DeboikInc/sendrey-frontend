import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

export const useSocket = (SOCKET_URL) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!SOCKET_URL) return;

    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected:', socketRef.current.id);
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [SOCKET_URL]);

  const joinRunnerRoom = useCallback((runnerId, serviceType) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('joinRunnerRoom', { runnerId, serviceType });
      console.log(`Joining runner room: runners-${serviceType}`);
    }
  }, [socketRef.current, isConnected]);

  // In useSocket.js - joinChat function
  const joinChat = useCallback((chatId, onChatHistory, onMessage) => {
    if (!socketRef.current || !isConnected) return;

    // Remove previous listeners to avoid duplicates
    socketRef.current.off('chatHistory');
    socketRef.current.off('message');

    socketRef.current.emit('joinChat', chatId);

    socketRef.current.on('chatHistory', onChatHistory);
    socketRef.current.on('message', onMessage);

    console.log(`Joined chat: ${chatId}`);
  }, [socketRef.current, isConnected]);

  const sendMessage = useCallback((chatId, message) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('sendMessage', { chatId, message });
    }
  }, [socketRef.current, isConnected]);

  const pickService = useCallback((requestId, runnerId, runnerName) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('pickService', { requestId, runnerId, runnerName });
    }
  }, [socketRef.current, isConnected]);

  const onNewServiceRequest = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('newServiceRequest', callback);
    }
  };

  const onServicePicked = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('servicePicked', callback);
    }
  };

  const onExistingRequests = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('existingRequests', callback);
    }
  };

  const onRunnerAccepted = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('runnerAccepted', callback);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    joinRunnerRoom,
    joinChat,
    sendMessage,
    pickService,
    onNewServiceRequest,
    onServicePicked,
    onExistingRequests,
  };
};