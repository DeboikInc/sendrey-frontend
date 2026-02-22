import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";

// Create payment intent (wallet or card)
export const createPaymentIntent = createAsyncThunk(
  'payment/createIntent',
  async ({ orderId, paymentMethod }, { rejectWithValue }) => {
    try {
      const response = await api.post('/payments/intent', {
        orderId,
        paymentMethod
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Payment failed');
    }
  }
);

// Verify Paystack payment
export const verifyPayment = createAsyncThunk(
  'payment/verifyPayment',
  async ({ reference }, { rejectWithValue }) => {
    try {
      const response = await api.post('/payments/verify', { reference });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Payment verification failed');
    }
  }
);

// Fund wallet
export const fundWallet = createAsyncThunk(
  'payment/fundWallet',
  async ({ amount }, { rejectWithValue }) => {
    try {
      const response = await api.post('payments/wallet/fund', { amount });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fund wallet');
    }
  }
);

// Get wallet balance
export const getWalletBalance = createAsyncThunk(
  'payment/getBalance',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('payments/wallet/balance');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get balance');
    }
  }
);

// Create escrow
export const createEscrow = createAsyncThunk(
  'payment/createEscrow',
  async (escrowData, { rejectWithValue }) => {
    try {
      const response = await api.post('payments/escrow/create', escrowData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create escrow');
    }
  }
);

// Release escrow
export const releaseEscrow = createAsyncThunk(
  'payment/releaseEscrow',
  async ({ escrowId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`payments/escrow/${escrowId}/release`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to release escrow');
    }
  }
);

export const createVirtualAccount = createAsyncThunk(
  'payment/createVirtualAccount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('payments/wallet/virtual-account');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create virtual account');
    }
  }
);

