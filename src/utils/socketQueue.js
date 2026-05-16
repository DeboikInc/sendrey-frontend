const QUEUE_KEY = 'sendrey_socket_queue';
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;

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
  } catch { }
};

export const enqueueSocketEvent = (event, data) => {
  const queue = getQueue();

  // Deduplicate — don't queue the same event+orderId/messageId twice
  const isDuplicate = queue.some(
    (item) =>
      item.event === event &&
      item.data?.orderId === data?.orderId &&
      item.data?.messageId === data?.messageId &&
      item.data?.submissionId === data?.submissionId
  );
  if (isDuplicate) return;

  queue.push({
    id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    event,
    data,
    timestamp: Date.now(),
    retries: 0,
  });

  saveQueue(queue);
};

export const flushSocketQueue = (socket) => {
  if (!socket?.connected) return;

  const queue = getQueue();
  if (!queue.length) return;

  const failed = [];

  for (const item of queue) {
    // Drop stale items
    if (Date.now() - item.timestamp > MAX_AGE_MS) {
      console.log('[socketQueue] dropping stale event:', item.event);
      continue;
    }

    // Drop items that have exceeded retry limit
    if ((item.retries || 0) >= MAX_RETRIES) {
      console.warn('[socketQueue] dropping after max retries:', item.event, item.data);
      continue;
    }

    try {
      socket.emit(item.event, item.data);
      console.log('[socketQueue] flushed:', item.event);
    } catch {
      failed.push({ ...item, retries: (item.retries || 0) + 1 });
    }
  }

  saveQueue(failed);
};

export const clearSocketQueue = () => localStorage.removeItem(QUEUE_KEY);


const ACK_TIMEOUT_MS = 8_000;

/**
 * Emit a status update with ACK tracking + automatic re-queue on failure.
 * Uses the same localStorage queue and flushSocketQueue as everything else.
 *
 * Call this only for 'updateStatus' events from OrderStatusFlow.
 */
export const emitStatusWithAck = (socket, payload) => {
  if (!socket?.connected) {
    enqueueSocketEvent('updateStatus', payload);
    console.log('[socketQueue] offline — status queued:', payload.status);
    return;
  }

  // Enqueue first so the ACK-timeout safety net can find and remove it
  enqueueSocketEvent('updateStatus', payload);

  socket.emit('updateStatus', payload, (ack) => {
    if (ack?.received) {
      // Server confirmed — remove from queue so flushSocketQueue won't replay it
      _removeFromQueue('updateStatus', payload);
      console.log('[socketQueue] status ACKed by server:', payload.status);
    }
    // No else — if ack is missing or ack.received is false, the item stays
    // in the queue and flushSocketQueue will retry it on next reconnect
  });

  // Safety net: if the ACK callback never fires (network drop mid-emit),
  // the item is already in the queue — nothing extra needed
  setTimeout(() => {
    const q = getQueue();
    const still = q.some(
      i => i.event === 'updateStatus' &&
        i.data?.chatId === payload.chatId &&
        i.data?.status === payload.status
    );
    if (still) {
      console.warn('[socketQueue] ACK timeout — status will retry on reconnect:', payload.status);
    }
  }, ACK_TIMEOUT_MS);
};

// Internal helper — removes a specific item from the queue after ACK
const _removeFromQueue = (event, payload) => {
  const q = getQueue().filter(
    i => !(
      i.event === event &&
      i.data?.chatId === payload.chatId &&
      i.data?.status === payload.status
    )
  );
  saveQueue(q);
};

const SUBMIT_MAX_RETRIES = 5;
const SUBMIT_BASE_DELAY_MS = 1500;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const emitWithAck = (socket, emitEvent, successEvent, errorEvent, payload, timeoutMs = 12_000) =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off(successEvent, onSuccess);
      socket.off(errorEvent, onError);
    };

    const onSuccess = (data) => { cleanup(); resolve(data); };
    const onError = (data) => { cleanup(); reject(new Error(data?.error || data?.message || 'Unknown error')); };

    socket.once(successEvent, onSuccess);
    socket.once(errorEvent, onError);
    socket.emit(emitEvent, payload);

    setTimeout(() => {
      cleanup();
      reject(new Error('Server did not respond in time'));
    }, timeoutMs);
  });

/**
 * Emit with up to SUBMIT_MAX_RETRIES attempts and exponential back-off.
 * Calls `onRetry(attempt, max)` between attempts so the caller can show
 * a "Retrying…" message in the chat.
 *
 * Falls back to the localStorage queue if the socket is offline.
 */
export const emitWithRetry = async ({
  socket,
  emitEvent,
  successEvent,
  errorEvent,
  payload,
  onRetry,
  maxRetries = SUBMIT_MAX_RETRIES,
  timeoutMs = 12_000,
}) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (!socket?.connected) {
      enqueueSocketEvent(emitEvent, payload);
      console.warn(`[socketQueue] ${emitEvent} queued — socket offline on attempt ${attempt}`);
      return { queued: true };
    }

    try {
      const result = await emitWithAck(socket, emitEvent, successEvent, errorEvent, payload, timeoutMs);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[socketQueue] ${emitEvent} attempt ${attempt}/${maxRetries} failed:`, err.message);

      if (attempt < maxRetries) {
        onRetry?.(attempt, maxRetries);
        await delay(SUBMIT_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError ?? new Error(`${emitEvent} failed after ${maxRetries} attempts`);
};

/**
 * Submit run-errand items with retry.
 * successEvent / errorEvent must match what your server emits.
 */
export const submitItemsWithRetry = (socket, payload, onRetry) =>
  emitWithRetry({
    socket,
    emitEvent: 'submitItems',
    successEvent: 'itemSubmissionSuccess',
    errorEvent: 'itemSubmissionError',
    payload,
    onRetry,
  });

/**
 * Submit pick-up item with retry.
 */
export const submitPickupItemWithRetry = (socket, payload, onRetry) =>
  emitWithRetry({
    socket,
    emitEvent: 'submitPickupItem',
    successEvent: 'pickupItemSuccess',
    errorEvent: 'pickupItemSubmissionError',
    payload,
    onRetry,
  });