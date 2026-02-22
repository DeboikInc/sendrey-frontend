import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";



// Reusable thunk for all registration types
export const register = createAsyncThunk(
    "auth/register",
    async (data, thunkAPI) => {
        const { role, email, fullName, firstName, lastName, phone, password, fleetType, serviceType, latitude, longitude, } = data;
        try {
            const endpoint =
                role === "runner"
                    ? "/auth/register-runner"
                    : role === "admin"
                        ? "/auth/register-admin"
                        : "/auth/register-user";

            const payload = {
                phone,
                password,
                email,
                fleetType,
                role,
                serviceType,
                latitude,
                longitude,

                ...(role === 'runner' && {
                    isOnline: true,
                    isAvailable: true
                })
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


            console.log('serviceType during registration:', serviceType);
            const response = await api.post(endpoint, payload);
            console.log('Registration response:', response.data)
            return response.data;
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
            const response = await api.post("/auth/login", { email, password });
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error.response?.data?.message || "Login failed"
            );
        }
    }
);

export const logout = createAsyncThunk("auth/logout", async (_, thunkAPI) => {
    try {
        const response = await api.post("/auth/logout");
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "Logout failed"
        );
    }
});

export const verifyEmail = createAsyncThunk("auth/verify-email", async ({ token }, thunkAPI) => {
    try {
        const response = await api.post("/auth/verify-email", { token })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "verification failed"
        )
    }
});

export const resendEmailVerification = createAsyncThunk("auth/resend-email-verification", async ({ email }, thunkAPI) => {
    try {
        const response = await api.post("/auth/resend-verification", { email })
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

        const response = await api.post("/auth/forgot-password", {
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
        const response = await api.post("/auth/reset-password", { token, newPassword })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});

export const changePassword = createAsyncThunk("auth/change-password", async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
        const response = await api.post("/auth/change-password", { currentPassword, newPassword })
        return response.data
    } catch (error) {
        return thunkAPI.rejectWithValue(
            error.response?.data?.message || "something went wrong, try again later"
        )
    }
});

export const phoneVerificationRequest = createAsyncThunk("auth/phone-verification-request", async ({ phone }, thunkAPI) => {
    try {
        const response = await api.post("/auth/request-phone-verification", { phone })
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
            const response = await api.post("/auth/verify-phone", { phone, otp });
            console.log("Verify phone response:", response.data);
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
                // console.log('Register payload token:', action.payload.token);

                state.status = "succeeded";
                state.isAuthenticated = true;
                state.token = action.payload.token; // KEEP - registration has token
                state.user = action.payload.user;
            })
            .addCase(register.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Registration failed";
            })

            .addCase(login.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(login.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.token = action.payload.token; // KEEP - login has token
                state.user = action.payload.user;
                state.isAuthenticated = true;
            })
            .addCase(login.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Login failed";
            })

            .addCase(verifyEmail.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(verifyEmail.fulfilled, (state, action) => {
                state.status = "succeeded";

                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
            })
            .addCase(verifyEmail.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Email verification failed";
            })

            .addCase(resendEmailVerification.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(resendEmailVerification.fulfilled, (state, action) => {
                state.status = "succeeded";

                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
            })
            .addCase(resendEmailVerification.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Failed to resend verification";
            })

            .addCase(verifyPhone.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(verifyPhone.fulfilled, (state, action) => {
                state.status = "succeeded";
                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
                state.isAuthenticated = true;
            })
            .addCase(verifyPhone.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Phone verification failed";
            })

            .addCase(forgotPassword.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(forgotPassword.fulfilled, (state, action) => {
                state.status = "succeeded";
                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
            })
            .addCase(forgotPassword.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Forgot password failed";
            })

            .addCase(resetPassword.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(resetPassword.fulfilled, (state, action) => {
                state.status = "succeeded";
                // Only update token if provided (resetPassword might return token)
                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
            })
            .addCase(resetPassword.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Reset password failed";
            })

            .addCase(changePassword.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(changePassword.fulfilled, (state, action) => {
                state.status = "succeeded";

                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
            })
            .addCase(changePassword.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Change password failed";
            })

            .addCase(phoneVerificationRequest.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(phoneVerificationRequest.fulfilled, (state, action) => {
                state.status = "succeeded";

                if (action.payload.token) {
                    state.token = action.payload.token;
                }
                state.user = action.payload.user;
            })
            .addCase(phoneVerificationRequest.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.message || action.error?.message || "Phone verification request failed";
            });
    },
});

export default authSlice.reducer;
export const { logout: logoutAction } = authSlice.actions;