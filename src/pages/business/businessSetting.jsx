import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, Clock, Plus, Trash2, Download, X, ArrowLeft, Calendar
} from "lucide-react";
import {
  fetchTeamMembers, inviteMember, removeMember,
  fetchReports, createSchedule, deleteSchedule, clearBusinessError,
} from "../../Redux/businessSlice";
import useDarkMode from "../../hooks/useDarkMode";

// ── Sleek Theme Tokens (Black & Slate) ──────────────────────────────────────
const theme = (dark) => ({
  page: dark
    ? { background: "#000000", color: "#ffffff" }
    : { background: "#f8fafc", color: "#111827" },

  card: dark
    ? { background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)" }
    : { background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" },

  cardHard: dark
    ? { background: "#111111", border: "1px solid rgba(255,255,255,0.1)" }
    : { background: "#f9fafb", border: "1px solid #e5e7eb" },

  input: dark
    ? { background: "#111111", border: "1px solid #333333", color: "#ffffff" }
    : { background: "#ffffff", border: "1px solid #d1d5db", color: "#111827" },

  tabBar: dark
    ? { background: "#111111", border: "1px solid #222222" }
    : { background: "#e5e7eb", border: "none" },

  tabActive: dark
    ? { background: "#ffffff", color: "#000000" }
    : { background: "#ffffff", color: "#111827", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },

  tabInactive: dark ? { color: "#71717a" } : { color: "#6b7280" },

  primaryBtn: { 
    background: dark ? "#ffffff" : "#111827", 
    color: dark ? "#111827" : "#ffffff" 
  },
  
  ghostBtn: dark
    ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#d1d5db" }
    : { background: "#ffffff", border: "1px solid #d1d5db", color: "#374151" },

  badge: {
    admin:   dark ? { background: "#ffffff", color: "#000000" } : { background: "#111827", color: "#ffffff" },
    manager: dark ? { background: "#27272a", color: "#ffffff" } : { background: "#dbeafe", color: "#1d4ed8" },
    staff:   dark ? { background: "transparent", border: "1px solid #333", color: "#a1a1aa" } : { background: "#f3f4f6", color: "#374151" },
  },

  avatar: dark
    ? { background: "#27272a", color: "#ffffff" }
    : { background: "#e5e7eb", color: "#374151" },
    
  divider: dark
    ? { borderBottom: "1px solid rgba(255,255,255,0.07)" }
    : { borderBottom: "1px solid #f3f4f6" },
});

export default function BusinessSettings() {
  const [dark] = useDarkMode();
  const t = theme(dark);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { 
    status, error, businessName, members, membersStatus,
    reports, reportsStatus, schedules 
  } = useSelector((s) => s.business);

  const isBusiness = user?.accountType === "business";

  // State Management
  const [activeTab, setActiveTab] = useState("team");
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Effects
  useEffect(() => {
    if (isBusiness) { 
      dispatch(fetchTeamMembers()); 
      dispatch(fetchReports({})); 
    }
  }, [isBusiness, dispatch]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => dispatch(clearBusinessError()), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  // Handlers
  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;
    dispatch(inviteMember({ identifier: inviteIdentifier.trim(), role: inviteRole }))
      .unwrap().then(() => {
        setInviteIdentifier(""); setInviteRole("staff");
        setShowInviteForm(false); dispatch(fetchTeamMembers());
      });
  };

  const handleRemove = (memberId) => {
    if (!window.confirm("Remove this member from your team?")) return;
    dispatch(removeMember({ memberId }));
  };

  const handleCreateSchedule = (e) => {
    e.preventDefault();
    if (!scheduleLabel.trim() || !scheduleDate || !scheduleTime) return;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    dispatch(createSchedule({ label: scheduleLabel.trim(), scheduledAt }))
      .unwrap().then(() => {
        setScheduleLabel(""); setScheduleDate(""); setScheduleTime("");
        setShowScheduleForm(false);
      });
  };

  const handleExportCSV = (reportId) =>
    window.open(`http://localhost:4000/api/v1/business/reports/${reportId}/export/csv`, "_blank");

  const tabs = [
    { id: "team", label: "Team", icon: Users },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "schedules", label: "Schedules", icon: Clock },
  ];

  const inputCls = "w-full rounded-2xl px-5 py-4 text-sm focus:outline-none placeholder:text-gray-500 transition-all";

  return (
    <div className="fixed inset-0 overflow-auto transition-colors duration-300" style={t.page}>
      <div className="min-h-full w-full max-w-2xl mx-auto px-6 py-10">
        
        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-10">
          <button 
            onClick={() => navigate("/welcome")} 
            className="p-3 rounded-2xl transition-all active:scale-90"
            style={t.ghostBtn}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: t.title }}>
              {businessName || "Business Dashboard"}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">
              Administration
            </p>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-6 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-between bg-red-500/10 border border-red-500/20 text-red-500 animate-in fade-in slide-in-from-top-2">
            <span>{error}</span>
            <button onClick={() => dispatch(clearBusinessError())}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex p-1.5 rounded-[1.5rem] mb-10" style={t.tabBar}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest transition-all duration-300"
              style={activeTab === tab.id ? t.tabActive : t.tabInactive}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Team Tab ── */}
        {activeTab === "team" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="rounded-[2.5rem] p-8 shadow-2xl" style={t.card}>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold">Team Directory</h2>
                {!showInviteForm && (
                  <button onClick={() => setShowInviteForm(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all" style={t.ghostBtn}>
                    <Plus className="h-3 w-3" /> Invite
                  </button>
                )}
              </div>

              {showInviteForm && (
                <form onSubmit={handleInvite} className="mb-10 p-6 rounded-[2rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 space-y-4">
                  <input type="text" placeholder="Email or Phone" value={inviteIdentifier} onChange={(e) => setInviteIdentifier(e.target.value)} className={inputCls} style={t.input} />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={inputCls} style={t.input}>
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="flex gap-3">
                    <button type="submit" disabled={status === "loading"} style={t.primaryBtn} className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50">
                      {status === "loading" ? "Inviting..." : "Send Invite"}
                    </button>
                    <button type="button" onClick={() => setShowInviteForm(false)} style={t.ghostBtn} className="px-6 rounded-2xl text-[11px] font-black uppercase">Cancel</button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {membersStatus === "loading" && <p className="text-xs opacity-50">Loading directory...</p>}
                {members.map((member) => {
                  const u = member.userId;
                  const id = u?._id || u;
                  return (
                    <div key={id} className="flex items-center justify-between py-5 group transition-all" style={t.divider}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm" style={t.avatar}>
                          {u?.firstName?.[0] || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{u?.firstName} {u?.lastName || ""}</p>
                          <p className="text-[11px] font-medium opacity-50">{u?.email || u?.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border shadow-sm" style={t.badge[member.role] || t.badge.staff}>
                          {member.role}
                        </span>
                        {member.role !== "admin" && (
                          <button onClick={() => handleRemove(id)} className="p-2 opacity-0 group-hover:opacity-100 text-red-500 transition-all hover:scale-110">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === "reports" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex gap-2 mb-4">
              {["weekly", "monthly"].map((p) => (
                <button key={p} onClick={() => dispatch(fetchReports({ period: p }))}
                  className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  style={t.ghostBtn}>
                  {p} Reports
                </button>
              ))}
            </div>
            {reports.map((report) => (
              <div key={report._id} className="flex items-center justify-between p-7 rounded-[2.5rem] transition-all hover:translate-y-[-2px]" style={t.card}>
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <FileText className="h-5 w-5 opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{report.period} Report</p>
                    <p className="text-xs font-medium opacity-50">
                      {report.totalTasks} deliveries · ₦{(report.totalSpend || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleExportCSV(report._id)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-3 rounded-xl transition-all active:scale-95 shadow-sm"
                  style={t.ghostBtn}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Schedules Tab ── */}
        {activeTab === "schedules" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {!showScheduleForm ? (
              <button onClick={() => setShowScheduleForm(true)}
                className="w-full flex items-center justify-center gap-4 p-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 hover:border-zinc-400 transition-all group">
                <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" /> Add Delivery Schedule
              </button>
            ) : (
              <div className="rounded-[2.5rem] p-8 mb-6" style={t.card}>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-8 text-center">New Delivery Schedule</h3>
                <form onSubmit={handleCreateSchedule} className="space-y-4">
                  <input type="text" placeholder="Label (e.g. Office Supplies)" value={scheduleLabel} onChange={(e) => setScheduleLabel(e.target.value)} className={inputCls} style={t.input} />
                  <div className="flex gap-3">
                    <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className={inputCls} style={{ ...t.input, colorScheme: dark ? "dark" : "light" }} />
                    <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={inputCls} style={{ ...t.input, colorScheme: dark ? "dark" : "light" }} />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="submit" disabled={status === "loading"} style={t.primaryBtn} className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95">
                      {status === "loading" ? "Saving..." : "Save Schedule"}
                    </button>
                    <button type="button" onClick={() => setShowScheduleForm(false)} style={t.ghostBtn} className="px-8 rounded-2xl text-[11px] font-black uppercase">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {schedules.map((s) => (
              <div key={s._id} className="flex items-center justify-between p-7 rounded-[2.5rem]" style={t.card}>
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <Calendar className="h-5 w-5 opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{s.label}</p>
                    <p className="text-[11px] font-medium opacity-50">
                      {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : s.cronExpression}
                    </p>
                  </div>
                </div>
                <button onClick={() => dispatch(deleteSchedule({ scheduleId: s._id }))} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}