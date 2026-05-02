// utils/socketQueue.js

const QUEUE_KEY = 'sendrey_socket_queue';

const getQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const enqueueSocketEvent = (event, data) => {
  const queue = getQueue();
  queue.push({
    id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    event,
    data,
    timestamp: Date.now(),
  });
  saveQueue(queue);
};

export const flushSocketQueue = (socket) => {
  if (!socket?.connected) return;

  const queue = getQueue();
  if (!queue.length) return;

  const failed = [];

  for (const item of queue) {
    // Drop items older than 5 minutes — they're stale
    if (Date.now() - item.timestamp > 5 * 60 * 1000) continue;

    try {
      socket.emit(item.event, item.data);
      console.log('[socketQueue] flushed:', item.event, item.data);
    } catch {
      failed.push(item);
    }
  }

  saveQueue(failed);
};

export const clearSocketQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};