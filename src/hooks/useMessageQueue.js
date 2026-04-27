import { useEffect, useRef, useCallback } from 'react';

export const useMessageQueue = ({ socket, isConnected, chatId, sendMessage, onStatusUpdate, enabled = false }) => {
  const queueRef = useRef([]);

  const flushQueue = useCallback(() => {
    if (!enabled || !socket?.connected || queueRef.current.length === 0) return;
    const toSend = [...queueRef.current];
    queueRef.current = [];
    toSend.forEach(({ chatId: cId, msg }) => {
      sendMessage(cId, msg);
      // Upgrade queued → sent after flush
      onStatusUpdate?.(msg.id, 'sent');
    });
  }, [socket, sendMessage, onStatusUpdate, enabled]);

  useEffect(() => {
    if (isConnected) flushQueue();
  }, [isConnected, flushQueue]);

  // Listen for server echo → mark as delivered
  useEffect(() => {
    if (!socket) return;
    const handleEcho = (msg) => {
      if (!msg?.id) return;
      onStatusUpdate?.(msg.id, 'delivered');
    };
    socket.on('messageEcho', handleEcho);
    // Some setups echo via the same 'message' event with a tempId match
    const handleMessage = (msg) => {
      if (!msg?.tempId) return;
      onStatusUpdate?.(msg.tempId, 'delivered', msg.id);
    };
    socket.on('message', handleMessage);
    return () => {
      socket.off('messageEcho', handleEcho);
      socket.off('message', handleMessage);
    };
  }, [socket, onStatusUpdate]);

  const enqueue = useCallback((msg) => {
      if (!enabled) return;
    queueRef.current.push({ chatId, msg });
  }, [chatId, enabled]);

  return { enqueue };
};