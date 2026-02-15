// handlers for chat and status
const { Chat } = require("../models/Chat");
const StatusEngine = require('../services/statusEngine');
const MediaService = require('../services/mediaService');
const { STATUS_FLOWS, TASK_TYPES } = require('../config/constants');
const { logMetric } = require('../utils/metricsLogger');

// Map backend status codes to human-readable labels
const getStatusLabel = (status) => {
  const labels = {
    'arrived_at_market': 'Arrived at market',
    'purchase_in_progress': 'Purchase in progress',
    'purchase_completed': 'Purchase completed',
    'en_route_to_delivery': 'En route to delivery',
    'task_completed': 'Task completed',
    'arrived_at_pickup_location': 'Arrived at pickup location',
    'item_collected': 'Item collected'
  };

  return labels[status] || status.replace(/_/g, ' ');
};

const handleUpdateStatus = async (socket, io, data) => {
  try {
    const { chatId, status, serviceType: clientServiceType } = data;

    // Extract runnerId from chatId if socket.runnerId is not set
    let runnerId = socket.runnerId;

    if (!runnerId) {
      // Parse from chatId format: user-{userId}-runner-{runnerId}
      const match = chatId.match(/runner-(.+)$/);
      if (match) {
        runnerId = match[1];
        console.log('socket.runnerId not set, extracted from chatId:', runnerId);
      }
    }

    if (!runnerId) {
      console.error(' No runnerId found on socket or in chatId:', chatId);
      return socket.emit('error', { message: 'Runner ID not found' });
    }

    console.log('updateStatus received:', { chatId, status, runnerId });

    const chat = await Chat.findOne({ chatId });
    if (!chat) {
      console.error(' Chat not found:', chatId);
      return socket.emit('error', { message: 'Chat not found' });
    }

    // Map serviceType to taskType
    const resolvedServiceType = chat.serviceType || clientServiceType;

    console.log('Resolved serviceType:', resolvedServiceType, '(chat:', chat.serviceType, ', client:', clientServiceType, ')');

    if (!resolvedServiceType) {
      return socket.emit('error', { message: 'Cannot determine service type' });
    }

    const taskType = resolvedServiceType === 'run-errand'
      ? TASK_TYPES.SHOPPING
      : TASK_TYPES.PICKUP_DELIVERY;

    console.log('Task type:', taskType);

    const validStatuses = STATUS_FLOWS[taskType];
    if (!validStatuses.includes(status)) {
      console.error(' Invalid status:', status, 'for task type:', taskType);
      return socket.emit('error', {
        message: `Invalid status "${status}" for task type "${taskType}". Valid: ${validStatuses.join(', ')}`
      });
    }

    // Get human-readable label
    const displayText = getStatusLabel(status);

    // Create system message
    const systemMessage = {
      id: Date.now().toString(),
      from: 'system',
      messageType: 'system',
      type: 'system',
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

    // Save message to chat
    chat.messages.push(systemMessage);
    chat.lastActivity = new Date();
    await chat.save();

    console.log(`Status updated to ${status} (${displayText}) in chat ${chatId}`);

    // Emit to chat room
    io.to(chatId).emit('message', systemMessage);
    console.log(`Emitted system message to room ${chatId}`);

    // Update status via StatusEngine (if you still need it for tracking)
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

    const latency = Date.now() - startTime;
    await logMetric({
      type: 'status_update',
      status: 'success',
      latency,
      chatId,
      userId: updatedBy,
      userType: updatedByType,
      metadata: { newStatus: status }
    });
  } catch (error) {
    console.error(' Error updating status:', error);

    await logMetric({
      type: 'status_update',
      status: 'failed',
      chatId: data.chatId,
      userId: data.updatedBy,
      userType: data.updatedByType,
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

    // Create media record
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

    // Create message object matching your format
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

    // Save to chat
    chat.messages.push(message);
    chat.lastActivity = new Date();
    await chat.save();

    // Broadcast to chat room
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