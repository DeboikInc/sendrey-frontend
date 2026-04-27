// callHandlers.js
const { CallLog, Chat } = require("../models/Chat");
const { generateToken } = require('../config/generateAgoraToken');
const { logMetric } = require('../utils/metricsLogger');
const { auditLog } = require('../middleware/auth');
const { notifyIncomingCall } = require('../services/notificationService');

const getDisplayName = async (userId, userType) => {
  try {
    if (userType === 'user') {
      const User = require('../models/User');
      const user = await User.findById(userId).select('firstName lastName').lean();
      return user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User';
    } else {
      const Runner = require('../models/Runner');
      const runner = await Runner.findById(userId).select('firstName lastName').lean();
      return runner ? `${runner.firstName} ${runner.lastName || ''}`.trim() : 'Runner';
    }
  } catch (err) {
    console.error('getDisplayName error:', err);
    return userType === 'user' ? 'User' : 'Runner';
  }
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0
    ? `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`
    : `${secs} second${secs !== 1 ? 's' : ''}`;
};

const buildCallMessage = (text, metadata = {}) => ({
  id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  from: 'system',
  type: 'call',
  messageType: 'call',
  text,
  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  senderId: 'system',
  senderType: 'system',
  status: 'sent',
  createdAt: new Date(),
  ...metadata,
});

const broadcastCallMessage = (io, msg, chatId, callerId, callerType, receiverId, receiverType) => {
  io.to(chatId).emit('message', msg);

  const roomSockets = io.sockets.adapter.rooms.get(chatId) || new Set();

  const callerInRoom = [...roomSockets].some(sid => {
    const s = io.sockets.sockets.get(sid);
    return s?.userId === callerId || s?.runnerId === callerId;
  });
  if (!callerInRoom) io.to(`${callerType}-${callerId}`).emit('message', msg);

  const receiverInRoom = [...roomSockets].some(sid => {
    const s = io.sockets.sockets.get(sid);
    return s?.userId === receiverId || s?.runnerId === receiverId;
  });
  if (!receiverInRoom) io.to(`${receiverType}-${receiverId}`).emit('message', msg);
};

const persistCallMessage = (chatId, msg) => {
  Chat.findOne({ chatId })
    .then(chat => {
      if (chat) {
        chat.messages.push(msg);
        chat.lastActivity = new Date();
        return chat.save();
      }
      return Chat.create({ chatId, messages: [msg], createdBy: 'system', createdAt: new Date() });
    })
    .catch(err => console.error('[callHandlers] persistCallMessage error:', err));
};

// ─── Register ─────────────────────────────────────────────────────────────────

