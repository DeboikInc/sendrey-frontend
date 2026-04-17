// utils/authStorage.js
import { Preferences } from '@capacitor/preferences';

// Fallback to localStorage for web/browser dev
const isCapacitor = window.Capacitor?.isNativePlatform?.();
const isMobileBrowser = !isCapacitor && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const authStorage = {
  async setTokens(accessToken, refreshToken) {
    if (isCapacitor) {
      await Preferences.set({ key: 'accessToken', value: accessToken });
      await Preferences.set({ key: 'refreshToken', value: refreshToken });
    } else if (isMobileBrowser) {
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
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
        refreshToken: localStorage.getItem('refreshToken')
      };
    }
  },

  async clearTokens() {
    if (isCapacitor) {
      await Preferences.remove({ key: 'accessToken' });
      await Preferences.remove({ key: 'refreshToken' });
    } else if (isMobileBrowser) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }
};