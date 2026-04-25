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
    'item_delivered': 'Item delivered',
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

    let runnerId = socket.runnerId;
    if (!runnerId) {
      const match = chatId.match(/runner-(.+)$/);
      if (match) runnerId = match[1];
    }
    if (!runnerId) return socket.emit('error', { message: 'Runner ID not found' });

    // ── 1. Fetch chat + order in parallel ──────────────────────────────────
    const [chat, order] = await Promise.all([
      Chat.findOne({ chatId }),
      Order.findOne({ chatId, status: { $nin: ['completed', 'cancelled'] } })
        .sort({ createdAt: -1 }).select('orderId serviceType').lean(),
    ]);

    if (!chat) return socket.emit('error', { message: 'Chat not found' });

    const resolvedServiceType = order?.serviceType || clientServiceType || chat.serviceType;
    if (!resolvedServiceType) return socket.emit('error', { message: 'Cannot determine service type' });

    const taskType = resolvedServiceType === 'run-errand' ? TASK_TYPES.RUN_ERRAND : TASK_TYPES.PICK_UP;
    const validStatuses = STATUS_FLOWS[taskType];
    if (!validStatuses.includes(status)) {
      return socket.emit('error', { message: `Invalid status "${status}" for task type "${taskType}"` });
    }

    const displayText = getStatusLabel(status);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const systemMessage = {
      id: Date.now().toString(),
      from: 'system', messageType: 'system', type: 'system',
      text: displayText, time: timeStr,
      senderId: 'system', senderType: 'system',
      status: 'sent', style: 'info',
    };

    const messagesToPush = [systemMessage];

    let trackingMessage = null;
    if (status === 'en_route_to_delivery' && order?.orderId) {
      trackingMessage = {
        id: `tracking-${Date.now() + 1}`,
        from: 'system', type: 'tracking', messageType: 'tracking',
        time: timeStr, senderId: 'system', senderType: 'system', status: 'sent',
        trackingData: { orderId: order.orderId, runnerId, status: 'en_route_to_delivery' },
      };
      messagesToPush.push(trackingMessage);
    }

    
    const writePromises = [
      // Push messages + update lastActivity in one op
      Chat.findOneAndUpdate(
        { chatId },
        {
          $push: { messages: { $each: messagesToPush } },
          $set: { lastActivity: now },
        }
      ),
      // StatusEngine update (non-blocking)
      chat.taskId
        ? StatusEngine.update(chat.taskId, runnerId, status, taskType).catch(e =>
          console.warn('StatusEngine update failed:', e.message)
        )
        : Promise.resolve(),
      // Metrics log
      logMetric({
        type: 'status_update', status: 'success',
        latency: Date.now() - startTime,
        chatId, userId: updatedBy, userType: updatedByType || 'runner',
        metadata: { newStatus: status },
      }),
    ];

    // task_completed extra writes
    if (status === 'task_completed') {
      writePromises.push(snapshotCompletedTask(chat, runnerId));
    }

    await Promise.all(writePromises);

    // ── 3. Emit — no waiting on DB 
    io.to(chatId).emit('message', systemMessage);
    // if (trackingMessage) io.to(chatId).emit('message', trackingMessage);
    socket.emit('statusUpdated', { status, chatId, displayText, serviceType: resolvedServiceType });

    // Tracking room events (fire and forget)
    if (order?.orderId) {
      const trackingOrderId = order.orderId;
      if (status === 'arrived_at_market' || status === 'arrived_at_pickup_location') {
        io.to(`tracking:${trackingOrderId}`).emit('runner:arrivedAtSource', { orderId: trackingOrderId });
      } else if (status === 'en_route_to_delivery') {
        io.to(`tracking:${trackingOrderId}`).emit('runner:enRoute', { orderId: trackingOrderId });
      } else if (status === 'arrived_at_delivery_location') {
        io.to(`tracking:${trackingOrderId}`).emit('runner:arrivedAtDelivery', { orderId: trackingOrderId });
      }
    }

    // task_completed side effects (fire and forget)
    if (status === 'task_completed') {
      const userId = chat.participants?.find(p => p.userType === 'user')?.userId;
      if (userId) {
        checkAndSuggestBusiness(userId).catch(() => { });

        // Business expense summary — fully non-blocking
        User.findById(userId).select('accountType lastExpenseSummaryAt').then(async user => {
          if (user?.accountType !== 'business') return;
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          if (user.lastExpenseSummaryAt && user.lastExpenseSummaryAt > oneWeekAgo) return;

          const reports = await getReports(userId, 'monthly');
          const latest = reports?.[0];
          if (!latest) return;

          const summaryMessage = {
            id: `expense-summary-${Date.now()}`,
            from: 'system', type: 'system', messageType: 'system',
            senderType: 'system', senderId: 'system',
            text: `Your business spent ₦${latest.totalSpend.toLocaleString()} this month across ${latest.totalTasks} ${latest.totalTasks === 1 ? 'delivery' : 'deliveries'}. View the full breakdown in Settings → Business → Reports.`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            status: 'sent', style: 'info',
          };

          await Promise.all([
            Chat.findOneAndUpdate({ chatId }, { $push: { messages: summaryMessage } }),
            User.findByIdAndUpdate(userId, { lastExpenseSummaryAt: new Date() }),
          ]);
          io.to(chatId).emit('message', summaryMessage);
        }).catch(e => console.error('Expense summary failed:', e.message));
      }
    }

  } catch (error) {
    console.error('Error updating status:', error);
    logMetric({ type: 'status_update', status: 'failed', chatId: data.chatId, userId: data.updatedBy, userType: data.updatedByType || 'runner', error: error.message });
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
    socket.emit('mediaSent', { success: true, message });
  } catch (error) {
    console.error('Error sending media:', error);
    socket.emit('error', { message: error.message });
  }
};

module.exports = {
  handleUpdateStatus,
  handleSendMedia
};