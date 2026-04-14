import React, { useEffect, useState } from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import {
  Users, FileText, Clock, Plus, Trash2, Download, X, ChevronLeft, Calendar
} from "lucide-react";
import {
  fetchTeamMembers, inviteMember, removeMember,
  fetchReports, generateExpenseReport,
  createSchedule, deleteSchedule, clearBusinessError, fetchSchedules, updateMemberRole,
  exportReportCSV, exportReportPDF
} from "../../../Redux/businessSlice";

export default function BusinessSettings({ darkMode, onBack, initialTab, editScheduleId }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const {
    status, error, businessName, members, membersStatus,
    reports, reportsStatus, schedules,
  } = useSelector((s) => s.business, shallowEqual);

  const [activeTab, setActiveTab] = useState(initialTab || "team");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  useEffect(() => {
    dispatch(fetchTeamMembers());
    dispatch(fetchReports({}));
    dispatch(fetchSchedules());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => dispatch(clearBusinessError()), 4000);
      return () => clearTimeout(t);
    }
  }, [error, dispatch]);

  useEffect(() => {
    if (editScheduleId && schedules.length > 0) {
      const target = schedules.find(s => s._id === editScheduleId);
      if (target) {
        setEditingSchedule(target);
        // pre-fill the form fields
        setScheduleLabel(target.label);
        // parse scheduledAt back to date and time strings
        const d = new Date(target.scheduledAt);
        const dateStr = d.toISOString().split('T')[0]; // "2026-03-10"
        const timeStr = d.toTimeString().slice(0, 5);   // "14:30"
        setScheduleDate(dateStr);
        setScheduleTime(timeStr);
        setShowScheduleForm(true);
        setActiveTab("schedules");
      }
    }
  }, [editScheduleId, schedules]);

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;
    dispatch(inviteMember({ identifier: inviteIdentifier.trim(), role: inviteRole }))
      .unwrap()
      .then(() => {
        setInviteIdentifier(""); setInviteRole("staff");
        setShowInviteForm(false); dispatch(fetchTeamMembers());
      })
      .catch((err) => {
        alert(`Failed to invite member: ${err?.message || err}`);
      });
  };

  const handleRemove = (memberId) => {
    if (!window.confirm("Remove this member from your team?")) return;
    dispatch(removeMember({ memberId }));
  };

  const handleCreateSchedule = (e) => {
    e.preventDefault();
    if (!scheduleLabel.trim() || !scheduleDate || !scheduleTime) return;

    const timeWithSeconds = scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime;
    const dateTimeString = `${scheduleDate}T${timeWithSeconds}`;
    const parsed = new Date(dateTimeString);
    const scheduledAt = parsed.toISOString();

    if (editingSchedule) {
      // update existing — delete old, create new with 'modified' status
      dispatch(deleteSchedule({ scheduleId: editingSchedule._id }))
        .unwrap()
        .then(() => {
          return dispatch(createSchedule({
            label: scheduleLabel.trim(),
            scheduledAt,
            status: 'modified'
          })).unwrap();
        })
        .then(() => {
          setScheduleLabel(""); setScheduleDate(""); setScheduleTime("");
          setShowScheduleForm(false); setEditingSchedule(null);
        })
        .catch((err) => alert(`Failed: ${err}`));
    } else {
      dispatch(createSchedule({ label: scheduleLabel.trim(), scheduledAt }))
        .unwrap()
        .then(() => {
          setScheduleLabel(""); setScheduleDate(""); setScheduleTime("");
          setShowScheduleForm(false);
        })
        .catch((err) => alert(`Failed: ${err}`));
    }
  };

  const tabs = [
    { id: "team", label: "Team", icon: Users },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "schedules", label: "Schedules", icon: Clock },
  ];

  // ── style helpers ─────────────────────────────────────────────────────────
  const page = darkMode ? "bg-black-100" : "bg-gray-50";
  const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
  const inner = darkMode ? "bg-black-200 border-white/10" : "bg-gray-50 border-gray-200"; // eslint-disable-line no-unused-vars
  const tabBar = darkMode ? "bg-black-200" : "bg-gray-100";
  const tabActive = darkMode ? "bg-black-100 text-white" : "bg-white text-black-200";
  const tabInactive = darkMode ? "text-gray-500" : "text-gray-400";
  const heading = darkMode ? "text-white" : "text-black-200";
  const ghost = darkMode ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200";
  const inputCls = `w-full rounded-2xl px-5 py-4 text-sm focus:outline-none placeholder:text-gray-400 border ${darkMode ? "bg-black-200 border-white/10 text-white" : "bg-white border-gray-200 text-black-200"
    }`;
  const divider = darkMode ? "border-white/5" : "border-gray-50";
  const avatar = darkMode ? "bg-black-200 text-white" : "bg-gray-100 text-black-200";
  const iconBox = darkMode ? "bg-black-200" : "bg-gray-100";

  const roleBadge = (role) => ({
    admin: darkMode ? "bg-white text-black-200" : "bg-black-200 text-white",
    manager: darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
    staff: darkMode ? "bg-white/5 text-gray-400 border border-white/10" : "bg-gray-100 text-gray-500",
  }[role] || (darkMode ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"));

  const currentUserRole = members.find(
    m => (m.userId?._id || m.userId) === user?._id
  )?.role || "admin"; // owner has no member entry, treat as admin

  const canManageTeam = currentUserRole === "admin" || currentUserRole === "manager";

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${page}`}>

      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b flex-shrink-0 ${darkMode ? "border-white/10" : "border-gray-100"}`}>
        <button
          onClick={onBack}
          className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-black-200" : "hover:bg-gray-100"}`}
        >
          <ChevronLeft className={`w-5 h-5 ${heading}`} />
        </button>
        <div>
          <h1 className={`text-lg font-bold ${heading}`}>
            {businessName || user?.businessProfile?.businessName || "Business"}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            Administration
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-4 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-between bg-red-500/10 border border-red-500/20 text-red-500">
          <span>{error}</span>
          <button onClick={() => dispatch(clearBusinessError())}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex-shrink-0 px-4 pt-4">
        <div className={`flex p-1.5 rounded-2xl ${tabBar}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === tab.id ? `shadow-sm ${tabActive}` : tabInactive
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 marketSelection">

        {/* ── Team Tab ──────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div className={`rounded-3xl p-6 border ${card}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-base font-bold ${heading}`}>Team Directory</h2>
              {canManageTeam && !showInviteForm && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${ghost}`}
                >
                  <Plus className="h-3 w-3" /> Invite
                </button>
              )}
            </div>

            {showInviteForm && (
              <form onSubmit={handleInvite} className={`mb-8 p-5 rounded-2xl border-2 border-dashed space-y-3 ${darkMode ? "border-white/10" : "border-gray-200"}`}>
                <input
                  type="text"
                  placeholder="Email or Phone"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  className={inputCls}
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className={inputCls}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>


                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {status === "loading" ? "Inviting..." : "Send Invite"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className={`px-6 rounded-2xl text-[11px] font-black uppercase border ${ghost}`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1">
              {membersStatus === "loading" && (
                <p className="text-xs text-gray-400 py-4 text-center">Loading directory...</p>
              )}
              {members.length === 0 && membersStatus !== "loading" && (
                <p className="text-xs text-gray-400 py-8 text-center">No team members yet. Invite someone to get started.</p>
              )}
              {members.map((member) => {
                const u = member.userId;
                const id = u?._id || u;
                return (
                  <div key={id} className={`flex items-center justify-between py-5 group border-b last:border-0 ${divider}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${avatar}`}>
                        {u?.avatar
                          ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
                          : u?.firstName?.[0] || "?"
                        }
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${heading}`}>{u?.firstName} {u?.lastName || ""}</p>
                        <p className="text-[11px] font-medium text-gray-400">{u?.email || u?.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {member.status && member.role !== 'admin' && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${{
                          pending: darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700",
                          accepted: darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700",
                          declined: darkMode ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700",
                        }[member.status || 'pending']
                          }`}>
                          {member.status}
                        </span>
                      )}
                      {member.role === "admin" ? (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${roleBadge(member.role)}`}>
                          admin
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => dispatch(updateMemberRole({ memberId: id, role: e.target.value }))}
                          className={`text-[9px] font-black uppercase border rounded-lg px-2 py-1.5 ${darkMode ? "bg-black-200 border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-black-200"}`}
                          disabled={!canManageTeam}
                        >
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          {currentUserRole === "admin" && <option value="admin">Admin</option>}
                        </select>
                      )}
                      {member.role !== "admin" && (
                        <button onClick={() => handleRemove(id)} className="p-2 opacity-0 group-hover:opacity-100 text-red-400 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Reports Tab ───────────────────────────────────────────────── */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {["weekly", "monthly"].map((p) => (
                <button
                  key={p}
                  onClick={() => dispatch(fetchReports({ period: p }))}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${ghost}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => dispatch(generateExpenseReport({ period: "monthly" }))}
                disabled={status === "loading"}
                className="ml-auto px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary disabled:opacity-50"
              >
                + Generate
              </button>
            </div>

            {reportsStatus === "loading" && (
              <p className="text-xs text-gray-400 text-center py-8">Loading reports...</p>
            )}
            {reports.length === 0 && reportsStatus !== "loading" && (
              <p className="text-xs text-gray-400 text-center py-8">No reports yet.</p>
            )}
            {reports.map((report) => (
              <div key={report._id} className={`flex items-center justify-between p-6 rounded-3xl border ${card}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBox}`}>
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className={`text-sm font-black uppercase tracking-tight ${heading}`}>
                      {report.period} Report
                    </p>
                    <p className="text-xs font-medium text-gray-400">
                      {report.totalTasks} deliveries · ₦{(report.totalSpend || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(report.startDate).toLocaleDateString()} — {new Date(report.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => dispatch(exportReportCSV({ reportId: report._id }))}
                  className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl border active:scale-95 transition-all ${ghost}`}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  onClick={() => dispatch(exportReportPDF({ reportId: report._id }))}
                  className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl border active:scale-95 transition-all ${ghost}`}
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Schedules Tab ─────────────────────────────────────────────── */}
        {activeTab === "schedules" && (
          <div className="space-y-4">
            {!showScheduleForm ? (
              <button
                onClick={() => setShowScheduleForm(true)}
                className={`w-full flex items-center justify-center gap-4 p-10 border-2 border-dashed rounded-3xl text-xs font-black uppercase tracking-widest transition-all group hover:text-primary hover:border-primary ${darkMode ? "border-white/10 text-gray-500" : "border-gray-200 text-gray-400"
                  }`}
              >
                <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                Add Delivery Schedule
              </button>
            ) : (
              <div className={`rounded-3xl p-6 border ${card}`}>
                <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-6 text-center ${heading}`}>
                  New Delivery Schedule
                </h3>
                <form onSubmit={handleCreateSchedule} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Label (e.g. Office Supplies)"
                    value={scheduleLabel}
                    onChange={(e) => setScheduleLabel(e.target.value)}
                    className={inputCls}
                  />
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={{ colorScheme: darkMode ? "dark" : "light" }}
                      className={inputCls}
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ colorScheme: darkMode ? "dark" : "light" }}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {status === "loading" ? "Saving..." : editingSchedule ? "Update Schedule" : "Save Schedule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScheduleForm(false)}
                      className={`px-8 rounded-2xl text-[11px] font-black uppercase border ${ghost}`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {schedules.length === 0 && !showScheduleForm && (
              <p className="text-xs text-gray-400 text-center py-4">No schedules yet.</p>
            )}

            {schedules.map((s) => {
              const statusBadge = {
                pending: darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700",
                triggered: darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700",
                skipped: darkMode ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400",
                modified: darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
              }[s.status || 'pending'];

              return (
                <div key={s._id} className={`flex items-center justify-between p-6 rounded-3xl border ${card}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBox}`}>
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${heading}`}>{s.label}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${statusBadge}`}>
                        {s.status || 'pending'}
                      </span>
                      <p className="text-[11px] font-medium text-gray-400">
                        {s.scheduledAt
                          ? new Date(s.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                          : s.cronExpression}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => dispatch(deleteSchedule({ scheduleId: s._id }))}
                    className="p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}