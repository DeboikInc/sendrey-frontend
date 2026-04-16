import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";
import { isCapacitor, useTokenAuth } from "../utils/api";
import useOrderStore from '../store/orderStore';
import { authStorage } from "../utils/authStorage";

// helper — call after any successful auth response
const storeTokensIfNeeded = async (payload) => {
    if (useTokenAuth && payload?.accessToken) {
        await authStorage.setTokens(payload.accessToken, payload.refreshToken);
    }
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const register = createAsyncThunk("auth/register", async (data, thunkAPI) => {
    const { role, email, fullName, firstName, lastName, phone, password, fleetType, serviceType, latitude, longitude } = data;
    try {
        const endpoint = role === "runner" ? "/auth/register-runner" : "/auth/register-user";
        const payload = {
            phone, password, email, fleetType, role, serviceType, latitude, longitude,
            ...(role === 'runner' && { isOnline: true, isAvailable: true }),
            ...(fullName && { fullName }),
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
        };
        const response = await api.post(endpoint, payload);
        return response.data;
    } catch (error) {
        if (error.response?.data?.errors) {
            return thunkAPI.rejectWithValue(error.response.data.errors[0].message);
        }
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Something went wrong");
    }
});

export const login = createAsyncThunk("auth/login", async ({ email, password }, thunkAPI) => {
    try {
        const response = await api.post("/auth/login", { email, password });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Login failed");
    }
});

export const logout = createAsyncThunk("auth/logout", async (_, thunkAPI) => {
    try {
        const response = await api.post("/auth/logout");
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Logout failed");
    }
});

export const verifyEmail = createAsyncThunk("auth/verify-email", async ({ token }, thunkAPI) => {
    try {
        const response = await api.post("/auth/verify-email", { token });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "verification failed");
    }
});

export const verifyEmailOTP = createAsyncThunk("auth/verify-email-otp", async ({ otp, userType = 'user' }, thunkAPI) => {
    try {
        const response = await api.post("/auth/verify-email-otp", { otp, userType });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "email OTP verification failed");
    }
});

export const verifyEmailToken = createAsyncThunk('auth/verifyEmailToken', async (token, thunkAPI) => {
    try {
        const response = await api.post('/auth/verify-email-token', { token });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message);
    }
});

export const sendEmailVerification = createAsyncThunk("auth/send-email-verification", async ({ email }, thunkAPI) => {
    try {
        const response = await api.post("/auth/request-email-verification", { email });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "failed to send verification email");
    }
});

export const resendEmailVerification = createAsyncThunk("auth/resend-email-verification-auth", async ({ email }, thunkAPI) => {
    try {
        const response = await api.post("/auth/resend-email-verification", { email });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "failed to resend verification");
    }
});

export const requestEmailVerification = createAsyncThunk("auth/request-email-verification", async ({ email }, thunkAPI) => {
    try {
        const response = await api.post("/auth/request-email-verification", { email });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "failed to request email verification");
    }
});

export const forgotPassword = createAsyncThunk("auth/forgot-password", async ({ phone, email }, thunkAPI) => {
    try {
        if (!email && !phone) return thunkAPI.rejectWithValue("Either email or phone number is required");
        const response = await api.post("/auth/forgot-password", { email: email || undefined, phone: phone || undefined });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "something went wrong, try again later");
    }
});

export const resetPassword = createAsyncThunk("auth/reset-password", async ({ token, newPassword }, thunkAPI) => {
    try {
        const response = await api.post("/auth/reset-password", { token, newPassword });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "something went wrong, try again later");
    }
});

export const changePassword = createAsyncThunk("auth/change-password", async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
        const response = await api.post("/auth/change-password", { currentPassword, newPassword });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "something went wrong, try again later");
    }
});

export const phoneVerificationRequest = createAsyncThunk("auth/phone-verification-request", async ({ phone }, thunkAPI) => {
    try {
        const response = await api.post("/auth/request-phone-verification", { phone });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "something went wrong, try again later");
    }
});