const register = (socket, io) => {
  const nameCache = new Map();
  const cachedName = async (id, type) => {
    const k = `${type}:${id}`;
    if (nameCache.has(k)) return nameCache.get(k);
    const n = await getDisplayName(id, type);
    nameCache.set(k, n);
    return n;
  };

  // Caller starts a call
  socket.on('initiateCall', (data) => {
    const { chatId, callType, callerId, callerType, receiverId, receiverType, channelName } = data;
    const callId = data.callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const token = generateToken(channelName);

    // ── EMIT IMMEDIATELY — no await, no DB lookup ──────────────────────────
    // The receiver's UI already knows the caller's name from chat context,
    // so callerName is a nice-to-have, not required for the ring to start.
    const incomingPayload = {
      callId, chatId, callType, callerId, callerType, receiverId, channelName, token,
    };

    io.to(`${receiverType}-${receiverId}`).emit('incomingCall', incomingPayload);
    io.to(`${callerType}-${callerId}`).emit('callToken', { callId, channelName, token });

    // ── Push notification (fire and forget) ───────────────────────────────
    notifyIncomingCall(receiverId, receiverType, incomingPayload).catch(console.error);

    // ── Name lookup + system message (non-blocking) ───────────────────────
    cachedName(callerId, callerType).then(callerName => {
      const callLabel = callType === 'video' ? 'video call' : 'voice call';
      const msg = buildCallMessage(`${callerName} started a ${callLabel}`, {
        callId, callType, callerId, callerType, callState: 'initiated',
      });

      broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
      persistCallMessage(chatId, msg);

      // Re-emit with callerName now resolved so receiver UI can display it
      // (UI should gracefully handle receiving this after ringing started)
      io.to(`${receiverType}-${receiverId}`).emit('callCallerName', { callId, callerName });
    });

    auditLog('CALL_INITIATED');
  });

  // Receiver accepts
  socket.on('acceptCall', async (data) => {
    const { callId, chatId, callType, channelName, callerId, callerType, receiverId, receiverType } = data;

    // Tell caller immediately — no await
    io.to(`${callerType}-${callerId}`).emit('callAccepted', { callId, chatId, callType, channelName });

    // Name + message after
    cachedName(receiverId, receiverType).then(receiverName => {
      const callLabel = callType === 'video' ? 'video call' : 'voice call';
      const msg = buildCallMessage(`${receiverName} accepted the ${callLabel}`, {
        callId, callType, receiverId, receiverType, callState: 'accepted',
      });
      broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
      persistCallMessage(chatId, msg);
    });

    auditLog('CALL_ACCEPTED');
  });

  // Receiver declines
  socket.on('declineCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType, callType } = data;

    // Tell caller immediately
    io.to(`${callerType}-${callerId}`).emit('callDeclined', { callId, chatId });

    cachedName(receiverId, receiverType).then(receiverName => {
      const callLabel = callType === 'video' ? 'video call' : 'voice call';
      const msg = buildCallMessage(`${receiverName} declined the ${callLabel}`, {
        callId, receiverId, receiverType, callState: 'declined',
      });
      broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
      persistCallMessage(chatId, msg);
    });

    auditLog('CALL_DECLINED');
  });

  // Either party ends
  socket.on('endCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType, duration, callType } = data;

    // Emit callEnded immediately to both parties
    io.to(chatId).emit('callEnded', { callId, chatId });
    if (receiverId && receiverType) {
      io.to(`${receiverType}-${receiverId}`).emit('callEnded', { callId, chatId });
    }
    io.to(`${callerType}-${callerId}`).emit('callEnded', { callId, chatId });

    // Name + message + log after
    const endedBy = socket.userId || socket.runnerId;
    const endedByType = socket.userId ? 'user' : 'runner';
    cachedName(endedBy, endedByType).then(endedByName => {
      const callLabel = callType === 'video' ? 'video call' : 'voice call';
      const msg = buildCallMessage(`${endedByName} ended the ${callLabel} · ${formatDuration(duration)}`, {
        callId, callType, duration, endedBy, endedByType, callState: 'ended',
      });
      broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
      persistCallMessage(chatId, msg);

      const parts = chatId.split('-runner-');
      const userId = parts[0]?.replace('user-', '') || null;
      const runnerId = parts[1] || null;

      CallLog.create({
        taskId: chatId, callId, callerId, callerType,
        receiverId: receiverId || (callerType === 'user' ? runnerId : userId),
        receiverType: receiverType || (callerType === 'user' ? 'runner' : 'user'),
        type: callType,
        startTime: new Date(Date.now() - duration * 1000),
        endTime: new Date(), duration, status: 'completed',
      })
        .then(() => logMetric({ type: 'call', status: 'success', chatId, userId: callerId, userType: callerType, metadata: { callType, duration } }))
        .catch(err => {
          console.error('endCall log error:', err);
          logMetric({ type: 'call', status: 'failed', chatId, userId: callerId, userType: callerType, error: err.message });
        });
    });

    auditLog('CALL_ENDED');
  });

  // No answer — missed
  socket.on('missedCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType, callType } = data;

    cachedName(callerId, callerType).then(callerName => {
      const callLabel = callType === 'video' ? 'video call' : 'voice call';
      const msg = buildCallMessage(`Missed ${callLabel} from ${callerName}`, {
        callId, callerId, callerType, receiverId, receiverType, callState: 'missed',
      });
      broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
      persistCallMessage(chatId, msg);
    });

    auditLog('CALL_MISSED');
  });

  // Receiver is busy
  socket.on('rejectCall', async (data) => {
    const { callId, chatId, callerId, callerType, receiverId, receiverType } = data;

    io.to(`${callerType}-${callerId}`).emit('callRejected', { callId, chatId });

    cachedName(receiverId, receiverType).then(receiverName => {
      const msg = buildCallMessage(`${receiverName} is on another call`, {
        callId, receiverId, receiverType, callState: 'rejected',
      });
      broadcastCallMessage(io, msg, chatId, callerId, callerType, receiverId, receiverType);
      persistCallMessage(chatId, msg);
    });

    auditLog('CALL_REJECTED');
  });
};

module.exports = { register };