export const getTransactionHistory = createAsyncThunk(
  'payment/getTransactionHistory',
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      // paginate
      const response = await api.get(`payments/wallet/transactions?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch transactions');
    }
  }
);

export const withdrawFromWallet = createAsyncThunk(
  'payment/withdraw',
  async ({ amount, bankDetails }, { rejectWithValue }) => {
    try {
      const response = await api.post('payments/wallet/withdraw', { amount, bankDetails });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Withdrawal failed');
    }
  }
);

export const getBanks = createAsyncThunk(
  'payment/getBanks',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('payments/wallet/banks');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch banks');
    }
  }
);

export const verifyAccount = createAsyncThunk(
  'payment/verifyAccount',
  async ({ accountNumber, bankCode }, { rejectWithValue }) => {
    try {
      const response = await api.post('payments/wallet/verify-account', { accountNumber, bankCode });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to verify account');
    }
  }
);


const paymentSlice = createSlice({
  name: 'payment',
  initialState: {
    wallet: {
      balance: 0,
      status: 'idle',
      virtualAccount: null,
      transactions: [],
      pagination: null,
    },
    banks: [],
    payment: {
      status: 'idle',
      reference: null,
      authorizationUrl: null,
      error: null,
    },
    escrow: {
      status: 'idle',
      currentEscrow: null,
      error: null,
    },
    loading: false,
    error: null,
  },
  reducers: {
    clearPaymentState: (state) => {
      state.payment.status = 'idle';
      state.payment.reference = null;
      state.payment.authorizationUrl = null;
      state.payment.error = null;
    },
    clearError: (state) => {
      state.error = null;
      state.payment.error = null;
      state.escrow.error = null;
    },
  },
  extraReducers: (builder) => {
    // Create Payment Intent
    builder
      .addCase(createPaymentIntent.pending, (state) => {
        state.payment.status = 'loading';
        state.loading = true;
        state.error = null;
      })
      .addCase(createPaymentIntent.fulfilled, (state, action) => {
        state.payment.status = 'success';
        // Handle both Paystack (reference) and wallet (escrowId)
        state.payment.reference = action.payload.data?.reference || null;
        state.payment.authorizationUrl = action.payload.data?.authorizationUrl || null;
        state.loading = false;
      })
      .addCase(createPaymentIntent.rejected, (state, action) => {
        state.payment.status = 'failed';
        state.payment.error = action.payload;
        state.error = action.payload;
        state.loading = false;
      });

    // Verify Payment
    builder
      .addCase(verifyPayment.pending, (state) => {
        state.payment.status = 'loading';
        state.loading = true;
      })
      .addCase(verifyPayment.fulfilled, (state, action) => {
        state.payment.status = 'success';
        state.loading = false;
      })
      .addCase(verifyPayment.rejected, (state, action) => {
        state.payment.status = 'failed';
        state.payment.error = action.payload;
        state.error = action.payload;
        state.loading = false;
      });

    // Fund Wallet
    builder
      .addCase(fundWallet.pending, (state) => {
        state.wallet.status = 'loading';
        state.loading = true;
      })
      .addCase(fundWallet.fulfilled, (state, action) => {
        state.wallet.status = 'success';
        state.wallet.balance = action.payload.data?.balance || state.wallet.balance;
        state.loading = false;
      })
      .addCase(fundWallet.rejected, (state, action) => {
        state.wallet.status = 'failed';
        state.error = action.payload;
        state.loading = false;
      });

    // Get Wallet Balance
    builder
      .addCase(getWalletBalance.pending, (state) => {
        state.wallet.status = 'loading';
      })
      .addCase(getWalletBalance.fulfilled, (state, action) => {
        state.wallet.status = 'success';
        state.wallet.balance = action.payload.data?.balance || 0;
      })
      .addCase(getWalletBalance.rejected, (state, action) => {
        state.wallet.status = 'failed';
        state.error = action.payload;
      });

    // Create Escrow
    builder
      .addCase(createEscrow.pending, (state) => {
        state.escrow.status = 'loading';
        state.loading = true;
      })
      .addCase(createEscrow.fulfilled, (state, action) => {
        state.escrow.status = 'success';
        state.escrow.currentEscrow = action.payload.data;
        state.loading = false;
      })
      .addCase(createEscrow.rejected, (state, action) => {
        state.escrow.status = 'failed';
        state.escrow.error = action.payload;
        state.error = action.payload;
        state.loading = false;
      });

    // Release Escrow
    builder
      .addCase(releaseEscrow.pending, (state) => {
        state.escrow.status = 'loading';
        state.loading = true;
      })
      .addCase(releaseEscrow.fulfilled, (state, action) => {
        state.escrow.status = 'success';
        state.escrow.currentEscrow = null;
        state.loading = false;
      })
      .addCase(releaseEscrow.rejected, (state, action) => {
        state.escrow.status = 'failed';
        state.escrow.error = action.payload;
        state.error = action.payload;
        state.loading = false;
      });

    // Create Virtual Account
    builder
      .addCase(createVirtualAccount.pending, (state) => {
        state.loading = true;
      })
      .addCase(createVirtualAccount.fulfilled, (state, action) => {
        state.wallet.virtualAccount = action.payload.data;
        state.loading = false;
      })
      .addCase(createVirtualAccount.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });

    // Get Transaction History
    builder
      .addCase(getTransactionHistory.pending, (state) => {
        state.wallet.status = 'loading';
      })
      .addCase(getTransactionHistory.fulfilled, (state, action) => {
        state.wallet.status = 'success';
        state.wallet.transactions = action.payload.data?.transactions || [];
        state.wallet.pagination = action.payload.data?.pagination || null;
      })
      .addCase(getTransactionHistory.rejected, (state, action) => {
        state.wallet.status = 'failed';
        state.error = action.payload;
      });

    // Withdraw
    builder
      .addCase(withdrawFromWallet.pending, (state) => {
        state.loading = true;
      })
      .addCase(withdrawFromWallet.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(withdrawFromWallet.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });

    // Get Banks
    builder
      .addCase(getBanks.pending, (state) => {
        state.loading = true;
      })
      .addCase(getBanks.fulfilled, (state, action) => {
        state.banks = action.payload.data || [];
        state.loading = false;
      })
      .addCase(getBanks.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });

    // Verify Account
    builder
      .addCase(verifyAccount.pending, (state) => {
        state.loading = true;
      })
      .addCase(verifyAccount.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(verifyAccount.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  },
});

export const { clearPaymentState, clearError } = paymentSlice.actions;
export default paymentSlice.reducer;