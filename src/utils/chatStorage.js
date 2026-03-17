
// reuse same storage mechanism
const isCapacitor = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

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
};

export default chatStorage;