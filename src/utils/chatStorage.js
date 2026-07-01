const chatStorage = {
  async saveActiveChat(chatId, orderId = null) {
    localStorage.setItem('activeChatId', chatId);
    if (orderId) localStorage.setItem('activeOrderId', orderId);
  },
  async getActiveChat() {
    return {
      chatId: localStorage.getItem('activeChatId'),
      orderId: localStorage.getItem('activeOrderId'),
    };
  },
  async clearActiveChat() {
    localStorage.removeItem('activeChatId');
    localStorage.removeItem('activeOrderId');
  },
  async saveRunnerData(runner) {
    localStorage.setItem('activeRunner', JSON.stringify(runner));
  },
  async getRunnerData() {
    const value = localStorage.getItem('activeRunner');
    return value ? JSON.parse(value) : null;
  },
  async clearRunnerData() {
    localStorage.removeItem('activeRunner');
  },
  async saveDraft(chatId, text) {
    localStorage.setItem(`draft_${chatId}`, text);
  },
  async getDraft(chatId) {
    return localStorage.getItem(`draft_${chatId}`) || null;
  },
  async clearDraft(chatId) {
    localStorage.removeItem(`draft_${chatId}`);
  },
  async saveMessages(chatId, messages) {
    try { localStorage.setItem(`chat_messages_${chatId}`, JSON.stringify(messages)); } catch (_) {}
  },
  async getMessages(chatId) {
    const value = localStorage.getItem(`chat_messages_${chatId}`);
    return value ? JSON.parse(value) : null;
  },
  async clearMessages(chatId) {
    localStorage.removeItem(`chat_messages_${chatId}`);
  },
  async saveChatStatus(chatId, status) {
    try { localStorage.setItem(`chat_status_${chatId}`, JSON.stringify({ ...status, savedAt: Date.now() })); } catch (_) {}
  },
  async getChatStatus(chatId) {
    const value = localStorage.getItem(`chat_status_${chatId}`);
    return value ? JSON.parse(value) : null;
  },
  async clearChatStatus(chatId) {
    localStorage.removeItem(`chat_status_${chatId}`);
  },
  async saveLastActiveChat(chatId, orderId = null) {
    localStorage.setItem('lastActiveChat', JSON.stringify({ chatId, orderId, timestamp: Date.now() }));
  },
  async getLastActiveChat() {
    const value = localStorage.getItem('lastActiveChat');
    if (!value) return { chatId: null, orderId: null };
    const data = JSON.parse(value);
    if (Date.now() - data.timestamp > 2 * 60 * 60 * 1000) {
      this.clearLastActiveChat();
      return { chatId: null, orderId: null };
    }
    return data;
  },
  async clearLastActiveChat() {
    localStorage.removeItem('lastActiveChat');
  },
  async saveSession(chatId, sessionData) {
    localStorage.setItem(`session_${chatId}`, JSON.stringify({ ...sessionData, timestamp: Date.now() }));
  },
  async getSession(chatId) {
    const value = localStorage.getItem(`session_${chatId}`);
    if (!value) return null;
    const data = JSON.parse(value);
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      this.clearSession(chatId);
      return null;
    }
    return data;
  },
  async clearSession(chatId) {
    localStorage.removeItem(`session_${chatId}`);
  },
  async savePaidChats(chatIds) {
    try { localStorage.setItem('paid_chat_ids', JSON.stringify([...chatIds])); } catch (_) {}
  },
  async getPaidChats() {
    const value = localStorage.getItem('paid_chat_ids');
    return value ? new Set(JSON.parse(value)) : new Set();
  },
  async saveDeliveryConfirmations(chatId, confirmations) {
    try { localStorage.setItem(`delivery_confirms_${chatId}`, JSON.stringify(confirmations)); } catch (_) {}
  },
  async getDeliveryConfirmations(chatId) {
    const value = localStorage.getItem(`delivery_confirms_${chatId}`);
    return value ? JSON.parse(value) : {};
  },
  async clearDeliveryConfirmations(chatId) {
    localStorage.removeItem(`delivery_confirms_${chatId}`);
  },
};

export default chatStorage;