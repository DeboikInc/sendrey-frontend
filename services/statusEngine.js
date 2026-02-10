const StatusUpdate = require('../models/StatusUpdate');
const Chat = require('../models/Chat');
const { TASK_TYPES, STATUS_FLOWS } = require('../config/constants');
const { getIO } = require('../socket');

class StatusEngine {
  static isValidMove(taskType, fromStatus, toStatus) {
    const flow = STATUS_FLOWS[taskType];
    if (!flow) return false;

    const fromIndex = flow.indexOf(fromStatus);
    const toIndex = flow.indexOf(toStatus);

    return toIndex === fromIndex + 1;
  }

  static async update(taskId, runnerId, newStatus, taskType) {
    // 1. Check if runner is in the task chat
    const chat = await Chat.findOne({ taskId });
    if (!chat) throw new Error('Chat/task not found');

    const isRunnerInChat = chat.participants.some(
      p => p.userId === runnerId && p.userType === 'runner'
    );
    if (!isRunnerInChat) throw new Error('Runner not assigned to this task');


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