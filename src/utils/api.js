// base interceptor
import axios from "axios";

// Create the base axios instance
const api = axios.create({
  baseURL: "http://localhost:4000/api/v1",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  withCredentials: true,
});

// Response interceptor - extracts data from BaseController responses
api.interceptors.response.use(
  (response) => {
    // Extract data from { success: true, message: "...", data: {...} }
    if (response.data && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Store reference for request interceptor
let store;

// Function to inject store once
export const injectStore = (_store) => {
  store = _store;
  
  // Request interceptor - adds auth token
  api.interceptors.request.use(
    (config) => {
      const token = store?.getState()?.auth?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

export default api;