// utils/authStorage.js
import { Preferences } from '@capacitor/preferences';
import api from './api';

// Fallback to localStorage for web/browser dev
const isCapacitor = window.Capacitor?.isNativePlatform?.();

export const authStorage = {
  async setTokens(accessToken, refreshToken) {
    if (isCapacitor) {
      await Preferences.set({ key: 'accessToken', value: accessToken });
      await Preferences.set({ key: 'refreshToken', value: refreshToken });
    } else {

    }
  },

  async getTokens() {
    if (isCapacitor) {
      const { value: accessToken } = await Preferences.get({ key: 'accessToken' });
      const { value: refreshToken } = await Preferences.get({ key: 'refreshToken' });
      return { accessToken, refreshToken };
    } else {
       return { accessToken: null, refreshToken: null };
    }
  },

  async clearTokens() {
    if (isCapacitor) {
      await Preferences.remove({ key: 'accessToken' });
      await Preferences.remove({ key: 'refreshToken' });
    } else {
      await fetch(`/${api}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    }
  }
};