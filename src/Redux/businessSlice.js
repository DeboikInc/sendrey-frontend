import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";
import { updateUser } from "./authSlice";

// ── Thunks ────────────────────────────────────────────────────────────────────

export const convertToBusiness = createAsyncThunk(
  "business/convert",
  async ({ businessName }, thunkAPI) => {
    const state = thunkAPI.getState();
    if (state.auth.user?.accountType === "business") {
      return thunkAPI.rejectWithValue("Already a business account");
    }
    try {
      const response = await api.post("/business/convert", { businessName });
      const user = response.data?.data?.user;
      if (user) {
        thunkAPI.dispatch(updateUser({
          accountType: "business",
          businessProfile: user.businessProfile,
        }));
      }
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
      const response = await api.get("/business/team");
      return response.data?.data?.members || [];
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
      const response = await api.post("/business/team/invite", { identifier, role }); // ✅ was /business/members/invite
      return response.data?.data?.invitee;
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
      await api.delete(`/business/team/${memberId}`);
      return memberId;
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
      return response.data?.data?.reports || [];
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch reports"
      );
    }
  }
);

export const generateExpenseReport = createAsyncThunk(
  "business/generateExpenseReport",
  async ({ period }, thunkAPI) => {
    try {
      const response = await api.post("/business/reports/generate", { period });
      return response.data?.data?.report;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to generate report"
      );
    }
  }
);

export const createSchedule = createAsyncThunk(
  "business/createSchedule",
  async ({ label, scheduledAt }, thunkAPI) => {          
    try {
      const response = await api.post("/business/schedules", { label, scheduledAt });
      return response.data?.data?.schedule;
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

export const getSuggestionStatus = createAsyncThunk(
  "business/getSuggestionStatus",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/business/suggestion/status");
      return response.data?.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to get suggestion status"
      );
    }
  }
);

export const dismissSuggestion = createAsyncThunk(
  "business/dismissSuggestion",
  async (_, thunkAPI) => {
    try {
      const response = await api.post("/business/suggestion/dismiss");
      return response.data?.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to dismiss suggestion"
      );
    }
  }
);

export const acknowledgeSuggestion = createAsyncThunk(
  "business/acknowledgeSuggestion",
  async (_, thunkAPI) => {
    try {
      await api.post("/business/suggestion/acknowledge");
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to acknowledge suggestion"
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
    // schedules
    schedules: [],
    // suggestion
    suggestion: {
      shouldSuggest: false,
      monthlyTaskCount: 0,
      optedOut: false,
      status: "idle",
    },
  },
  reducers: {
    clearBusinessError(state) {
      state.error = "";
    },
    hydrateFromUser(state, action) {
      const user = action.payload;
      if (user?.accountType === "business" && user?.businessProfile) {
        state.businessName = user.businessProfile.businessName;
        state.convertedAt  = user.businessProfile.convertedAt;
        state.schedules    = user.businessProfile.scheduledConversations || [];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // ── convert ────────────────────────────────────────────────────────────
      .addCase(convertToBusiness.pending, (state) => {
        state.status = "loading";
        state.error  = "";
      })
      .addCase(convertToBusiness.fulfilled, (state, action) => {
        state.status = "succeeded";
        const profile = action.payload?.data?.user?.businessProfile;
        if (profile) {
          state.businessName = profile.businessName;
          state.convertedAt  = profile.convertedAt;
          state.schedules    = profile.scheduledConversations || [];
        }
      })
      .addCase(convertToBusiness.rejected, (state, action) => {
        state.status = "failed";
        state.error  = action.payload || "Conversion failed";
      })

      // ── team members ───────────────────────────────────────────────────────
      .addCase(fetchTeamMembers.pending, (state) => {
        state.membersStatus = "loading";
      })
      .addCase(fetchTeamMembers.fulfilled, (state, action) => {
        state.membersStatus = "succeeded";
        state.members       = action.payload;
      })
      .addCase(fetchTeamMembers.rejected, (state, action) => {
        state.membersStatus = "failed";
        state.error         = action.payload || "Failed to load members";
      })

      // ── invite ─────────────────────────────────────────────────────────────
      .addCase(inviteMember.pending, (state) => {
        state.status = "loading";
        state.error  = "";
      })
      .addCase(inviteMember.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(inviteMember.rejected, (state, action) => {
        state.status = "failed";
        state.error  = action.payload || "Invite failed";
      })

      // ── remove member ──────────────────────────────────────────────────────
      .addCase(removeMember.fulfilled, (state, action) => {
        state.members = state.members.filter(
          (m) => m.userId?._id !== action.payload && m.userId !== action.payload
        );
      })
      .addCase(removeMember.rejected, (state, action) => {
        state.error = action.payload || "Remove failed";
      })

      // ── reports ────────────────────────────────────────────────────────────
      .addCase(fetchReports.pending, (state) => {
        state.reportsStatus = "loading";
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reportsStatus = "succeeded";
        state.reports       = action.payload;
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.reportsStatus = "failed";
        state.error         = action.payload || "Failed to load reports";
      })

      // ── generate report ────────────────────────────────────────────────────
      .addCase(generateExpenseReport.fulfilled, (state, action) => {
        if (action.payload) state.reports.unshift(action.payload);
      })
      .addCase(generateExpenseReport.rejected, (state, action) => {
        state.error = action.payload || "Failed to generate report";
      })

      // ── schedules ──────────────────────────────────────────────────────────
      .addCase(createSchedule.fulfilled, (state, action) => {
        if (action.payload) state.schedules.push(action.payload);
      })
      .addCase(createSchedule.rejected, (state, action) => {
        state.error = action.payload || "Failed to create schedule";
      })
      .addCase(deleteSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter((s) => s._id !== action.payload);
      })
      .addCase(deleteSchedule.rejected, (state, action) => {
        state.error = action.payload || "Failed to delete schedule";
      })

      // ── suggestion ─────────────────────────────────────────────────────────
      .addCase(getSuggestionStatus.fulfilled, (state, action) => {
        state.suggestion = { ...state.suggestion, ...action.payload, status: "succeeded" };
      })
      .addCase(dismissSuggestion.fulfilled, (state, action) => {
        state.suggestion.shouldSuggest = false;
        state.suggestion.optedOut      = action.payload?.optedOut || false;
      })
      .addCase(acknowledgeSuggestion.fulfilled, (state) => {
        state.suggestion.shouldSuggest = false;
      });
  },
});

export const { clearBusinessError, hydrateFromUser } = businessSlice.actions;
export default businessSlice.reducer;