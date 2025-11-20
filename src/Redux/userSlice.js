import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Create axios instance WITHOUT token initially
const api = axios.create({
  baseURL: "http://localhost:4000/api/v1/users",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  withCredentials: true,
});

// Store reference for interceptors
let store;

export const injectStore = (_store) => {
  store = _store;
};

api.interceptors.request.use(
  (config) => {
    // Get token from Redux store if available
    const token = store?.getState()?.auth?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Token in thunk:', token);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      console.log("Authentication failed - redirecting to login");
      // You can dispatch logout action here if needed
    }
    return Promise.reject(error);
  }
);

// Fetch all runners (with optional fleet filter)
export const fetchRunners = createAsyncThunk(
  "users/fetchRunners",
  async (fleetType = null, { rejectWithValue }) => {
    try {
      const url = fleetType ? `/runners?fleetType=${fleetType}` : '/runners';
      const res = await api.get(url);
      return res.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch runners"
      );
    }
  }
);

// Fetch runners by service type
export const fetchRunnersByService = createAsyncThunk(
  "users/fetchRunnersByService",
  async ({ serviceType, fleetType }, { rejectWithValue }) => {
    try {
       let url = `/runners?service=${serviceType}`;
      if (fleetType && fleetType !== 'undefined') {
        url += `&fleetType=${fleetType}`;
      }
      const res = await api.get(url);

      return res.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch runners by service"
      );
    }
  }
);

export const fetchUsersByService = createAsyncThunk(
  "users/fetchUsersByService",
  async ({ serviceType, fleetType, location }, { rejectWithValue }) => {
    try {
      let url = `users/${serviceType}`;
      if (fleetType && fleetType !== 'undefined') {
        url += `?fleetType=${fleetType}`;
      }
      console.log("Fetching URL:", url);
      console.log("fetching service,", serviceType)
      const res = await api.get(url);
      return res.data.data;
    } catch (error) {
      console.error('=== FRONTEND ERROR ===');
      console.error('Error response:', error.response);
      console.error('Error message:', error.response?.data?.message);
      console.error('Error details:', error.response?.data)
      return rejectWithValue(
        
        error.response?.data?.message || "Failed to fetch users by service"
      );
    }
  }
);

const userSlice = createSlice({
  name: "users",
  initialState: {
    runners: [],
    users: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearRunners(state) {
      state.runners = [];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all runners
      .addCase(fetchRunners.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRunners.fulfilled, (state, action) => {
        state.loading = false;
        state.runners = action.payload;
      })
      .addCase(fetchRunners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch runners by service
      .addCase(fetchRunnersByService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRunnersByService.fulfilled, (state, action) => {
        state.loading = false;
        state.runners = action.payload;
      })
      .addCase(fetchRunnersByService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchUsersByService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsersByService.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsersByService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearRunners } = userSlice.actions;
export default userSlice.reducer;