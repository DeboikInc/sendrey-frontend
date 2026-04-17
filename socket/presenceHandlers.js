// socket/presenceHandlers.js
const redis = require('../config/redis');
const User = require('../models/User');
const Runner = require('../models/Runner');
const { sendPushNotification } = require('../utils/sendPushNotification');

const getRedis = () => redis.getClient();

const parseChat = (chatId) => {
  const parts = chatId?.split('-runner-');
  const userId = parts?.[0]?.replace('user-', '');
  const runnerId = parts?.[1];
  return { userId, runnerId };
};

const handleUserOnline = async (socket, io, { userId, userType, chatId }) => {
  if (!chatId || !userId) return;

  socket.userId = userId;
  socket.userType = userType;
  socket.chatId = chatId;
  if (userType === 'runner') socket.runnerId = userId;

  try {
    await getRedis().set(`presence:${userType}:${userId}`, chatId, 'EX', 300);
  } catch (e) {
    console.error('Redis presence set failed:', e);
  }

  const { userId: chatUserId, runnerId: chatRunnerId } = parseChat(chatId);
  if (!chatUserId || !chatRunnerId) return;

  const isRunner = userType === 'runner';
  const partnerType = isRunner ? 'user' : 'runner';
  const partnerId = isRunner ? chatUserId : chatRunnerId;

  io.to(`${partnerType}-${partnerId}`).emit('partnerOnline', {
    chatId, userId, userType, timestamp: new Date().toISOString(),
  });

  const Model = isRunner ? Runner : User;
  Model.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() })
    .catch(err => console.error('Error updating online status:', err));
};

const handleUserDisconnect = async (socket, io) => {
  const { userId, userType, chatId } = socket;
  if (!userId || !userType) return;

  try {
    await getRedis().del(`presence:${userType}:${userId}`);
  } catch (e) {
    console.error('Redis presence delete failed:', e);
  }

  if (chatId) {
    const { userId: chatUserId, runnerId: chatRunnerId } = parseChat(chatId);
    if (chatUserId && chatRunnerId) {
      const isRunner = userType === 'runner';
      const partnerType = isRunner ? 'user' : 'runner';
      const partnerId = isRunner ? chatUserId : chatRunnerId;

      io.to(`${partnerType}-${partnerId}`).emit('partnerOffline', {
        chatId, userId, userType, timestamp: new Date().toISOString(),
      });
    }
  }

  try {
    if (userType === 'user') {
      const user = await User.findByIdAndUpdate(userId,
        { isOnline: false, lastSeen: new Date() }, { new: true });
      if (user?.currentRunnerId) {
        const runner = await Runner.findById(user.currentRunnerId);
        if (runner?.fcmToken && !runner.isOnline) {
          await sendPushNotification(runner.fcmToken, {
            title: 'User Offline Alert',
            body: `${user.firstName} ${user.lastName || ''} has gone offline`,
            data: { type: 'user_offline', userId: user._id.toString(), chatId },
            link: `/runner/chat/${chatId}`,
          });
        }
      }
    } else if (userType === 'runner') {
      const runner = await Runner.findByIdAndUpdate(userId,
        { isOnline: false, lastSeen: new Date() }, { new: true });
      if (runner?.currentUserId) {
        const user = await User.findById(runner.currentUserId);
        if (user?.fcmToken && !user.isOnline) {
          await sendPushNotification(user.fcmToken, {
            title: 'Runner Offline Alert',
            body: `Your runner ${runner.firstName} ${runner.lastName || ''} has gone offline`,
            data: { type: 'runner_offline', runnerId: runner._id.toString(), chatId },
            link: `/chat/${chatId}`,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error handling disconnect:', error);
  }
};

const handleQueryPresence = async (socket, { chatId, userId, userType }) => {
  try {
    const { userId: chatUserId, runnerId: chatRunnerId } = parseChat(chatId);
    const isRunner = userType === 'runner';
    const partnerType = isRunner ? 'user' : 'runner';
    const partnerId = isRunner ? chatUserId : chatRunnerId;

    const partnerPresence = await getRedis().get(`presence:${partnerType}:${partnerId}`);

    socket.emit('partnerPresenceStatus', {
      chatId,
      isOnline: !!partnerPresence,
      partnerType,
      partnerId,
    });
  } catch (e) {
    console.error('queryPresence error:', e);
  }
};

const handleHeartbeat = async (socket) => {
  if (!socket.userId || !socket.userType) return;
  try {
    await getRedis().expire(`presence:${socket.userType}:${socket.userId}`, 300);
  } catch (e) { /* silent */ }
};

const registerPresenceHandlers = (socket, io) => {
  socket.on('userOnline', (data) => handleUserOnline(socket, io, data));
  socket.on('queryPresence', (data) => handleQueryPresence(socket, data));
  socket.on('pong', () => handleHeartbeat(socket));
};

module.exports = {
  registerPresenceHandlers,
  handleUserDisconnect,
};