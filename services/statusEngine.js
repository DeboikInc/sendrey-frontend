const StatusUpdate = require('../models/StatusUpdate');
const { Chat } = require('../models/Chat');
const { TASK_TYPES, STATUS_FLOWS } = require('../config/constants');
const { getIO } = require('../socket');

class StatusEngine {
  static isValidMove(taskType, fromStatus, toStatus) {
    const flow = STATUS_FLOWS[taskType];
    if (!flow) return false;

    // Allow first status if no previous status exists
    if (!fromStatus) return flow[0] === toStatus;

    const fromIndex = flow.indexOf(fromStatus);
    const toIndex = flow.indexOf(toStatus);

    return toIndex === fromIndex + 1;
  }

  static async update(taskId, runnerId, newStatus, taskType) {
    // 1. Check if runner is in the task chat
    const chat = await Chat.findOne({ taskId });
    if (!chat) throw new Error('Chat/task not found');

    const isRunnerInChat = chat.participants.some(
      p => p.userId?.toString() === runnerId?.toString() && p.userType === 'runner'
    );

    if (!isRunnerInChat) {
      console.warn(`[StatusEngine] Runner ${runnerId} not in chat for task ${taskId}, skipping`);
      return null;
    }


    const lastUpdate = await StatusUpdate.findOne({ taskId }).sort({ timestamp: -1 });
    const currentStatus = lastUpdate ? lastUpdate.toStatus : null;


    if (!this.isValidMove(taskType, currentStatus, newStatus)) {
      throw new Error(`Invalid move: ${currentStatus} → ${newStatus}`);
    }

    const io = getIO();
    if (io) {
      const systemMessage = {
        from: 'System',
        text: `Status updated: ${currentStatus || 'Started'} → ${newStatus}`,
        type: 'system',
        time: new Date().toISOString(),
        senderId: 'system',
        senderType: 'system'
      };

      io.to(`chat_${taskId}`).emit('newMessage', systemMessage);
    }

    const update = await StatusUpdate.create({
      taskId,
      runnerId,
      fromStatus: currentStatus,
      toStatus: newStatus,
      taskType,
      timestamp: new Date()
    });

    return update.toObject();
  }

  static getNextStatuses(taskType, currentStatus) {
    const flow = STATUS_FLOWS[taskType];
    if (!flow) return [];

    const index = flow.indexOf(currentStatus);
    if (index === -1) return [flow[0]];

    return flow.slice(index + 1, index + 2);
  }
}

module.exports = StatusEngine;