const StatusUpdate = require('../models/StatusUpdate');
const Chat = require('./Chat');
const { TASK_TYPES, STATUS_FLOWS } = require('../config/constants');


// order of statuses for shopping vs pickup tasks, avoid skipping steps, add system messages to chat, only assigned runner can update status
class StatusEngine {
  static isValidMove(taskType, fromStatus, toStatus) {
    const flow = STATUS_FLOWS[taskType];
    if (!flow) return false;

    const fromIndex = flow.indexOf(fromStatus);
    const toIndex = flow.indexOf(toStatus);

    return toIndex === fromIndex + 1;
  }

  static async update(taskId, runnerId, newStatus, taskType) {
    const lastUpdate = await StatusUpdate.findOne({ taskId }).sort({ timestamp: -1 });
    const currentStatus = lastUpdate ? lastUpdate.toStatus : null;

    if (!this.isValidMove(taskType, currentStatus, newStatus)) {
      throw new Error(`Invalid move: ${currentStatus} → ${newStatus}`);
    }

    const update = new StatusUpdate({
      taskId,
      runnerId,
      fromStatus: currentStatus,
      toStatus: newStatus,
      taskType
    });
    await update.save();

    // Add system message to chat
    const chat = await Chat.findOne({ taskId });
    if (chat) {
      chat.messages.push({
        from: 'System',
        text: `Status updated: ${currentStatus || 'Started'} → ${newStatus}`,
        type: 'system',
        time: new Date().toISOString(),
        senderId: 'system',
        senderType: 'system'
      });
      await chat.save();
    }

    return update;
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