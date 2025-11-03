import axios from "axios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const api = axios.create({
    // http://localhost:4000/api/v1/users/runners
    baseURL: "http://localhost:4000/api/v1/users",
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    withCredentials: true,
});


export const fetchRunners = createAsyncThunk(
    "users/fetchRunners",
    async (fleetType = null, { getState, rejectWithValue }) => {
        try {
            const token = getState().auth?.token;

            if (!token) {
                return rejectWithValue("No authentication token found");
            }

            const url = fleetType 
                ? `/runners?fleetType=${fleetType}` 
                : '/runners';

            const res = await api.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            return res.data.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message || "Failed to fetch runners"
            );
        }
    }
);

const userSlice = createSlice({
    name: "users",
    initialState: {
        runners: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchRunners.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchRunners.fulfilled, (state, action) => {
                state.loading = false;
                state.runners = action.payload;
            })
            .addCase(fetchRunners.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch runners";
            });
    },
});

export default userSlice.reducer;
