// utils/chatStateManager.js

class ChatStateManager {
  constructor() {
    this._states = new Map();
  }

  get(chatId) {
    if (!this._states.has(chatId)) {
      this._states.set(chatId, {
        messages: [],
        draft: '',
        replyingTo: null,
        completedOrderStatuses: [],
        taskCompleted: false,
        orderCancelled: false,
        cancellationReason: null,
        currentOrder: null,
        specialInstructions: null,
        deliveryMarked: false,
        userConfirmedDelivery: false,
        newOrderComplete: false,
        newOrderStep: null,
      });
    }
    const state = this._states.get(chatId);
    if (!Array.isArray(state.completedOrderStatuses)) {
      state.completedOrderStatuses = [];
    }
    return state;
  }

  set(chatId, updates) {
    const current = this.get(chatId);
    this._states.set(chatId, { ...current, ...updates });
  }

  update(chatId, updaterOrObject) {
    if (typeof updaterOrObject === 'function') {
      const current = this.get(chatId);
      const next = updaterOrObject(current);
      this._states.set(chatId, { ...current, ...next });
    } else {
      this.set(chatId, updaterOrObject);
    }
  }

  updateMessages(chatId, updater) {
    const current = this.get(chatId);
    const nextMessages = typeof updater === 'function'
      ? updater(current.messages)
      : updater;
    this._states.set(chatId, { ...current, messages: nextMessages });
    return nextMessages;
  }

  delete(chatId) {
    this._states.delete(chatId);
  }
}

// Module-level singleton — survives HMR the same way Zustand does.
// Import `chatManager` directly; never instantiate ChatStateManager again in components.
const chatManager = new ChatStateManager();

if (typeof window !== 'undefined') {
  window.__chatManager = chatManager;
}

export default chatManager;