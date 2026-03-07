import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../utils/api';

// ─── Async thunk

export const fetchRunnerOrders = createAsyncThunk(
  'order/fetchRunnerOrders',
  async ({ runnerId, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/orders/runner/${runnerId}?page=${page}&limit=${limit}`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

export const fetchOrderByChatId = createAsyncThunk(
  'payment/fetchOrderByChatId',
  async (chatId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orders/by-chat/${chatId}`);
      return response.data;
    } catch (_) {
      return rejectWithValue(null);
    }
  }
);

// ─── Slice

const initialState = {
  // Current draft order being built (user side flow)
  currentOrder: null,
  editingField: null,
  isEditing: false,
  originalOrder: null,

  // Runner order history
  runnerOrders: [],
  ordersPage: 1,
  ordersHasMore: true,
  ordersLoading: false,
  ordersError: null,
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    startNewOrder: (state, action) => {
      state.currentOrder = action.payload;
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    updateOrder: (state, action) => {
      state.currentOrder = { ...state.currentOrder, ...action.payload };
    },
    startEditing: (state, action) => {
      state.isEditing = true;
      state.editingField = action.payload.field;
      state.originalOrder = JSON.parse(JSON.stringify(state.currentOrder));
    },
    finishEditing: (state) => {
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    cancelEditing: (state) => {
      if (state.originalOrder) state.currentOrder = state.originalOrder;
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    clearOrder: (state) => {
      state.currentOrder = null;
      state.isEditing = false;
      state.editingField = null;
      state.originalOrder = null;
    },
    resetRunnerOrders: (state) => {
      state.runnerOrders = [];
      state.ordersPage = 1;
      state.ordersHasMore = true;
      state.ordersError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRunnerOrders.pending, (state) => {
        state.ordersLoading = true;
        state.ordersError = null;
      })
      .addCase(fetchRunnerOrders.fulfilled, (state, action) => {
        state.ordersLoading = false;
        const { orders, hasMore, page } = action.payload;

        if (page === 1) {
          // Fresh load or refresh
          state.runnerOrders = orders;
        } else {
          // Append for pagination
          const existingIds = new Set(state.runnerOrders.map(o => o.orderId));
          const newOrders = orders.filter(o => !existingIds.has(o.orderId));
          state.runnerOrders = [...state.runnerOrders, ...newOrders];
        }

        state.ordersPage = page;
        state.ordersHasMore = hasMore;
      })
      .addCase(fetchRunnerOrders.rejected, (state, action) => {
        state.ordersLoading = false;
        state.ordersError = action.payload;
      })

      .addCase(fetchOrderByChatId.pending, (state) => {
        state.ordersLoading = true;
      })
      .addCase(fetchOrderByChatId.fulfilled, (state, action) => {
        state.ordersLoading = false;
        state.currentOrder = action.payload?.data ?? action.payload;
      })
      .addCase(fetchOrderByChatId.rejected, (state) => {
        state.ordersLoading = false;
        // silent — order just doesn't exist yet
      });
  },
});

export const {
  startNewOrder,
  updateOrder,
  startEditing,
  finishEditing,
  cancelEditing,
  clearOrder,
  resetRunnerOrders,
} = orderSlice.actions;

export default orderSlice.reducer;