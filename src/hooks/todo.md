# Sendrey Production Bug Fix Guide

> **Scope**: This document covers every issue found during the live PM testing session and gives you a clear, prioritized action plan to resolve them. Work top-to-bottom — each section is independent so you can fix them in parallel if needed.

---

## Bug Inventory (Quick Reference)

| # | Bug | Severity | Root Cause Area |
|---|-----|----------|-----------------|
| 1 | Audio messages play with 00:00 duration, no sound | High | Media blob / Blob URL handling |
| 2 | Any media sent causes duplicate messages on sender side | High | `socket.emit` called multiple times |
| 3 | Run Errand order status flow not emitting to runner | Critical | Service-type check before emit |
| 4 | Stale data on runner side after service switch | High | Socket room / state not reset on new order |
| 5 | Payment messages not showing on runner side | High | Missing socket listener or wrong event name |
| 6 | "Mark as Delivered" unlocked prematurely | Medium | Payment confirmation state not gating UI |
| 7 | Safari iOS cannot record audio (permission granted but no recording) | Medium | MediaRecorder API / iOS constraints |

---

## Bug 1 — Audio Messages: No Sound + 00:00 Duration

### What's Happening
When audio is sent and received, the audio player shows `00:00` and is silent. This means the receiver is getting a bad audio source — either an empty blob, a revoked Blob URL, or a base64 string that was corrupted in transit.

### Step-by-Step Fix

**Step 1 — Check how you're sending audio**

Find where you call `socket.emit` with audio data. You're likely doing one of these wrong patterns:

```js
// WRONG — Blob URLs are local to the creating device. They cannot be sent over a socket.
const blobUrl = URL.createObjectURL(audioBlob);
socket.emit('send_message', { audio: blobUrl }); // ❌ receiver gets a dead URL

// WRONG — ArrayBuffer is not automatically serializable across socket.io
socket.emit('send_message', { audio: arrayBuffer }); // ❌ may arrive corrupted
```

**Step 2 — Convert to base64 before emitting**

```js
// CORRECT — Convert blob to base64 string first
async function sendAudioMessage(audioBlob) {
  const base64 = await blobToBase64(audioBlob);
  socket.emit('send_message', {
    type: 'audio',
    data: base64,
    mimeType: audioBlob.type, // e.g. 'audio/webm;codecs=opus' or 'audio/mp4'
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // includes data: prefix
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**Step 3 — Reconstruct correctly on the receiver side**

```js
// When you receive the message, reconstruct a playable blob URL locally
socket.on('receive_message', (msg) => {
  if (msg.type === 'audio') {
    const audio = new Audio(msg.data); // data is already a base64 data URL
    // OR set it as src on an <audio> element
    audioElement.src = msg.data;
  }
});
```

**Step 4 — Verify the duration reads correctly**

Duration shows `00:00` when the browser hasn't loaded the audio metadata yet. Force it to load:

```js
audioElement.src = msg.data;
audioElement.load(); // Force metadata load
audioElement.onloadedmetadata = () => {
  console.log('Duration:', audioElement.duration); // Should now be > 0
};
```

**Step 5 — Check MIME type compatibility**

`audio/webm` (Chrome default) does NOT play on Safari. See Bug 7 for the full cross-platform recording fix. The MIME type you record with must match what the receiver tries to play.

---

## Bug 2 — Media Messages Appear Multiple Times on Sender Side

### What's Happening
When any media (image, audio, video) is sent, the sender sees duplicate (or more) instances of it. This is a classic socket.emit + optimistic UI double-render problem.

### Root Causes (Check All Three)

**Cause A — `socket.emit` is being called more than once**

Look at your send function. It may be inside a component that re-renders, or an event listener that gets attached multiple times.

```js
// WRONG — if this runs on every re-render, the listener stacks up
socket.on('message_sent', handleMessageSent);

// CORRECT — Remove listener before adding, or use .once()
socket.off('message_sent', handleMessageSent);
socket.on('message_sent', handleMessageSent);

