// utils/api.js
import axios from "axios";
import { setToken } from "../Redux/authSlice";
import { authStorage } from "./authStorage";

const BASE_URL = process.env.REACT_APP_API_URL;

export const isCapacitor = false;
export const isMobileBrowser = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const useTokenAuth = isMobileBrowser;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  withCredentials: true,
});

// ── Auth redirect helper ──────────────────────────────────────────────────────
const redirectToAuth = async () => {
  await authStorage.clearTokens();
  document.cookie = 'token=; Max-Age=0; path=/';
  document.cookie = 'refreshToken=; Max-Age=0; path=/';
  localStorage.removeItem('runner_ui');
  localStorage.removeItem('persist:auth');
  sessionStorage.clear();

  // no reload — just navigate, the app will re-render unauthenticated
  window.location.href = '/';
};

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



// Add these above the interceptors
let isRefreshing = false;
let refreshQueue = []; // pending requests waiting for new token

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
};

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
    if (error.response?.status === 401 && original.url?.includes('refresh-token')) {
      await redirectToAuth();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(token => {
          if (useTokenAuth) {
            original.headers['Authorization'] = `Bearer ${token}`;
          }
          return api(original);
        }).catch(err => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        let newAccess;

        if (useTokenAuth) {
          const { accessToken, refreshToken } = await authStorage.getTokens();
          console.log('[API] useTokenAuth:', useTokenAuth, '| token exists:', !!accessToken, '| url:', original.url);
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post(
            `${BASE_URL}/auth/refresh-token`,
            { refreshToken },
            { withCredentials: true }
          );

          newAccess = data.accessToken || data.token;
          const newRefresh = data.refreshToken || refreshToken;

          await authStorage.setTokens(newAccess, newRefresh);
          store.dispatch(setToken(newAccess));
          original.headers['Authorization'] = `Bearer ${newAccess}`;
        } else {
          await axios.post(
            `${BASE_URL}/auth/refresh-token`,
            {},
            { withCredentials: true }
          );
        }

        processQueue(null, newAccess);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const status = refreshError.response?.status;
        const isAuthFailure = status === 401 || status === 403;

        if (isAuthFailure) {
          await redirectToAuth();
        } else {
          console.warn('[API] Refresh attempt failed transiently, not logging out:', refreshError.message);
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

let store;
export const injectStore = (_store) => { store = _store; };
export { useTokenAuth };
export default api;