import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";

// ── Set PIN (onboarding) ──────────────────────────────────────────────────────
export const setPin = createAsyncThunk(
  'pin/set',
  async ({ pin }, { rejectWithValue }) => {
    try {
      const response = await api.post('/pin/set-pin', { pin });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to set PIN');
    }
  }
);

// ── Verify PIN (payment gate) ─────────────────────────────────────────────────
export const verifyPin = createAsyncThunk(
  'pin/verify',
  async ({ pin }, { rejectWithValue }) => {
    try {
      const response = await api.post('/pin/verify-pin', { pin });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'PIN verification failed');
    }
  }
);

// ── Reset PIN (knows current PIN) ─────────────────────────────────────────────
export const resetPin = createAsyncThunk(
  'pin/reset',
  async ({ currentPin, newPin }, { rejectWithValue }) => {
    try {
      const response = await api.put('/pin/reset-pin', { currentPin, newPin });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset PIN');
    }
  }
);

// ── Forgot PIN (post-OTP identity verified) ───────────────────────────────────
export const forgotPin = createAsyncThunk(
  'pin/forgot',
  async ({ newPin, confirmPin }, { rejectWithValue }) => {
    try {
      const response = await api.put('/pin/forgot-pin', { newPin, confirmPin });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset PIN');
    }
  }
);

const pinSlice = createSlice({
  name: 'pin',
  initialState: {
    isVerified: false,      
    isPinSet: false,         // flip to true after setPin succeeds
    status: 'idle',          // 'idle' | 'loading' | 'success' | 'failed'
    verifyStatus: 'idle',   
    error: null,
  },
  reducers: {
    clearPinError: (state) => {
      state.error = null;
    },
    clearVerifyStatus: (state) => {
      state.isVerified = false;
      state.verifyStatus = 'idle';
      state.error = null;
    },
    resetPinState: (state) => {
      state.isVerified = false;
      state.status = 'idle';
      state.verifyStatus = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ── setPin
    builder
      .addCase(setPin.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(setPin.fulfilled, (state) => {
        state.status = 'success';
        state.isPinSet = true;
      })
      .addCase(setPin.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });

    // ── verifyPin 
    builder
      .addCase(verifyPin.pending, (state) => {
        state.verifyStatus = 'loading';
        state.isVerified = false;
        state.error = null;
      })
      .addCase(verifyPin.fulfilled, (state) => {
        state.verifyStatus = 'success';
        state.isVerified = true;
      })
      .addCase(verifyPin.rejected, (state, action) => {
        state.verifyStatus = 'failed';
        state.isVerified = false;
        state.error = action.payload;
      });

    // ── resetPin 
    builder
      .addCase(resetPin.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(resetPin.fulfilled, (state) => {
        state.status = 'success';
      })
      .addCase(resetPin.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });

    // ── forgotPin 
    builder
      .addCase(forgotPin.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(forgotPin.fulfilled, (state) => {
        state.status = 'success';
      })
      .addCase(forgotPin.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearPinError, clearVerifyStatus, resetPinState } = pinSlice.actions;
export default pinSlice.reducer;