// OR if you only need it once:
socket.once('message_sent', handleMessageSent);
```

**Cause B — You're both emitting AND adding the message to local state, then the server also broadcasts it back to you**

```js
// WRONG — adds the message twice: once optimistically, once from server echo
socket.emit('send_message', msgData);
setMessages(prev => [...prev, msgData]); // optimistic add
// then server broadcasts back to everyone INCLUDING sender
socket.on('receive_message', (msg) => {
  setMessages(prev => [...prev, msg]); // adds it again ❌
});

// CORRECT OPTION A — Don't broadcast back to sender on the server
// Server side:
socket.to(roomId).emit('receive_message', msgData); // 'to' excludes sender

// CORRECT OPTION B — If server DOES echo back, skip optimistic add
// Just wait for server confirmation instead of adding locally first
```

**Cause C — Multiple socket connections open**

In React, `socket.connect()` or the socket instantiation may be called multiple times due to `useEffect` running twice (React StrictMode) or the component remounting.

```js
// WRONG — creates a new socket on every render
const socket = io(SERVER_URL);

// CORRECT — create socket once, share it (put it in a context or module-level singleton)
// socket.js
import { io } from 'socket.io-client';
export const socket = io(SERVER_URL, { autoConnect: false });

// In your component
import { socket } from '../socket';
useEffect(() => {
  socket.connect();
  return () => { socket.disconnect(); };
}, []);
```

---

## Bug 3 — Run Errand Order: Statuses Not Emitting to Runner

### What's Happening
When the service type is "Run Errand", the order status flow visually shows the correct statuses but nothing is emitted via socket to the runner. The runner sees nothing because the emit is gated behind a service-type check that still thinks it's a pickup order.

### Step-by-Step Fix

**Step 1 — Find your status emit logic**

Look for the block that emits order status changes. It probably looks something like:

```js
function emitOrderStatus(status) {
  if (order.serviceType === 'pickup') {
    socket.emit('order_status_update', { orderId, status });
  }
  // Run Errand statuses are never emitting because they never enter this block ❌
}
```

**Step 2 — Fix the guard condition**

```js
// CORRECT — emit for ALL service types, or specifically include errand
function emitOrderStatus(status) {
  const validStatuses = getValidStatusesForServiceType(order.serviceType);
  
  if (validStatuses.includes(status)) {
    socket.emit('order_status_update', {
      orderId: order.id,
      status,
      serviceType: order.serviceType, // always send serviceType so runner can interpret it
    });
  }
}

