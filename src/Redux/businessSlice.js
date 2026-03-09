import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";
import { updateUser } from "./authSlice";
// ── Thunks ────────────────────────────────────────────────────────────────────

export const convertToBusiness = createAsyncThunk(
  "business/convert",
  async ({ businessName }, thunkAPI) => {
    const state = thunkAPI.getState();
    if (state.auth.user?.accountType === "business"){
      return thunkAPI.rejectWithValue("Already a business account")
    }
    try {
      const response = await api.post("/business/convert", { businessName });
       
      thunkAPI.dispatch(updateUser({
        accountType:"business",
        convertedAt:new Date().toISOString(),
        members:[],
        scheduledConversations:[],
      },))
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to convert account"
      );
    }
  }
);

export const fetchTeamMembers = createAsyncThunk(
  "business/fetchTeamMembers",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/business/members");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch team members"
      );
    }
  }
);

export const inviteMember = createAsyncThunk(
  "business/inviteMember",
  async ({ identifier, role }, thunkAPI) => {
    try {
      const response = await api.post("/business/members/invite", { identifier, role });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to invite member"
      );
    }
  }
);

export const removeMember = createAsyncThunk(
  "business/removeMember",
  async ({ memberId }, thunkAPI) => {
    try {
      await api.delete(`/business/members/${memberId}`);
      return memberId; // return the id so we can remove it from state
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to remove member"
      );
    }
  }
);

export const fetchReports = createAsyncThunk(
  "business/fetchReports",
  async ({ period } = {}, thunkAPI) => {
    try {
      const params = period ? `?period=${period}` : "";
      const response = await api.get(`/business/reports${params}`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch reports"
      );
    }
  }
);

export const createSchedule = createAsyncThunk(
  "business/createSchedule",
  async ({ label, cronExpression }, thunkAPI) => {
    try {
      const response = await api.post("/business/schedules", { label, cronExpression });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to create schedule"
      );
    }
  }
);

export const deleteSchedule = createAsyncThunk(
  "business/deleteSchedule",
  async ({ scheduleId }, thunkAPI) => {
    try {
      await api.delete(`/business/schedules/${scheduleId}`);
      return scheduleId;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to delete schedule"
      );
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const businessSlice = createSlice({
  name: "business",
  initialState: {
    status: "idle",
    error: "",
    // conversion
    businessName: null,
    convertedAt: null,
    // team
    members: [],
    membersStatus: "idle",
    // reports
    reports: [],
    reportsStatus: "idle",
    // schedules — pulled from the user's businessProfile on the auth slice
    schedules: [],
  },
  reducers: {
    clearBusinessError(state) {
      state.error = "";
    },
    // call this after login to hydrate business state from the user object
    hydrateFromUser(state, action) {
      const user = action.payload;
      if (user?.accountType === "business" && user?.businessProfile) {
        state.businessName = user.businessProfile.businessName;
        state.convertedAt = user.businessProfile.convertedAt;
        state.schedules = user.businessProfile.scheduledConversations || [];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // convert
      .addCase(convertToBusiness.pending, (state) => {
        state.status = "loading";
        state.error = "";
      })
      .addCase(convertToBusiness.fulfilled, (state, action) => {
        state.status = "succeeded";
        const profile = action.payload?.user?.businessName|| action.payload?.businessProfile;

        if (profile){
        state.businessName = action.payload.businessName;
        state.convertedAt = action.payload.convertedAt;
        }
      })
      .addCase(convertToBusiness.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Conversion failed";
      })

      // team members
      .addCase(fetchTeamMembers.pending, (state) => {
        state.membersStatus = "loading";
      })
      .addCase(fetchTeamMembers.fulfilled, (state, action) => {
        state.membersStatus = "succeeded";
        state.members = action.payload;
      })
      .addCase(fetchTeamMembers.rejected, (state, action) => {
        state.membersStatus = "failed";
        state.error = action.payload || "Failed to load members";
      })

      // invite
      .addCase(inviteMember.pending, (state) => {
        state.status = "loading";
        state.error = "";
      })
      .addCase(inviteMember.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(inviteMember.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Invite failed";
      })

      // remove member
      .addCase(removeMember.fulfilled, (state, action) => {
        state.members = state.members.filter(
          (m) => m.userId?._id !== action.payload && m.userId !== action.payload
        );
      })
      .addCase(removeMember.rejected, (state, action) => {
        state.error = action.payload || "Remove failed";
      })

      // reports
      .addCase(fetchReports.pending, (state) => {
        state.reportsStatus = "loading";
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reportsStatus = "succeeded";
        state.reports = action.payload;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.reportsStatus = "failed";
        state.error = action.payload || "Failed to load reports";
      })

      // schedules
      .addCase(createSchedule.fulfilled, (state, action) => {
        state.schedules.push(action.payload);
      })
      .addCase(createSchedule.rejected, (state, action) => {
        state.error = action.payload || "Failed to create schedule";
      })
      .addCase(deleteSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter(
          (s) => s._id !== action.payload
        );
      });
  },
});

export const { clearBusinessError, hydrateFromUser } = businessSlice.actions;
export default businessSlice.reducer;