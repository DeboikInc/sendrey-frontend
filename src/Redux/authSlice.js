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

// Reusable thunk for all registration types
export const register = createAsyncThunk(
    "auth/register",
    async ({ role, email, fullName, phone, password }, thunkAPI) => {
        try {
            const endpoint =
                role === "runner"
                    ? "/register-runner"
                    : role === "admin"
                        ? "/register-admin"
                        : "/register-user";
            // mostly phone and password
            const response = await api.post(endpoint, { fullName, phone, password, email });
            return response.data.data;
        } catch (error) {
            if (error.response?.data?.errors) {
                // Return the first error message from the errors array
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

// verify email
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

// resend email verification
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

// forgot password
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

// reset password
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

// change password
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

// request-phone-verification
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
export const verifyPhone = createAsyncThunk("auth/verify-phone", async ({ otp }, thunkAPI) => {
    try {
        const response = await api.post("/verify-phone", { otp })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});



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
            // Register
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

            // Login
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

            // verify email
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

            // resendEmailVerification
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

            // forgotPassword
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

            // resetPassword
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

            // changePassword
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

            // phoneVerificationRequest
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

            // verifyPhone
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
