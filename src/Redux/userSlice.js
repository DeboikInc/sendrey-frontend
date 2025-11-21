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
    console.log('Token in user thunk:', token);
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
      console.log("Authentication failed - redirecting to login");
    }
    return Promise.reject(error);
  }
);

// Get own profile
export const getProfile = createAsyncThunk(
  "users/getProfile",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/profile');
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch profile"
      );
    }
  }
);

// Get public profile by userId
export const getPublicProfile = createAsyncThunk(
  "users/getPublicProfile",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/public-profile/${userId}`);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch public profile"
      );
    }
  }
);

// Get user by userId (requires ownership or admin)
export const getUserById = createAsyncThunk(
  "users/getUserById",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/${userId}`);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch user"
      );
    }
  }
);

// Update profile
export const updateProfile = createAsyncThunk(
  "users/updateProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      const res = await api.put('/profile', profileData);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update profile"
      );
    }
  }
);

// Update user by ID (requires ownership or admin)
export const updateUserById = createAsyncThunk(
  "users/updateUserById",
  async ({ userId, profileData }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/${userId}`, profileData);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update user"
      );
    }
  }
);

// Update notification preferences
export const updateNotificationPreferences = createAsyncThunk(
  "users/updateNotifications",
  async (preferences, { rejectWithValue }) => {
    try {
      const res = await api.put('/notification-preferences', preferences);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update notification preferences"
      );
    }
  }
);

// ===== ADMIN/MANAGER THUNKS =====

// List all users (admin/manager only)
export const listUsers = createAsyncThunk(
  "users/listUsers",
  async (queryParams = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      
      const queryString = params.toString();
      const res = await api.get(`/${queryString ? `?${queryString}` : ''}`);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch users"
      );
    }
  }
);

// Search users
export const searchUsers = createAsyncThunk(
  "users/searchUsers",
  async (queryParams, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      
      const res = await api.get(`/search?${params.toString()}`);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to search users"
      );
    }
  }
);

// Get users by service type
export const getUsersByServiceType = createAsyncThunk(
  "users/getUsersByServiceType",
  async ({ serviceType, fleetType }, { rejectWithValue }) => {
    try {
      let url = `/users/${serviceType}`;
      if (fleetType && fleetType !== 'undefined') {
        url += `?fleetType=${fleetType}`;
      }
      console.log("Fetching URL:", url);
      const res = await api.get(url);
      return res.data;
    } catch (error) {
      console.error('=== FRONTEND ERROR ===');
      console.error('Error response:', error.response?.data);
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch users by service"
      );
    }
  }
);

// Update user role (admin only)
export const updateUserRole = createAsyncThunk(
  "users/updateUserRole",
  async ({ userId, role }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/${userId}/role`, { role });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update user role"
      );
    }
  }
);

// Update user status
export const updateUserStatus = createAsyncThunk(
  "users/updateUserStatus",
  async ({ userId, status }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/${userId}/status`, { status });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update user status"
      );
    }
  }
);

// Delete user (super-admin only)
export const deleteUser = createAsyncThunk(
  "users/deleteUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/${userId}`);
      return { userId, ...res.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete user"
      );
    }
  }
);

// Bulk user action (admin only)
export const bulkUserAction = createAsyncThunk(
  "users/bulkUserAction",
  async (actionData, { rejectWithValue }) => {
    try {
      const res = await api.post('/bulk/action', actionData);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to perform bulk action"
      );
    }
  }
);

// Export users (admin/manager/sales)
export const exportUsers = createAsyncThunk(
  "users/exportUsers",
  async (exportParams, { rejectWithValue }) => {
    try {
      const res = await api.post('/export', exportParams);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to export users"
      );
    }
  }
);

// ===== REDUX SLICE =====

const userSlice = createSlice({
  name: "users",
  initialState: {
    profile: null,
    users: [],
    selectedUser: null,
    searchResults: [],
    totalUsers: 0,
    loading: false,
    error: null,
    exportLoading: false,
  },
  reducers: {
    clearUsers(state) {
      state.users = [];
      state.searchResults = [];
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
    setSelectedUser(state, action) {
      state.selectedUser = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Profile
      .addCase(getProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Public Profile
      .addCase(getPublicProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPublicProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload;
      })
      .addCase(getPublicProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get User By ID
      .addCase(getUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload;
      })
      .addCase(getUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update User By ID
      .addCase(updateUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload;
        // Update in users list if present
        const index = state.users.findIndex(u => u._id === action.payload._id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      })
      .addCase(updateUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Notification Preferences
      .addCase(updateNotificationPreferences.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(updateNotificationPreferences.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // List Users
      .addCase(listUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(listUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data || action.payload;
        state.totalUsers = action.payload.total || action.payload.length;
      })
      .addCase(listUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Search Users
      .addCase(searchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload.data || action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Users By Service Type
      .addCase(getUsersByServiceType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUsersByServiceType.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data || action.payload;
      })
      .addCase(getUsersByServiceType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update User Role
      .addCase(updateUserRole.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserRole.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;
        const index = state.users.findIndex(u => u._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      })
      .addCase(updateUserRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update User Status
      .addCase(updateUserStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedUser = action.payload;
        const index = state.users.findIndex(u => u._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      })
      .addCase(updateUserStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(u => u._id !== action.payload.userId);
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Bulk User Action
      .addCase(bulkUserAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bulkUserAction.fulfilled, (state, action) => {
        state.loading = false;
        // Refresh users list after bulk action
      })
      .addCase(bulkUserAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Export Users
      .addCase(exportUsers.pending, (state) => {
        state.exportLoading = true;
        state.error = null;
      })
      .addCase(exportUsers.fulfilled, (state) => {
        state.exportLoading = false;
      })
      .addCase(exportUsers.rejected, (state, action) => {
        state.exportLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearUsers, clearError, setSelectedUser } = userSlice.actions;
export default userSlice.reducer;