export const verifyPhone = createAsyncThunk("auth/verify-phone", async ({ phone, otp }, thunkAPI) => {
    try {
        const response = await api.post("/auth/verify-phone", { phone, otp });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "OTP verification failed");
    }
});

export const resendPhoneVerification = createAsyncThunk("auth/resend-phone-verification", async ({ phone }, thunkAPI) => {
    try {
        const response = await api.post("/auth/resend-phone-verification", { phone });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "failed to resend phone verification");
    }
});

export const sendReturningUserEmailOTP = createAsyncThunk("auth/send-returning-user-email-otp", async ({ email, userType = 'runner' }, thunkAPI) => {
    try {
        const response = await api.post("/auth/send-returning-user-otp", { email, userType });
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Failed to send OTP");
    }
});

export const fetchRunnerMe = createAsyncThunk('auth/fetchRunnerMe', async (_, { rejectWithValue }) => {
    try {
        const res = await api.get('/auth/runner/me', { _skipInterceptor: true });
        return res.data;
    } catch (err) {
        // pass the full response so we can check status in the reducer
        return rejectWithValue(err.response?.data ?? { status: err.response?.status });
    }
});

export const fetchUserMe = createAsyncThunk('auth/fetchUserMe', async (_, { rejectWithValue }) => {
    try {
        const res = await api.get('/auth/user/me', { _skipInterceptor: true });
        return res.data;
    } catch (err) {
        return rejectWithValue(err.response?.data ?? { status: err.response?.status });
    }
});

const wipeRunnerLocalStorage = (runnerId) => {
    localStorage.removeItem('runner_ui');
    localStorage.removeItem('sendrey-order-store');

    if (!runnerId) {
        try {
            const persisted = JSON.parse(localStorage.getItem('persist:auth') || '{}');
            const runner = JSON.parse(persisted.runner || 'null');
            runnerId = runner?._id;
        } catch (_) { }
    }

    if (runnerId) {
        localStorage.removeItem(`kyc_flow_started_${runnerId}`);
        localStorage.removeItem(`terms_accepted_${runnerId}`);
        localStorage.removeItem(`kyc_nudge_${runnerId}`);
        localStorage.removeItem(`currentOrder_${runnerId}`);
    }
};


// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
    name: "auth",
    initialState: {
        status: "idle",
        error: null,
        user: null,
        runner: null,
        isAuthenticated: false,
    },
    reducers: {
        updateUser(state, action) {
            if (state.user) state.user = { ...state.user, ...action.payload };
        },
        setToken(state, action) {
            // kept for mobile Capacitor token injection
            if (isCapacitor) state.token = action.payload;
        },
        setCredentials(state, action) {
            if (action.payload.user) state.user = action.payload.user;
            if (action.payload.runner) state.runner = action.payload.runner;
            state.isAuthenticated = true;
        },
        clearCredentials(state) {
            const runnerId = state.runner?._id;
            state.user = null;
            state.runner = null;
            state.isAuthenticated = false;
            state.error = null;
            wipeRunnerLocalStorage(runnerId);
            useOrderStore.getState()._reset();
        },
        clearRunnerSession(state) {
            const runnerId = state.runner?._id;
            state.runner = null;
            state.error = null;
            state.status = 'idle';
            state.isAuthenticated = false;
            wipeRunnerLocalStorage(runnerId);
            useOrderStore.getState()._reset();
        },
        clearUserSession(state) {
            state.user = null;
            state.error = null;
            state.status = 'idle';
            state.isAuthenticated = false;
        },
    },
    extraReducers: (builder) => {
        builder

            // ── Register ───────────────────────────────────────────────────────────
            .addCase(register.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(register.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.isAuthenticated = true;
                storeTokensIfNeeded(action.payload);
                if (action.payload.runner) {
                    state.runner = action.payload.runner;
                } else {
                    state.user = action.payload.user;
                }
            })
            .addCase(register.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || "Registration failed";
            })

            // ── Login ──────────────────────────────────────────────────────────────
            .addCase(login.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(login.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.isAuthenticated = true;
                if (action.payload.userType === 'runner' || action.payload.runner) {
                    state.runner = action.payload.runner || action.payload.user;
                } else {
                    state.user = action.payload.user;
                }
            })
            .addCase(login.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || "Login failed";
            })

            // ── Logout ─────────────────────────────────────────────────────────────
            .addCase(logout.fulfilled, (state) => {
                state.user = null;
                state.runner = null;
                state.isAuthenticated = false;
                state.status = 'idle';
            })

            // ── verifyEmailToken ───────────────────────────────────────────────────
            .addCase(verifyEmailToken.fulfilled, (state, action) => {
                storeTokensIfNeeded(action.payload);
                if (action.payload.isRunner) {
                    state.runner = action.payload.runner;
                } else {
                    state.user = action.payload.user;
                }
                state.isAuthenticated = true;
            })

            // ── verifyEmailOTP ─────────────────────────────────────────────────────
            .addCase(verifyEmailOTP.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(verifyEmailOTP.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.isAuthenticated = true;
                storeTokensIfNeeded(action.payload);
                if (action.payload.runner) {
                    state.runner = action.payload.runner;
                } else if (action.payload.user) {
                    state.user = action.payload.user;
                }
            })
            .addCase(verifyEmailOTP.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || "Email OTP verification failed";
            })

            // ── verifyEmail ────────────────────────────────────────────────────────
            .addCase(verifyEmail.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(verifyEmail.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(verifyEmail.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || "Email verification failed";
            })

            // ── verifyPhone ────────────────────────────────────────────────────────
            .addCase(verifyPhone.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(verifyPhone.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(verifyPhone.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || "Phone verification failed";
            })

            // ── fetchRunnerMe ──────────────────────────────────────────────────────
            .addCase(fetchRunnerMe.pending, (state) => { state.status = 'loading'; })
            .addCase(fetchRunnerMe.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.runner = action.payload.runner;
                state.isAuthenticated = true;
                state.error = null;
            })
            .addCase(fetchRunnerMe.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload;
                // cookie gone or invalid — wipe runner so WhatsAppLikeChatRoot key = 'no-runner'
                const httpStatus = action.payload?.status ?? action.payload?.statusCode;
                if (httpStatus === 401) {
                    const runnerId = state.runner?._id;
                    state.runner = null;
                    state.isAuthenticated = false;
                    wipeRunnerLocalStorage(runnerId);
                    useOrderStore.getState()._reset();
                }
            })

            // ── fetchUserMe ────────────────────────────────────────────────────────
            .addCase(fetchUserMe.pending, (state) => { state.status = 'loading'; })
            .addCase(fetchUserMe.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.user = action.payload.user;
                state.isAuthenticated = true;
                state.error = null;
            })
            .addCase(fetchUserMe.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload;
                const httpStatus = action.payload?.status ?? action.payload?.statusCode;
                if (httpStatus === 401) {
                    state.user = null;
                    state.isAuthenticated = false;
                }
            })

            // ── Simple status cases ────────────────────────────────────────────────
            .addCase(forgotPassword.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(forgotPassword.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(forgotPassword.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(resetPassword.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(resetPassword.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(resetPassword.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(changePassword.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(changePassword.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(changePassword.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(requestEmailVerification.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(requestEmailVerification.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(requestEmailVerification.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(sendEmailVerification.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(sendEmailVerification.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(sendEmailVerification.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(resendEmailVerification.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(resendEmailVerification.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(resendEmailVerification.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(sendReturningUserEmailOTP.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(sendReturningUserEmailOTP.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(sendReturningUserEmailOTP.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(phoneVerificationRequest.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(phoneVerificationRequest.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(phoneVerificationRequest.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; })

            .addCase(resendPhoneVerification.pending, (state) => { state.status = "loading"; state.error = null; })
            .addCase(resendPhoneVerification.fulfilled, (state) => { state.status = "succeeded"; })
            .addCase(resendPhoneVerification.rejected, (state, action) => { state.status = "failed"; state.error = action.payload; });
    },
});

export default authSlice.reducer;
export const {
    updateUser,
    setToken,
    setCredentials,
    clearCredentials,
    clearRunnerSession,
    clearUserSession,
} = authSlice.actions;