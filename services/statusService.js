const { STATUS_FLOWS, TASK_TYPES } = require('../config/constants');

class StatusService {
  static getNextValidStatuses(taskType, currentStatus) {
    const flow = STATUS_FLOWS[taskType];
    if (!flow) return [];

    if (!currentStatus) return [flow[0]]; // first status

    const currentIndex = flow.indexOf(currentStatus);
    if (currentIndex === -1) return [];

    return flow.slice(currentIndex + 1, currentIndex + 2); // only next one
  }

  static isValidTransition(taskType, fromStatus, toStatus) {
    const flow = STATUS_FLOWS[taskType];
    if (!flow) return false;

    const fromIndex = flow.indexOf(fromStatus);
    const toIndex = flow.indexOf(toStatus);

    return fromIndex !== -1 && toIndex !== -1 && toIndex === fromIndex + 1;
  }

  static getRequiredStatuses(taskType) {
    return STATUS_FLOWS[taskType] || [];
  }

  static isFinalStatus(taskType, status) {
    const flow = STATUS_FLOWS[taskType];
    return flow && flow[flow.length - 1] === status;
  }
}