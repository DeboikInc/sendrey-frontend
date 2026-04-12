import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';

export const raiseDispute = createAsyncThunk(
  'dispute/raise',
  async (disputeData, { rejectWithValue }) => {
    try {
      const response = await api.post('/disputes/raise', disputeData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to raise dispute');
    }
  }
);

export const getDispute = createAsyncThunk(
  'dispute/get',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/disputes/order/${orderId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get dispute');
    }
  }
);

export const getRunnerDisputes = createAsyncThunk(
  'dispute/getRunnerDisputes',
  async (runnerId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/disputes/runner/${runnerId}`);
      return response.data?.disputes || response.data || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch disputes');
    }
  }
);

const disputeSlice = createSlice({
  name: 'dispute',
  initialState: {
    currentDispute: null,
    disputes: [],  
    status: 'idle',
    loading: false,
    error: null
  },
  reducers: {
    clearDispute: (state) => {
      state.currentDispute = null;
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(raiseDispute.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(raiseDispute.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDispute = action.payload.data;
        state.status = 'raised';
      })
      .addCase(raiseDispute.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getDispute.pending, (state) => {
        state.loading = true;
      })
      .addCase(getDispute.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDispute = action.payload.data;
      })
      .addCase(getDispute.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getRunnerDisputes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRunnerDisputes.fulfilled, (state, action) => {
        state.loading = false;
        state.disputes = action.payload;
      })
      .addCase(getRunnerDisputes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
  }
});

export const { clearDispute } = disputeSlice.actions;
export default disputeSlice.reducer;