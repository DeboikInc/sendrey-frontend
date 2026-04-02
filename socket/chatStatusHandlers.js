// handlers for chat and status
const { Chat } = require("../models/Chat");
const StatusEngine = require('../services/statusEngine');
const MediaService = require('../services/mediaService');
const { getReports } = require('../services/businessService');
const { STATUS_FLOWS, TASK_TYPES } = require('../config/constants');
const { logMetric } = require('../utils/metricsLogger');
const { checkAndSuggestBusiness } = require('../services/businessService');

const Task = require('../models/Task');
const User = require('../models/User');
const Order = require('../models/Order');

// Map backend status codes to human-readable labels
const getStatusLabel = (status) => {
  const labels = {
    'arrived_at_market': 'Arrived at market',
    'purchase_in_progress': 'Purchase in progress',
    'purchase_completed': 'Purchase completed',
    'en_route_to_delivery': 'En route to delivery',
    'arrived_at_delivery_location': 'Arrived at delivery location',
    'task_completed': 'Task completed',
    'arrived_at_pickup_location': 'Arrived at pickup location',
    'item_collected': 'Item collected'
  };

  return labels[status] || status.replace(/_/g, ' ');
};
const snapshotCompletedTask = async (chat, runnerId) => {
  try { // pull the user's currentRequest so we can snapshot it before it gets wiped
    const userId = chat.participants?.find(p => p.userType === 'user')?.userId;
    if (!userId) return;
    const user = await User.findById(userId).lean();
    if (!user || !user.currentRequest) return;
    const cr = user.currentRequest;

    // don't create a duplicate if this task was already snapshotted
    const existing = await Task.findOne({ taskId: chat.taskId || chat.chatId });
    if (existing) return;
    await Task.create({
      taskId: chat.taskId || chat.chatId,
      userId: user._id,
      runnerId,
      businessAccount: cr.businessAccount || null,
      createdByMember: cr.createdByMember || null,
      serviceType: cr.serviceType,
      fleetType: cr.fleetType,
      pickupLocation: cr.pickupLocation || null,
      pickupPhone: cr.pickupPhone || null,
      pickupItems: cr.pickupItems || null,
      pickupCoordinates: cr.pickupCoordinates || null,
      marketLocation: cr.marketLocation || null,
      marketItems: cr.marketItems || null,
      budget: cr.budget || null,
      budgetFlexibility: cr.budgetFlexibility || null,
      marketCoordinates: cr.marketCoordinates || null,
      deliveryLocation: cr.deliveryLocation || null,
      dropoffPhone: cr.dropoffPhone || null,
      specialInstructions: cr.specialInstructions || null,
      // amount comes from the invoice — we'll update this separately
      amount: 0,
      status: "completed",
      completedAt: new Date(),
    });
    console.log(`Task snapshotted for chat ${chat.chatId}`);
  } catch (err) {
    // log but don't crash the status update if snapshot fails
    console.error('Failed to snapshot task:', err.message);
  }
}
const handleUpdateStatus = async (socket, io, data) => {
  const startTime = Date.now();
  try {
    const { chatId, status, serviceType: clientServiceType, updatedBy, updatedByType } = data;

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

    const order = await Order.findOne({
      chatId,
      status: { $nin: ['completed', 'cancelled'] }
    }).sort({ createdAt: -1 }).select('orderId serviceType').lean();

    const resolvedServiceType = order?.serviceType || clientServiceType || chat.serviceType;


    console.log('Resolved serviceType:', resolvedServiceType, '(chat:', chat.serviceType, ', client:', clientServiceType, ')');

    if (!resolvedServiceType) {
      return socket.emit('error', { message: 'Cannot determine service type' });
    }

    const taskType = resolvedServiceType === 'run-errand'
      ? TASK_TYPES.RUN_ERRAND
      : TASK_TYPES.PICK_UP;

    if (!taskType) {
      return socket.emit('error', { message: `Unknown serviceType: ${resolvedServiceType}` });
    }

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

    const userId = chatId.match(/user-([^-]+(?:-[^-]+)*)-runner/)?.[1];
    io.to(chatId).emit('message', systemMessage);


    try {

      const trackingOrderId = order?.orderId;
      if (trackingOrderId) {
        if (status === 'arrived_at_market' || status === 'arrived_at_pickup_location') {
          io.to(`tracking:${trackingOrderId}`).emit('runner:arrivedAtSource', { orderId: trackingOrderId });
        } else if (status === 'en_route_to_delivery') {
          io.to(`tracking:${trackingOrderId}`).emit('runner:enRoute', { orderId: trackingOrderId });
        } else if (status === 'arrived_at_delivery_location') {
          io.to(`tracking:${trackingOrderId}`).emit('runner:arrivedAtDelivery', { orderId: trackingOrderId });
        }
      }
    } catch (err) {
      console.warn('Tracking event emit failed:', err.message);
    }

    console.log(`Status updated to ${status} (${displayText}) in chat ${chatId}`);

    // Emit to chat room
    io.to(chatId).emit('message', systemMessage);
    const socketsInRoom = await io.in(chatId).fetchSockets();
    console.log(`Sockets in room "${chatId}":`, socketsInRoom.map(s => s.id));
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

    // when the task is fully done, save a permanent record for expense reporting
    if (status === 'task_completed') {
      await snapshotCompletedTask(chat, runnerId);

      const userId = chat.participants?.find(p => p.userType === 'user')?.userId;
      if (userId) {
        checkAndSuggestBusiness(userId).catch(() => { });

        // Expense summary for business accounts 
        try {
          const user = await User.findById(userId).select('accountType lastExpenseSummaryAt');
          if (user?.accountType === 'business') {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const shouldSend = !user.lastExpenseSummaryAt || user.lastExpenseSummaryAt < oneWeekAgo;

            if (shouldSend) {
              const reports = await getReports(userId, 'monthly');
              const latest = reports?.[0];

              if (latest) {
                const summaryMessage = {
                  id: `expense-summary-${Date.now()}`,
                  from: 'system',
                  type: 'system',
                  messageType: 'system',
                  senderType: 'system',
                  senderId: 'system',
                  text: `📊 Your business spent ₦${latest.totalSpend.toLocaleString()} this month across ${latest.totalTasks} ${latest.totalTasks === 1 ? 'delivery' : 'deliveries'}. View the full breakdown in Settings → Business → Reports.`,
                  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                  status: 'sent',
                  style: 'info'
                };

                chat.messages.push(summaryMessage);
                await chat.save();
                io.to(chatId).emit('message', summaryMessage);

                // update throttle timestamp
                await User.findByIdAndUpdate(userId, { lastExpenseSummaryAt: new Date() });
              }
            }
          }
        } catch (err) {
          console.error('Expense summary failed:', err.message);
        }

      }
    }

    const latency = Date.now() - startTime;
    await logMetric({
      type: 'status_update',
      status: 'success',
      latency,
      chatId,
      userId: updatedBy,
      userType: updatedByType,
      userType: data.updatedByType || 'runner',
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
      userType: data.updatedByType || 'runner',
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
    socket.to(chatId).emit('message', message);
    socket.emit('mediaSent', { success: true,  message });
  } catch (error) {
    console.error('Error sending media:', error);
    socket.emit('error', { message: error.message });
  }
};

module.exports = {
  handleUpdateStatus,
  handleSendMedia
};