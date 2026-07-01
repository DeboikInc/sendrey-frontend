const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const authStorage = {
  async setTokens(accessToken, refreshToken) {
    if (isMobileBrowser) {
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    }
    // desktop: tokens live in httpOnly cookies
  },

  async getTokens() {
    if (isMobileBrowser) {
      return {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
      };
    }
    return { accessToken: null, refreshToken: null };
  },

  async clearTokens() {
    if (isMobileBrowser) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },
};