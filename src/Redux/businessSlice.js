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
      const user = response.data?.user;
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
      return response.data?.members || [];
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch team members"
      );
    }
  }
);

export const updateMemberRole = createAsyncThunk(
  "business/updateMemberRole",
  async ({ memberId, role }, thunkAPI) => {
    try {
      const response = await api.patch(`/business/team/${memberId}/role`, { role });
      return response.data?.members || [];
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update role"
      );
    }
  }
);

export const updateScheduleStatus = createAsyncThunk(
  "business/updateScheduleStatus",
  async ({ scheduleId, status }, thunkAPI) => {
    try {
      const response = await api.patch(`/business/schedules/${scheduleId}/status`, { status });
      return response.data?.schedule;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to update schedule status"
      );
    }
  }
);

export const inviteMember = createAsyncThunk(
  "business/inviteMember",
  async ({ identifier, role }, thunkAPI) => {
    try {
      const response = await api.post("/business/team/invite", { identifier, role });
      return response.data?.invitee;
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
      return response.data?.reports || [];
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch reports"
      );
    }
  }
);

export const fetchSchedules = createAsyncThunk(
  "business/fetchSchedules",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/business/schedules");
      return response.data?.schedules || [];
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch schedules"
      );
    }
  }
);

export const generateExpenseReport = createAsyncThunk(
  "business/generateExpenseReport",
  async ({ period }, thunkAPI) => {
    try {
      const response = await api.post("/business/reports/generate", { period });
      return response.data?.report;
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
      return response.data?.schedule;
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
      return response.data;
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
      return response.data;
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
    schedulesStatus: "idle",
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
        state.convertedAt = user.businessProfile.convertedAt;
        state.schedules = user.businessProfile.scheduledConversations || [];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // ── convert ────────────────────────────────────────────────────────────
      .addCase(convertToBusiness.pending, (state) => {
        state.status = "loading";
        state.error = "";
      })
      .addCase(convertToBusiness.fulfilled, (state, action) => {
        state.status = "succeeded";
        const profile = action.payload?.user?.businessProfile;
        if (profile) {
          state.businessName = profile.businessName;
          state.convertedAt = profile.convertedAt;
          state.schedules = profile.scheduledConversations || [];
        }
      })
      .addCase(convertToBusiness.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Conversion failed";
      })

      // ── team members ───────────────────────────────────────────────────────
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

      // ── invite ─────────────────────────────────────────────────────────────
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

      // ── remove member ──────────────────────────────────────────────────────
      .addCase(removeMember.fulfilled, (state, action) => {
        state.members = state.members.filter(
          (m) => m.userId?._id !== action.payload && m.userId !== action.payload
        );
      })
      .addCase(removeMember.rejected, (state, action) => {
        state.error = action.payload || "Remove failed";
      })

      .addCase(updateMemberRole.fulfilled, (state, action) => {
        state.members = action.payload;
      })
      .addCase(updateMemberRole.rejected, (state, action) => {
        state.error = action.payload || "Failed to update role";
      })

      // ── reports ────────────────────────────────────────────────────────────
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

      // ── generate report ────────────────────────────────────────────────────
      .addCase(generateExpenseReport.fulfilled, (state, action) => {
        if (action.payload) state.reports.unshift(action.payload);
      })
      .addCase(generateExpenseReport.rejected, (state, action) => {
        state.error = action.payload || "Failed to generate report";
      })

      // ── schedules ──────────────────────────────────────────────────────────
      .addCase(fetchSchedules.pending, (state) => {
        state.schedulesStatus = "loading";
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.schedulesStatus = "succeeded";
        state.schedules = action.payload;
      })
      .addCase(fetchSchedules.rejected, (state, action) => {
        state.schedulesStatus = "failed";
        state.error = action.payload || "Failed to load schedules";
      })
      // create schedules
      .addCase(createSchedule.fulfilled, (state, action) => {
        state.status = "succeeded";
        if (action.payload) state.schedules.push(action.payload);
      })
      .addCase(createSchedule.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to create schedule";
      })
      .addCase(deleteSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter((s) => s._id !== action.payload);
      })
      .addCase(deleteSchedule.rejected, (state, action) => {
        state.error = action.payload || "Failed to delete schedule";
      })

      // statuses
      .addCase(updateScheduleStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        const idx = state.schedules.findIndex(s => s._id === updated._id);
        if (idx !== -1) state.schedules[idx] = updated;
      })
      .addCase(updateScheduleStatus.rejected, (state, action) => {
        state.error = action.payload || "Failed to update schedule status";
      })

      // ── suggestion ─────────────────────────────────────────────────────────
      .addCase(getSuggestionStatus.fulfilled, (state, action) => {
        state.suggestion = { ...state.suggestion, ...action.payload, status: "succeeded" };
      })
      .addCase(dismissSuggestion.fulfilled, (state, action) => {
        state.suggestion.shouldSuggest = false;
        state.suggestion.optedOut = action.payload?.optedOut || false;
      })
      .addCase(acknowledgeSuggestion.fulfilled, (state) => {
        state.suggestion.shouldSuggest = false;
      });
  },
});

export const { clearBusinessError, hydrateFromUser } = businessSlice.actions;
export default businessSlice.reducer;