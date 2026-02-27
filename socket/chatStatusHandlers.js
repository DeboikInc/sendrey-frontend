// handlers for chat and status
const { Chat } = require("../models/Chat");
const StatusEngine = require('../services/statusEngine');
const MediaService = require('../services/mediaService');
const { STATUS_FLOWS, TASK_TYPES } = require('../config/constants');
const { logMetric } = require('../utils/metricsLogger');
const Order = require('../models/Order');

// Map backend status codes to human-readable labels
const getStatusLabel = (status) => {
  const labels = {
    'arrived_at_market': 'Arrived at market',
    'purchase_in_progress': 'Purchase in progress',
    'purchase_completed': 'Purchase completed',
    'en_route_to_delivery': 'En route to delivery',
    'task_completed': 'Task completed',
    'arrived_at_pickup_location': 'Arrived at pickup location',
    'item_delivered': 'Item delivered'
  };

  return labels[status] || status.replace(/_/g, ' ');
};

const handleUpdateStatus = async (socket, io, data) => {
  const startTime = Date.now(); // FIX: was missing, caused ReferenceError

  try {
    const { chatId, status, serviceType: clientServiceType, updatedBy, updatedByType } = data;

    // Extract runnerId from chatId if socket.runnerId is not set
    let runnerId = socket.runnerId;

    if (!runnerId) {
      const match = chatId.match(/runner-(.+)$/);
      if (match) {
        runnerId = match[1];
        console.log('socket.runnerId not set, extracted from chatId:', runnerId);
      }
    }

    if (!runnerId) {
      console.error('No runnerId found on socket or in chatId:', chatId);
      return socket.emit('error', { message: 'Runner ID not found' });
    }

    console.log('updateStatus received:', { chatId, status, runnerId });

    const chat = await Chat.findOne({ chatId });

    // Backfill taskId/orderId if missing (for orders created before the fix)
    if (!chat.taskId && !chat.orderId) {
      const order = await Order.findOne({ chatId });
      if (order) {
        chat.taskId = order.orderId;
        chat.orderId = order.orderId;
        chat.userId = order.userId;
        chat.runnerId = order.runnerId;
        await Chat.findOneAndUpdate(
          { chatId },
          { $set: { taskId: order.orderId, orderId: order.orderId, userId: order.userId, runnerId: order.runnerId } }
        );
        console.log('Backfilled chat with orderId:', order.orderId);
      }
    }

    if (!chat) {
      console.error('Chat not found:', chatId);
      return socket.emit('error', { message: 'Chat not found' });
    }

    const resolvedServiceType = chat.serviceType || clientServiceType;

    console.log('Resolved serviceType:', resolvedServiceType);

    if (!resolvedServiceType) {
      return socket.emit('error', { message: 'Cannot determine service type' });
    }


    const taskType = (resolvedServiceType === 'run_errand' || resolvedServiceType === 'run-errand')
      ? TASK_TYPES.RUN_ERRAND
      : TASK_TYPES.PICKUP_DELIVERY;

    console.log('Task type:', taskType);

    const validStatuses = STATUS_FLOWS[taskType];
    if (!validStatuses.includes(status)) {
      console.error('Invalid status:', status, 'for task type:', taskType);
      return socket.emit('error', {
        message: `Invalid status "${status}" for task type "${taskType}". Valid: ${validStatuses.join(', ')}`
      });
    }

    const displayText = getStatusLabel(status);

    // Create system message
    const systemMessage = {
      id: Date.now().toString(),
      from: 'system',
      messageType: 'system',
      type: 'system',
      orderId: status === 'task_completed'
        ? (chat.taskId || chat.orderId || data.orderId || null)
        : null,
      text: displayText,
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      senderId: 'system',
      senderType: 'system',
      status: 'sent',
      style: 'info'
    };

    chat.messages.push(systemMessage);
    chat.lastActivity = new Date();
    await chat.save();

    console.log(`Status updated to ${status} (${displayText}) in chat ${chatId}`);

    io.to(chatId).emit('message', systemMessage);

    if (status === 'en_route_to_delivery') {
      const order = await Order.findOne({
        orderId: chat.taskId || chat.orderId
      }).select('orderId runnerId userId');

      io.to(chatId).emit('trackingStarted', {
        orderId: order?.orderId || chat.taskId || chat.orderId,
        runnerId: runnerId,
        chatId,
        message: 'Runner is on the way'
      });

      console.log(`Emitted trackingStarted to chat ${chatId}`);
    }

    console.log(`order id: ${systemMessage.orderId}`);
    console.log(`Emitted system message to room ${chatId}`);

    // Update status via StatusEngine
    if (chat.taskId) {
      try {
        await StatusEngine.update(chat.taskId, runnerId, status, taskType);
      } catch (err) {
        console.warn('StatusEngine update failed:', err.message);
      }
    }

    // Confirm to sender
    socket.emit('statusUpdated', {
      status,
      chatId,
      displayText,
      serviceType: chat.serviceType
    });

    // task_completed should prompt rating on user side
    if (status === 'task_completed') {

      // Update order status to completed
      await Order.findOneAndUpdate(
        { orderId: chat.taskId || chat.orderId },
        { $set: { status: 'completed' } }
      );

      setTimeout(() => {
        io.to(chatId).emit('promptRating', {
          orderId: chat.taskId || chat.orderId || data.orderId,
          chatId,
          userId: chat.userId,
          runnerId: chat.runnerId,
        });
        console.log('Emitted promptRating to', chatId);
      }, 1000);
    }

    const latency = Date.now() - startTime;
    await logMetric({
      type: 'status_update',
      status: 'success',
      latency,
      chatId,
      userId: updatedBy || runnerId,
      userType: updatedByType || 'runner',
      metadata: { newStatus: status }
    });

  } catch (error) {
    console.error('Error updating status:', error);

    const latency = Date.now() - startTime;
    await logMetric({
      type: 'status_update',
      status: 'failed',
      latency,
      chatId: data.chatId,
      userId: data.updatedBy || data.runnerId || 'unknown',
      userType: data.updatedByType || 'runner',  // FIX: never null
      error: error.message
    });

    socket.emit('error', { message: error.message });
  }
};

// media e.g picture etc
const handleSendMedia = async (socket, io, data) => {
  try {
    const { chatId, fileUrl, fileName, fileType, caption = '' } = data;
    const senderId = socket.userId || socket.runnerId;
    const senderType = socket.userId ? 'user' : 'runner';

    const chat = await Chat.findOne({ chatId });
    if (!chat) return socket.emit('error', { message: 'Chat not found' });

    if (chat.taskId) {
      await MediaService.createMediaRecord({
        taskId: chat.taskId,
        uploaderId: senderId,
        uploaderType: senderType,
        fileUrl,
        fileName,
        fileType
      });
    }

    const message = {
      id: Date.now().toString(),
      from: senderType === 'user' ? 'them' : 'me',
      text: caption,
      type: 'media',
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      senderId,
      senderType,
      fileUrl,
      fileName,
      fileType,
      status: 'sent'
    };

    chat.messages.push(message);
    chat.lastActivity = new Date();
    await chat.save();

    io.to(chatId).emit('message', message);
    socket.emit('mediaSent', { success: true });
  } catch (error) {
    console.error('Error sending media:', error);
    socket.emit('error', { message: error.message });
  }
};

module.exports = {
  handleUpdateStatus,
  handleSendMedia
};