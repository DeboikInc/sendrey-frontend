import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Create axios instance
const api = axios.create({
  baseURL: "http://localhost:4000/api/v1/runners",
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

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = store?.getState()?.auth?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Runner API Request:', config.url, 'Token:', token ? 'Present' : 'Missing');
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("Authentication failed - redirecting to login");
      // Optionally dispatch logout action
    }
    return Promise.reject(error);
  }
);

// ===== ASYNC THUNKS =====

// Get all runners
export const fetchAllRunners = createAsyncThunk(
  "runners/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get runners by service type
export const fetchRunnersByService = createAsyncThunk(
  "runners/fetchByService",
  async (serviceType, { rejectWithValue }) => {
    try {
      const response = await api.get(`/service/${serviceType}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get nearby runners
export const fetchNearbyRunners = createAsyncThunk(
  "runners/fetchNearby",
  async ({ latitude, longitude, serviceType, fleetType, firstName, lastName }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });
      
      if (serviceType) params.append("serviceType", serviceType);
      if (fleetType) params.append("fleetType", fleetType);

      const response = await api.get(`/nearby-runners?${params.toString()}`);
      console.log('Fetched Nearby Runners:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching nearby runners:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get online runners
export const fetchOnlineRunners = createAsyncThunk(
  "runners/fetchOnline",
  async ({ serviceType, fleetType } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (serviceType) params.append("serviceType", serviceType);
      if (fleetType) params.append("fleetType", fleetType);

      const queryString = params.toString();
      const response = await api.get(`/online${queryString ? `?${queryString}` : ""}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update runner location
export const updateRunnerLocation = createAsyncThunk(
  "runners/updateLocation",
  async ({ userId, latitude, longitude }, { rejectWithValue }) => {
    try {
      const response = await api.post("/update-location", {
        userId,
        latitude,
        longitude,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Set runner online status
export const setRunnerOnlineStatus = createAsyncThunk(
  "runners/setOnlineStatus",
  async ({ userId, isOnline, isAvailable }, { rejectWithValue }) => {
    try {
      const response = await api.post("/set-online-status", {
        userId,
        isOnline,
        isAvailable,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// ===== REDUX SLICE =====

const runnerSlice = createSlice({
  name: "runners",
  initialState: {
    runners: [],
    nearbyRunners: [],
    onlineRunners: [],
    selectedRunner: null,
    count: 0,
    loading: false,
    error: null,
  },
  reducers: {
    clearRunners: (state) => {
      state.runners = [];
      state.nearbyRunners = [];
      state.onlineRunners = [];
      state.count = 0;
      state.error = null;
    },
    setSelectedRunner: (state, action) => {
      state.selectedRunner = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all runners
      .addCase(fetchAllRunners.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllRunners.fulfilled, (state, action) => {
        state.loading = false;
        state.runners = action.payload.runners;
        state.count = action.payload.count;
      })
      .addCase(fetchAllRunners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch by service type
      .addCase(fetchRunnersByService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRunnersByService.fulfilled, (state, action) => {
        state.loading = false;
        state.runners = action.payload.runners;
        state.count = action.payload.count;
      })
      .addCase(fetchRunnersByService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch nearby runners
      .addCase(fetchNearbyRunners.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNearbyRunners.fulfilled, (state, action) => {
        state.loading = false;
        state.nearbyRunners = action.payload.runners;
        state.count = action.payload.count;
      })
      .addCase(fetchNearbyRunners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch online runners
      .addCase(fetchOnlineRunners.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOnlineRunners.fulfilled, (state, action) => {
        state.loading = false;
        state.onlineRunners = action.payload.runners;
        state.count = action.payload.count;
      })
      .addCase(fetchOnlineRunners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update location
      .addCase(updateRunnerLocation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateRunnerLocation.fulfilled, (state, action) => {
        state.loading = false;
        // Update runner in the list if exists
        const updatedRunner = action.payload.runner;
        state.runners = state.runners.map((r) =>
          r._id === updatedRunner._id ? { ...r, ...updatedRunner } : r
        );
      })
      .addCase(updateRunnerLocation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Set online status
      .addCase(setRunnerOnlineStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(setRunnerOnlineStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedRunner = action.payload.runner;
        state.runners = state.runners.map((r) =>
          r._id === updatedRunner._id ? { ...r, ...updatedRunner } : r
        );
      })
      .addCase(setRunnerOnlineStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearRunners, setSelectedRunner, clearError } = runnerSlice.actions;
export default runnerSlice.reducer;