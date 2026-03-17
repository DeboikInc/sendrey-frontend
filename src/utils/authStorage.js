// utils/authStorage.js
import { Preferences } from '@capacitor/preferences';

// Fallback to localStorage for web/browser dev
const isCapacitor = window.Capacitor?.isNativePlatform?.();

export const authStorage = {
  async setTokens(accessToken, refreshToken) {
    if (isCapacitor) {
      await Preferences.set({ key: 'accessToken', value: accessToken });
      await Preferences.set({ key: 'refreshToken', value: refreshToken });
    } else {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  },

  async getTokens() {
    if (isCapacitor) {
      const { value: accessToken } = await Preferences.get({ key: 'accessToken' });
      const { value: refreshToken } = await Preferences.get({ key: 'refreshToken' });
      return { accessToken, refreshToken };
    } else {
      return {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
      };
    }
  },

  async clearTokens() {
    if (isCapacitor) {
      await Preferences.remove({ key: 'accessToken' });
      await Preferences.remove({ key: 'refreshToken' });
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }
};