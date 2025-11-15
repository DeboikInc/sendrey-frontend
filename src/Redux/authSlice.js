import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const api = axios.create({
    baseURL: "http://localhost:4000/api/v1/auth",
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    withCredentials: true,
});

// Add a request interceptor to automatically add the token
let store;
export const injectStore = (_store) => {
    store = _store;
};

api.interceptors.request.use((config) => {
    const token = store?.getState()?.auth?.token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Reusable thunk for all registration types
export const register = createAsyncThunk(
    "auth/register",
    async (data, thunkAPI) => {
        const { role, email, fullName, firstName, lastName, phone, password, fleetType, serviceType } = data;
        try {
            const endpoint =
                role === "runner"
                    ? "/register-runner"
                    : role === "admin"
                        ? "/register-admin"
                        : "/register-user";

            const payload = {
                phone,
                password,
                email,
                fleetType,
                role,
                serviceType
            };

            if (fullName) {
                payload.fullName = fullName;
            }
            if (firstName) {
                payload.firstName = firstName;
            }
            if (lastName) {
                payload.lastName = lastName;
            }

            const response = await api.post(endpoint, payload);
            return response.data.data;
        } catch (error) {
            if (error.response?.data?.errors) {
                const firstError = error.response.data.errors[0];
                return thunkAPI.rejectWithValue(firstError.message);
            }
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Something went wrong"
            );
        }
    }
);

export const login = createAsyncThunk(
    "auth/login",
    async ({ email, password }, thunkAPI) => {
        try {
            const response = await api.post("/login", { email, password });
            return response.data.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Login failed"
            );
        }
    }
);

export const logout = createAsyncThunk("auth/logout", async (_, thunkAPI) => {
    try {
        const response = await api.post("/logout");
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "Logout failed"
        );
    }
});

export const verifyEmail = createAsyncThunk("auth/verify-email", async ({ token }, thunkAPI) => {
    try {
        const response = await api.post("/verify-email", { token })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "verification failed"
        )
    }
});

export const resendEmailVerification = createAsyncThunk("auth/resend-email-verification", async ({ email }, thunkAPI) => {
    try {
        const response = await api.post("/resend-verification", { email })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "failed to resend verification"
        )
    }
});

export const forgotPassword = createAsyncThunk("auth/forgot-password", async ({ phone, email }, thunkAPI) => {
    try {
        if (!email && !phone) {
            return thunkAPI.rejectWithValue("Either email or phone number is required");
        }

        const response = await api.post("/forgot-password", {
            email: email || undefined,
            phone: phone || undefined
        })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});

export const resetPassword = createAsyncThunk("auth/reset-password", async ({ token, newPassword }, thunkAPI) => {
    try {
        const response = await api.post("/reset-password", { token, newPassword })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});

export const changePassword = createAsyncThunk("auth/change-password", async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
        const response = await api.post("/change-password", { currentPassword, newPassword })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});

export const phoneVerificationRequest = createAsyncThunk("auth/phone-verification-request", async ({ phone }, thunkAPI) => {
    try {
        const response = await api.post("/request-phone-verification", { phone })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});

// verify phone number - verify-phone
export const verifyPhone = createAsyncThunk(
    "auth/verify-phone", 
    async ({ phone, otp }, thunkAPI) => {
        try {
            // console.log("Sending verify phone request with:", { phone, otp }); 
            const response = await api.post("/verify-phone", { phone, otp });
            // console.log("Verify phone response:", response.data); 
            return response.data;
        } catch (error) {
            console.error("Verify phone error:", error.response?.data);
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "OTP verification failed"
            );
        }
    }
);


const authSlice = createSlice({
    name: "auth",
    initialState: {
        status: "idle",
        error: "",
        user: null,
        token: null,
    },
    reducers: {
        logout(state) {
            state.user = null;
            state.token = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(register.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(register.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.isAuthenticated = true;
                state.token = action.payload.token;
                state.user = action.payload.user;
            })
            .addCase(register.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(login.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(login.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(login.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(verifyEmail.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(verifyEmail.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(verifyEmail.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(resendEmailVerification.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(resendEmailVerification.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(resendEmailVerification.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(forgotPassword.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(forgotPassword.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(forgotPassword.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(resetPassword.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(resetPassword.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(resetPassword.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(changePassword.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(changePassword.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(changePassword.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(phoneVerificationRequest.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(phoneVerificationRequest.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(phoneVerificationRequest.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })

            .addCase(verifyPhone.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(verifyPhone.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload.user;
            })
            .addCase(verifyPhone.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error.message;
            })
    },
});

export default authSlice.reducer;