function getValidStatusesForServiceType(serviceType) {
  const pickupStatuses = ['accepted', 'arrived', 'picked_up', 'delivered'];
  const errandStatuses = ['accepted', 'heading_to_store', 'at_store', 'heading_to_customer', 'delivered'];
  
  return serviceType === 'run_errand' ? errandStatuses : pickupStatuses;
}
```

**Step 3 — Make sure the order object is hydrated at the point of emit**

A common cause of this bug is that `order.serviceType` is undefined or stale at the time the status emit fires, so it fails the conditional silently. Log it:

```js
function emitOrderStatus(status) {
  console.log('[emit] serviceType:', order.serviceType, '| status:', status);
  // ... rest of logic
}
```

If it logs `undefined`, your order state is not set before this function runs. Fix the data flow — fetch/set the full order object (including `serviceType`) when the runner accepts the order.

**Step 4 — Verify the runner is listening to the right event**

On the runner side, confirm you have:

```js
socket.on('order_status_update', (data) => {
  console.log('[runner] received status update:', data);
  // Update runner UI here
});
```

If this log never fires even after fixing Step 2, the runner is either not in the right socket room, or the event name doesn't match.

---

## Bug 4 — Stale Data on Runner Side After Service Type Switch

### What's Happening
When a new order comes in after a previous one, the runner side is showing leftover state from the old order (wrong statuses, old data, etc.). The runner's state isn't being wiped clean between orders.

### Step-by-Step Fix

**Step 1 — Reset all order-specific state when a new order is accepted**

```js
socket.on('new_order_assigned', (newOrder) => {
  // Reset EVERYTHING order-related before setting new order
  setCurrentOrder(null);
  setOrderStatus(null);
  setMessages([]);
  setPaymentStatus(null);
  setIsDelivered(false);

  // Then set the new order
  setCurrentOrder(newOrder);
});
```

**Step 2 — Leave the old socket room and join the new one**

If you use socket rooms per order (e.g. `order_${orderId}`), make sure the runner leaves the old room before joining the new one. Otherwise they get events from both orders simultaneously.

```js
// Server-side — when runner accepts a new order
socket.on('runner_accept_order', ({ runnerId, newOrderId, previousOrderId }) => {
  if (previousOrderId) {
    socket.leave(`order_${previousOrderId}`);
  }
  socket.join(`order_${newOrderId}`);
});
```

**Step 3 — Check React state dependencies**

If you're using `useEffect` to load order data, make sure `orderId` is in the dependency array so it re-fetches on order change:

```js
useEffect(() => {
  if (!orderId) return;
  fetchOrderDetails(orderId).then(setCurrentOrder);
}, [orderId]); // ← orderId must be here, not []
```

---

## Bug 5 — Payment Messages Not Showing on Runner Side

### What's Happening
The user sends a payment confirmation message but the runner never sees it. Either the event isn't being emitted, isn't being listened to, or the message isn't being added to the runner's chat state.

### Step-by-Step Fix

**Step 1 — Verify the event is being emitted when user pays**

In the user-side payment flow:

```js
// After payment is confirmed (e.g. Paystack callback, manual confirmation, etc.)
function onPaymentConfirmed(paymentDetails) {
  socket.emit('payment_message', {
    orderId: currentOrder.id,
    message: 'Payment sent',
    amount: paymentDetails.amount,
    reference: paymentDetails.reference,
    timestamp: Date.now(),
  });
}
```

**Step 2 — Verify the runner has a listener for this exact event**

```js
// On runner side
socket.on('payment_message', (data) => {
  console.log('[runner] payment message received:', data);
  setMessages(prev => [...prev, {
    type: 'payment',
    ...data,
  }]);
});
```

Common mistake: the event is named `'payment_confirmed'` on one side and `'payment_message'` on the other. They must match exactly.

**Step 3 — Confirm the runner is in the correct order room when this fires**

Payment confirmation often fires after the runner has been idle for a while. If socket rooms have a timeout or the runner's connection dropped and reconnected, they may have left the order room. On reconnect, re-join:

```js
socket.on('reconnect', () => {
  if (currentOrder?.id) {
    socket.emit('rejoin_order_room', { orderId: currentOrder.id });
  }
});
```

Server-side:

```js
socket.on('rejoin_order_room', ({ orderId }) => {
  socket.join(`order_${orderId}`);
});
```

---

## Bug 6 — "Mark as Delivered" Unlocking Before Payment

### What's Happening
The runner can see and tap "Mark as Delivered" even though payment hasn't been confirmed. The payment state is not being used to gate this button.

### Fix

```js
// The button must be gated on payment confirmation
const canMarkDelivered = orderStatus === 'heading_to_customer' && paymentConfirmed;

<Button
  onPress={handleMarkDelivered}
  disabled={!canMarkDelivered}
>
  Mark as Delivered
