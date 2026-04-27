import { useEffect, useRef, useCallback } from 'react';

export const useMessageQueue = ({ socket, isConnected, chatId, sendMessage }) => {
  const queueRef = useRef([]);

  const flushQueue = useCallback(() => {
    if (!socket?.connected || queueRef.current.length === 0) return;
    const toSend = [...queueRef.current];
    queueRef.current = [];
    toSend.forEach(({ chatId: cId, msg }) => sendMessage(cId, msg));
  }, [socket, sendMessage]);

  useEffect(() => {
    if (isConnected) flushQueue();
  }, [isConnected, flushQueue]);

  const enqueue = useCallback((msg) => {
    queueRef.current.push({ chatId, msg });
  }, [chatId]);

  return { enqueue };
};