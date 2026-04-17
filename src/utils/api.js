import axios from "axios";
import { setToken } from "../Redux/authSlice";
import { authStorage } from "./authStorage";

const BASE_URL = process.env.REACT_APP_API_URL;
export const isCapacitor = window.Capacitor?.isNativePlatform?.() ?? false;

// Mobile browser = not Capacitor but also can't rely on cross-origin cookies
const isMobileBrowser = !isCapacitor && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const useTokenAuth = isCapacitor || isMobileBrowser; // both need header-based auth

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  withCredentials: true,
});

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    if (useTokenAuth) {
      const { accessToken } = await authStorage.getTokens();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const original = error.config;

    if (original._skipInterceptor) return Promise.reject(error);

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (original.url?.includes('refresh-token')) {
        await authStorage.clearTokens();
        window.location.href = '/';
        return Promise.reject(error);
      }

      try {
        if (useTokenAuth) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
            console.log('[API] useTokenAuth:', useTokenAuth, '| token exists:', !!accessToken, '| url:', original.url);
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post(
            `${BASE_URL}/auth/refresh-token`,
            { refreshToken },
            { withCredentials: true }
          );

          const newAccess = data.accessToken || data.token;
          const newRefresh = data.refreshToken || refreshToken;

          await authStorage.setTokens(newAccess, newRefresh);
          store.dispatch(setToken(newAccess));
          original.headers['Authorization'] = `Bearer ${newAccess}`;
        } else {
          // Web — but also handle mobile browser
          const { data } = await axios.post(
            `${BASE_URL}/auth/refresh-token`,
            {},
            { withCredentials: true }
          );
          // store for mobile browser if tokens came back
          if (data?.data?.accessToken && useTokenAuth) {
            const { accessToken, refreshToken: newRefresh } = data.data;
            await authStorage.setTokens(accessToken, newRefresh);
            original.headers['Authorization'] = `Bearer ${accessToken}`;
          }
        }

        return api(original);
      } catch (refreshError) {
        await authStorage.clearTokens();
        if (!isCapacitor) {
          document.cookie = 'token=; Max-Age=0; path=/';
          document.cookie = 'refreshToken=; Max-Age=0; path=/';
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

let store;
export const injectStore = (_store) => { store = _store; };
export { useTokenAuth };
export default api;