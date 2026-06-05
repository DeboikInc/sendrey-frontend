
// reuse same storage mechanism
const isCapacitor = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

// chat persistence
const chatStorage = {
    async saveActiveChat(chatId, orderId = null) {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key: 'activeChatId', value: chatId });
            if (orderId) await Preferences.set({ key: 'activeOrderId', value: orderId });
        } else {
            localStorage.setItem('activeChatId', chatId);
            if (orderId) localStorage.setItem('activeOrderId', orderId);
        }
    },

    async getActiveChat() {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value: chatId } = await Preferences.get({ key: 'activeChatId' });
            const { value: orderId } = await Preferences.get({ key: 'activeOrderId' });
            return { chatId, orderId };
        }
        return {
            chatId: localStorage.getItem('activeChatId'),
            orderId: localStorage.getItem('activeOrderId'),
        };
    },

    async clearActiveChat() {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key: 'activeChatId' });
            await Preferences.remove({ key: 'activeOrderId' });
        } else {
            localStorage.removeItem('activeChatId');
            localStorage.removeItem('activeOrderId');
        }
    },


    // runner datas
    async saveRunnerData(runner) {
        const value = JSON.stringify(runner);
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key: 'activeRunner', value });
        } else {
            localStorage.setItem('activeRunner', value);
        }
    },

    async getRunnerData() {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key: 'activeRunner' });
            return value ? JSON.parse(value) : null;
        }
        const value = localStorage.getItem('activeRunner');
        return value ? JSON.parse(value) : null;
    },

    async clearRunnerData() {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key: 'activeRunner' });
        } else {
            localStorage.removeItem('activeRunner');
        }
    },


    // typed but not sent messages
    async saveDraft(chatId, text) {
        const key = `draft_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key, value: text });
        } else {
            localStorage.setItem(key, text);
        }
    },

    async getDraft(chatId) {
        const key = `draft_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key });
            return value || null;
        }
        return localStorage.getItem(key) || null;
    },

    async clearDraft(chatId) {
        const key = `draft_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },


    async saveMessages(chatId, messages) {
        const key = `chat_messages_${chatId}`;
        const value = JSON.stringify(messages);
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key, value });
        } else {
            try { localStorage.setItem(key, value); } catch (_) { }
        }
    },

    async getMessages(chatId) {
        const key = `chat_messages_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key });
            return value ? JSON.parse(value) : null;
        }
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },

    async clearMessages(chatId) {
        const key = `chat_messages_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },

    async saveChatStatus(chatId, status) {
        // status: { cancelled, cancelledByName, taskCompleted, orderCancelled, currentOrder }
        const key = `chat_status_${chatId}`;
        const value = JSON.stringify({ ...status, savedAt: Date.now() });
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key, value });
        } else {
            try { localStorage.setItem(key, value); } catch (_) { }
        }
    },

    async getChatStatus(chatId) {
        const key = `chat_status_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key });
            return value ? JSON.parse(value) : null;
        }
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },


    async clearChatStatus(chatId) {
        const key = `chat_status_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },

    async saveLastActiveChat(chatId, orderId = null) {
        const data = { chatId, orderId, timestamp: Date.now() };
        const value = JSON.stringify(data);
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key: 'lastActiveChat', value });
        } else {
            localStorage.setItem('lastActiveChat', value);
        }
    },

    async getLastActiveChat() {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key: 'lastActiveChat' });
            if (!value) return { chatId: null, orderId: null };
            const data = JSON.parse(value);
            // Expire after 2 hours
            if (Date.now() - data.timestamp > 2 * 60 * 60 * 1000) {
                await this.clearLastActiveChat();
                return { chatId: null, orderId: null };
            }
            return data;
        }
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
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key: 'lastActiveChat' });
        } else {
            localStorage.removeItem('lastActiveChat');
        }
    },

    async saveSession(chatId, sessionData) {
        const key = `session_${chatId}`;
        const value = JSON.stringify({ ...sessionData, timestamp: Date.now() });
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    },

    async getSession(chatId) {
        const key = `session_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key });
            if (!value) return null;
            const data = JSON.parse(value);
            if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                await this.clearSession(chatId);
                return null;
            }
            return data;
        }
        const value = localStorage.getItem(key);
        if (!value) return null;
        const data = JSON.parse(value);
        if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
            this.clearSession(chatId);
            return null;
        }
        return data;
    },

    async clearSession(chatId) {
        const key = `session_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },

    async savePaidChats(chatIds) {
        const value = JSON.stringify([...chatIds]);
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key: 'paid_chat_ids', value });
        } else {
            try { localStorage.setItem('paid_chat_ids', value); } catch (_) { }
        }
    },

    async getPaidChats() {
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key: 'paid_chat_ids' });
            return value ? new Set(JSON.parse(value)) : new Set();
        }
        const value = localStorage.getItem('paid_chat_ids');
        return value ? new Set(JSON.parse(value)) : new Set();
    },

    async saveDeliveryConfirmations(chatId, confirmations) {
        const key = `delivery_confirms_${chatId}`;
        const value = JSON.stringify(confirmations);
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.set({ key, value });
        } else {
            try { localStorage.setItem(key, value); } catch (_) { }
        }
    },

    async getDeliveryConfirmations(chatId) {
        const key = `delivery_confirms_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key });
            return value ? JSON.parse(value) : {};
        }
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : {};
    },

    async clearDeliveryConfirmations(chatId) {
        const key = `delivery_confirms_${chatId}`;
        if (isCapacitor()) {
            const { Preferences } = await import('@capacitor/preferences');
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    },
};

export default chatStorage;