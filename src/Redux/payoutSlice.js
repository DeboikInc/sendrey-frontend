import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";

// Get current payout for active order
export const getCurrentPayout = createAsyncThunk(
  'payout/getCurrent',
  async ({ orderId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/payouts/current?orderId=${orderId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch payout');
    }
  }
);

// Get payout history
export const getPayoutHistory = createAsyncThunk(
  'payout/getHistory',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/payouts/history');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch payout history');
    }
  }
);

// Get runner receipts
export const getRunnerReceipts = createAsyncThunk(
  'payout/getReceipts',
  async ({ orderId } = {}, { rejectWithValue }) => {
    try {
      const url = orderId ? `/payouts/receipts?orderId=${orderId}` : '/payout/receipts';
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch receipts');
    }
  }
);

// Transfer to vendor and submit receipt
export const transferToVendor = createAsyncThunk(
  'payout/transferToVendor',
  async (payoutData, { rejectWithValue }) => {
    try {
      const response = await api.post('/payouts/transfer-to-vendor', payoutData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Transfer failed');
    }
  }
);

// Get banks list (for vendor bank selection)
export const getPayoutBanks = createAsyncThunk(
  'payout/getBanks',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('payments/wallet/banks');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch banks');
    }
  }
);

// Verify vendor account
export const verifyVendorAccount = createAsyncThunk(
  'payout/verifyAccount',
  async ({ accountNumber, bankCode }, { rejectWithValue }) => {
    try {
      const response = await api.post('payments/wallet/verify-account', { accountNumber, bankCode });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Account verification failed');
    }
  }
);

const payoutSlice = createSlice({
  name: 'payout',
  initialState: {
    currentPayout: null,
    payoutHistory: [],
    receipts: [],
    banks: [],
    verifiedAccount: null,
    status: 'idle', // 'idle' | 'loading' | 'success' | 'failed'
    transferStatus: 'idle',
    error: null,
    loading: false,
  },
  reducers: {
    clearPayoutError: (state) => {
      state.error = null;
    },
    clearTransferStatus: (state) => {
      state.transferStatus = 'idle';
      state.error = null;
    },
    clearVerifiedAccount: (state) => {
      state.verifiedAccount = null;
    },
    resetPayoutState: (state) => {
      state.currentPayout = null;
      state.status = 'idle';
      state.transferStatus = 'idle';
      state.error = null;
      state.verifiedAccount = null;
    },
  },
  extraReducers: (builder) => {
    // Get Current Payout
    builder
      .addCase(getCurrentPayout.pending, (state) => {
        state.status = 'loading';
        state.loading = true;
        state.error = null;
      })
      .addCase(getCurrentPayout.fulfilled, (state, action) => {
        state.status = 'success';
        state.currentPayout = action.payload.payout;
        state.loading = false;
      })
      .addCase(getCurrentPayout.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.loading = false;
      });

    // Get Payout History
    builder
      .addCase(getPayoutHistory.pending, (state) => {
        state.status = 'loading';
        state.loading = true;
      })
      .addCase(getPayoutHistory.fulfilled, (state, action) => {
        state.status = 'success';
        state.payoutHistory = action.payload.payouts || [];
        state.loading = false;
      })
      .addCase(getPayoutHistory.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.loading = false;
      });

    // Get Runner Receipts
    builder
      .addCase(getRunnerReceipts.pending, (state) => {
        state.status = 'loading';
        state.loading = true;
      })
      .addCase(getRunnerReceipts.fulfilled, (state, action) => {
        state.status = 'success';
        state.receipts = action.payload.receipts || [];
        state.loading = false;
      })
      .addCase(getRunnerReceipts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
        state.loading = false;
      });

    // Transfer to Vendor
    builder
      .addCase(transferToVendor.pending, (state) => {
        state.transferStatus = 'loading';
        state.loading = true;
        state.error = null;
      })
      .addCase(transferToVendor.fulfilled, (state, action) => {
        state.transferStatus = 'success';
        state.loading = false;
        
        // Update current payout if it matches
        if (state.currentPayout && state.currentPayout.orderId === action.payload.payout?.orderId) {
          state.currentPayout = action.payload.payout;
        }
        
        // Add to receipts list
        if (action.payload.payout) {
          const newReceipt = {
            orderId: action.payload.payout.orderId,
            receiptUrl: action.payload.receiptUrl,
            vendorName: action.payload.payout.vendorName,
            amountSpent: action.payload.payout.amountSpent,
            submittedAt: new Date().toISOString(),
            status: 'pending',
          };
          state.receipts = [newReceipt, ...state.receipts];
        }
      })
      .addCase(transferToVendor.rejected, (state, action) => {
        state.transferStatus = 'failed';
        state.error = action.payload;
        state.loading = false;
      });

    // Get Banks
    builder
      .addCase(getPayoutBanks.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPayoutBanks.fulfilled, (state, action) => {
        state.banks = action.payload.data || [];
        state.loading = false;
      })
      .addCase(getPayoutBanks.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });

    // Verify Vendor Account
    builder
      .addCase(verifyVendorAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.verifiedAccount = null;
      })
      .addCase(verifyVendorAccount.fulfilled, (state, action) => {
        state.verifiedAccount = action.payload.data;
        state.loading = false;
      })
      .addCase(verifyVendorAccount.rejected, (state, action) => {
        state.error = action.payload;
        state.verifiedAccount = null;
        state.loading = false;
      });
  },
});

export const { 
  clearPayoutError, 
  clearTransferStatus, 
  clearVerifiedAccount,
  resetPayoutState 
} = payoutSlice.actions;

export default payoutSlice.reducer;