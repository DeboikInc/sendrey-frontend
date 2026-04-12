import axios from "axios";
import { setToken } from "../Redux/authSlice";
import { authStorage } from "./authStorage";

const BASE_URL = process.env.REACT_APP_API_URL;
export const isCapacitor = window.Capacitor?.isNativePlatform?.() ?? false;

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
    if (isCapacitor) {
      // Mobile only — attach token from secure storage
      const { accessToken } = await authStorage.getTokens();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    // Web — HttpOnly cookie is attached automatically by the browser

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
        if (isCapacitor) {
          // Mobile — send refresh token from secure storage in body
          const { refreshToken } = await authStorage.getTokens();
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post(
            `${BASE_URL}/auth/refresh-token`,
            { refreshToken }
          );

          // Save new access token to secure storage
          await authStorage.setTokens(data.token, refreshToken);

          // Update Redux so any components reading token stay in sync
          store.dispatch(setToken(data.token));

          original.headers['Authorization'] = `Bearer ${data.token}`;
        } else {
          // Web — server reads HttpOnly cookie automatically, no body needed
          await axios.post(
            `${BASE_URL}/auth/refresh-token`,
            {},
            { withCredentials: true }
          );
          // New access token is now in the cookie — nothing to do in Redux
        }

        return api(original);
      } catch (refreshError) {
        await authStorage.clearTokens();
        // clear cookies on web so the loop can't restart
        if (!isCapacitor) {
          document.cookie = 'token=; Max-Age=0; path=/';
          document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/auth/refresh-token';
        }
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

let store;
export const injectStore = (_store) => { store = _store; };
export default api;