import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';

export const submitRating = createAsyncThunk(
  'rating/submit',
  async (ratingData, { rejectWithValue }) => {
    try {
      const response = await api.post('/rating/submit', ratingData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to submit rating');
    }
  }
);

export const getRunnerRatings = createAsyncThunk(
  'rating/getRunnerRatings',
  async ({ runnerId, page = 1 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/rating/runner/${runnerId}?page=${page}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get ratings');
    }
  }
);

export const checkCanRate = createAsyncThunk(
  'rating/checkCanRate',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/rating/can-rate/${orderId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to check');
    }
  }
);

const ratingSlice = createSlice({
  name: 'rating',
  initialState: {
    submitted: false,
    canRate: false,
    runnerRatings: [],
    averageRating: 0,
    totalRatings: 0,
    loading: false,
    error: null
  },
  reducers: {
    clearRating: (state) => {
      state.submitted = false;
      state.canRate = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitRating.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitRating.fulfilled, (state) => {
        state.loading = false;
        state.submitted = true;
        state.canRate = false;
      })
      .addCase(submitRating.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getRunnerRatings.fulfilled, (state, action) => {
        state.runnerRatings = action.payload.data?.ratings || [];
        state.averageRating = action.payload.data?.averageRating || 0;
        state.totalRatings = action.payload.data?.totalRatings || 0;
      })
      .addCase(checkCanRate.fulfilled, (state, action) => {
        state.canRate = action.payload.data?.canRate || false;
      });
  }
});

export const { clearRating } = ratingSlice.actions;
export default ratingSlice.reducer;