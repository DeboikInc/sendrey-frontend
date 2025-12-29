import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Create axios instance
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
    const token = store?.getState()?.auth?.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("Authentication failed - redirecting to login");
    }
    return Promise.reject(error);
  }
);

// --- UTILITY FOR ERRORS ---
const getErrorMessage = (error) => error.response?.data?.message || "Operation failed";

// --- THUNKS ---

export const getProfile = createAsyncThunk("users/getProfile", async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/profile');
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const getPublicProfile = createAsyncThunk("users/getPublicProfile", async (userId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/public-profile/${userId}`);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const getUserById = createAsyncThunk("users/getUserById", async (userId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/${userId}`);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const updateProfile = createAsyncThunk("users/updateProfile", async (profileData, { rejectWithValue }) => {
  try {
    const res = await api.put('/profile', profileData);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const updateUserById = createAsyncThunk("users/updateUserById", async ({ userId, profileData }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/${userId}`, profileData);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const updateNotificationPreferences = createAsyncThunk("users/updateNotifications", async (preferences, { rejectWithValue }) => {
  try {
    const res = await api.put('/notification-preferences', preferences);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const listUsers = createAsyncThunk("users/listUsers", async (queryParams = {}, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => { if (v) params.append(k, v); });
    const res = await api.get(`/${params.toString() ? `?${params.toString()}` : ''}`);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const searchUsers = createAsyncThunk("users/searchUsers", async (queryParams, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => { if (v) params.append(k, v); });
    const res = await api.get(`/search?${params.toString()}`);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const fetchNearbyUserRequests = createAsyncThunk("users/fetchNearby", async (coords, { rejectWithValue }) => {
  try {
    const params = new URLSearchParams(coords);
    const res = await api.get(`/nearby-users?${params.toString()}`);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const updateUserRole = createAsyncThunk("users/updateUserRole", async ({ userId, role }, { rejectWithValue }) => {
  try {
    const res = await api.patch(`/${userId}/role`, { role });
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const updateUserStatus = createAsyncThunk("users/updateUserStatus", async ({ userId, status }, { rejectWithValue }) => {
  try {
    const res = await api.patch(`/${userId}/status`, { status });
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const deleteUser = createAsyncThunk("users/deleteUser", async (userId, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/${userId}`);
    return { userId, ...res.data };
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const bulkUserAction = createAsyncThunk("users/bulkUserAction", async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/bulk/action', data);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const exportUsers = createAsyncThunk("users/exportUsers", async (params, { rejectWithValue }) => {
  try {
    const res = await api.post('/export', params);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

// --- NEW LOCATION ACTIONS ---
export const fetchLocations = createAsyncThunk('locations/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/locations');
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const addLocation = createAsyncThunk('locations/add', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/locations', data);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

export const deleteLocation = createAsyncThunk('locations/delete', async (id, { rejectWithValue }) => {
  try {
    const res = await api.delete(`/locations/${id}`);
    return res.data;
  } catch (error) { return rejectWithValue(getErrorMessage(error)); }
});

// --- SLICE ---

const userSlice = createSlice({
  name: "users",
  initialState: {
    profile: null,
    users: [],
    savedLocations: [],
    selectedUser: null,
    nearbyUsers: [],
    searchResults: [],
    totalUsers: 0,
    loading: false,
    error: null,
    exportLoading: false,
  },
  reducers: {
    clearUsers(state) { state.users = []; state.searchResults = []; state.error = null; },
    clearError(state) { state.error = null; },
    setSelectedUser(state, action) { state.selectedUser = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      // Get Profile
      .addCase(getProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload.data?.user || action.payload.user || action.payload.data;
      })

      // Public Profile / User By ID
      .addCase(getPublicProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload.data?.user || action.payload.user || action.payload.data;
      })
      .addCase(getUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload.data?.user || action.payload.user || action.payload.data;
      })

      // Update Actions
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload.data?.user || action.payload.user || action.payload.data;
      })
      .addCase(updateUserById.fulfilled, (state, action) => {
        state.loading = false;
        const user = action.payload.data?.user || action.payload.user || action.payload.data;
        state.selectedUser = user;
        const idx = state.users.findIndex(u => u._id === user._id);
        if (idx !== -1) state.users[idx] = user;
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload.data?.user || action.payload.user || action.payload.data;
      })

      // Lists & Search
      .addCase(listUsers.fulfilled, (state, action) => {
        state.loading = false;
        const resp = action.payload.data || action.payload;
        state.users = resp.users || resp;
        state.totalUsers = resp.total || resp.length;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loading = false;
        const resp = action.payload.data || action.payload;
        state.searchResults = resp.users || resp;
      })
      .addCase(fetchNearbyUserRequests.fulfilled, (state, action) => {
        state.loading = false;
        const resp = action.payload.data || action.payload;
        state.nearbyUsers = resp.users || [];
      })

      // Admin Actions
      .addCase(updateUserRole.fulfilled, (state, action) => {
        state.loading = false;
        const user = action.payload.data?.user || action.payload.user || action.payload.data;
        const idx = state.users.findIndex(u => u._id === user._id);
        if (idx !== -1) state.users[idx] = user;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        state.loading = false;
        const user = action.payload.data?.user || action.payload.user || action.payload.data;
        const idx = state.users.findIndex(u => u._id === user._id);
        if (idx !== -1) state.users[idx] = user;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(u => u._id !== action.payload.userId);
      })
      .addCase(bulkUserAction.fulfilled, (state) => { state.loading = false; })
      .addCase(exportUsers.fulfilled, (state) => { state.exportLoading = false; })

      // --- LOCATIONS ---
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.loading = false;
        const resp = action.payload.data || action.payload;
        state.savedLocations = resp.locations || resp;
      })
      .addCase(addLocation.fulfilled, (state, action) => {
        state.loading = false;
        const resp = action.payload.data || action.payload;
        state.savedLocations = resp.locations || resp;
      })
      .addCase(deleteLocation.fulfilled, (state, action) => {
        state.loading = false;
        const resp = action.payload.data || action.payload;
        state.savedLocations = resp.locations || resp;
      })

      
      // Unified Loading Handler
      .addMatcher((action) => action.type.endsWith('/pending'), (state, action) => {
        if (action.type.includes('exportUsers')) state.exportLoading = true;
        else state.loading = true;
        state.error = null;
      })
      // Unified Error Handler
      .addMatcher((action) => action.type.endsWith('/rejected'), (state, action) => {
        state.loading = false;
        state.exportLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUsers, clearError, setSelectedUser } = userSlice.actions;
export default userSlice.reducer;