import axios from "axios";
import { setToken, setCredentials } from "../Redux/authSlice";

const BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  withCredentials: true,
});

// Single response interceptor — extract data + handle 401
api.interceptors.response.use(
  // intercept data response and return surface
  (response) => {
    if (response.data && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const state = store?.getState()?.auth;
        const isRunnerEndpoint = original.url?.includes('/runners/') || original.url?.includes('/kyc/');
        const refreshToken = isRunnerEndpoint
          ? state?.runnerRefreshToken
          : state?.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });

        // Store refreshed token in correct slot
        if (isRunnerEndpoint) {
          store.dispatch(setCredentials({ runnerToken: data.token }));
        } else {
          store.dispatch(setToken(data.token));
        }

        original.headers['Authorization'] = `Bearer ${data.token}`;
        return api(original);
      } catch (refreshError) {
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

let store;

export const injectStore = (_store) => {
  store = _store;
};

// Single request interceptor
api.interceptors.request.use(
  (config) => {
    const state = store?.getState()?.auth;

    // Runner endpoints use runner token, everything else uses user token
    const isRunnerEndpoint =
      config.url?.includes('/runners/') ||
      config.url?.includes('/kyc/') ||
      config.url?.includes('/payouts/') ||
      config.url?.includes('/payments/') ||
      config.url?.includes('/pin/') ||
      config.url?.includes('/orders/') ||
      config.url?.includes('/users/nearby-users'); // runner calls this too

    const token = isRunnerEndpoint && state?.runnerToken
      ? state.runnerToken
      : state?.token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;