</Button>
```

Where `paymentConfirmed` is set to `true` only when you receive the payment event:

```js
socket.on('payment_message', (data) => {
  setPaymentConfirmed(true); // ← this gates the button
  setMessages(prev => [...prev, { type: 'payment', ...data }]);
});
```

Make sure `paymentConfirmed` initializes to `false` and resets to `false` on every new order (see Bug 4 reset logic).

---

## Bug 7 — Safari iOS: Permission Granted, No Recording

### What's Happening
On Safari (iPhone), you tap record, grant microphone permission, see the iOS recording banner, but nothing is actually recorded. Clicking stop/cancel does nothing. This is a known iOS Safari + MediaRecorder quirk with specific constraints.

### Step-by-Step Fix

**Step 1 — Check supported MIME types before recording**

Safari on iOS supports `audio/mp4` (not `audio/webm`). You need to check at runtime:

```js
function getSupportedMimeType() {
  const types = [
    'audio/mp4',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
}
```

**Step 2 — Request constraints correctly for iOS**

```js
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      }
    });

    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};
    
    const mediaRecorder = new MediaRecorder(stream, options);
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'audio/mp4' });
      // send this blob (convert to base64 first — see Bug 1)
      stream.getTracks().forEach(track => track.stop()); // release mic
    };

    // IMPORTANT: On iOS, you must call start with a timeslice
    // Without timeslice, ondataavailable never fires on Safari
    mediaRecorder.start(250); // collect data every 250ms
    
    setMediaRecorder(mediaRecorder);
    setIsRecording(true);

  } catch (err) {
    console.error('Recording failed:', err.name, err.message);
    if (err.name === 'NotAllowedError') {
      alert('Microphone permission denied. Please enable it in Settings.');
    }
  }
}
```

**Step 3 — Stop recording correctly**

```js
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop(); // This triggers onstop after final ondataavailable
  }
}
```

**Step 4 — Handle the case where MediaRecorder is not supported**

Very old iOS versions don't support MediaRecorder at all. Provide a fallback:

```js
if (!window.MediaRecorder) {
  // Show user a message: "Audio recording is not supported on your browser.
  // Please update Safari or use the file picker to attach an audio file."
  setRecordingSupported(false);
}
```

**Step 5 — On the server/receiver: convert mp4 to webm if needed**

If your Android runners receive `audio/mp4` from iOS senders, they can play it natively. But if you need a uniform format, convert on the server using FFmpeg. This is optional — test cross-platform playback first before adding this complexity.

---

## General: Socket Architecture Checklist

Run through this checklist after fixing the above bugs:

- [ ] Socket is initialized once and reused (not re-created on re-render)
- [ ] All listeners are removed in component cleanup (`socket.off(...)` in `useEffect` return)
- [ ] Every `socket.emit` is paired with a handler on the other side using the exact same event name
- [ ] `serviceType` is always sent with order events so the receiver can interpret them correctly
- [ ] Socket rooms are left when an order completes and joined fresh for new orders
- [ ] On reconnect, the client re-joins its active order room
- [ ] Media is never sent as a Blob URL — always base64 or uploaded to storage with a URL
- [ ] No `socket.emit` is fired inside a function that runs more than once per user action

---

## Recommended Extra Resources

These will help you move faster and reduce fragility:

**1. Use a message store (Zustand or Redux) for chat state**
Rather than managing messages in component `useState`, a centralized store ensures all parts of the app (chat screen, payment confirmation, status updates) share the same single source of truth and can update it without prop-drilling or stale closures.

**2. Add socket event logging middleware (dev only)**
```js
// Wrap socket events with logging in dev mode
if (__DEV__) {
  const originalEmit = socket.emit.bind(socket);
  socket.emit = (event, ...args) => {
    console.log(`[socket:emit] ${event}`, args);
    return originalEmit(event, ...args);
  };
  socket.onAny((event, ...args) => {
    console.log(`[socket:recv] ${event}`, args);
  });
}
```
This alone would have caught bugs 2, 3, and 5 instantly during testing.

**3. Consider Cloudinary or AWS S3 for media**
Instead of sending base64 audio/images over the socket (which is bandwidth-heavy and can hit payload limits), upload the file first, get back a URL, then emit just the URL. Playback is more reliable, duration metadata loads correctly, and you avoid the iOS/Android MIME mismatch problem.

**4. Use Socket.IO acknowledgements for critical events**
For payment messages and order status changes, use acknowledgements so you know the server received the event:
```js
socket.emit('payment_message', data, (ack) => {
  if (ack?.success) {
    console.log('Payment message confirmed by server');
  } else {
    // Retry or show error
  }
});
```

---

*Last updated: April 2026. Fix each section independently and test in a staging environment with two real devices before retesting with your PM.*