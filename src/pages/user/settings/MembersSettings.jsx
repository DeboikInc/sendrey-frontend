import React, { useEffect } from "react";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import {
  ChevronLeft, Users, FileText, Clock, Download,
  Calendar, Shield
} from "lucide-react";
import {
  fetchTeamMembers, fetchReports, fetchSchedules
} from "../../../Redux/businessSlice";

export default function MemberSettings({ darkMode, onBack }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const {
    businessName, members, membersStatus,
    reports, reportsStatus, schedules, schedulesStatus,
  } = useSelector((s) => s.business, shallowEqual);

  useEffect(() => {
    if (membersStatus === "idle") dispatch(fetchTeamMembers());
    if (reportsStatus === "idle") dispatch(fetchReports({}));
    if (schedulesStatus === "idle") dispatch(fetchSchedules());
  }, [dispatch, membersStatus, reportsStatus, schedulesStatus]);

  useEffect(() => {
    dispatch(fetchTeamMembers());
    dispatch(fetchReports({}));
    dispatch(fetchSchedules());
  }, [dispatch]);

  // ── style helpers ─────────────────────────────────────────────────────────
  const page = darkMode ? "bg-black-100" : "bg-gray-50";
  const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
  const heading = darkMode ? "text-white" : "text-black-200";
  const ghost = darkMode ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200";
  const divider = darkMode ? "border-white/5" : "border-gray-50";
  const avatar = darkMode ? "bg-black-200 text-white" : "bg-gray-100 text-black-200";
  const iconBox = darkMode ? "bg-black-200" : "bg-gray-100";

  const myRole = user?.teamMembership?.role || 'staff';

  const roleBadge = (role) => ({
    admin: darkMode ? "bg-white text-black-200" : "bg-black-200 text-white",
    manager: darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
    staff: darkMode ? "bg-white/5 text-gray-400 border border-white/10" : "bg-gray-100 text-gray-500",
  }[role] || (darkMode ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"));

  const handleExportCSV = (reportId) =>
    window.open(`${process.env.REACT_APP_API_URL}/business/reports/${reportId}/export/csv`, "_blank");

  const handleExportPDF = (reportId) =>
    window.open(`${process.env.REACT_APP_API_URL}/business/reports/${reportId}/export/pdf`, "_blank");

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
            {businessName || "Business"}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            Member Access
          </p>
        </div>

        {/* Role badge */}
        <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${roleBadge(myRole)}`}>
          {myRole}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto marketSelection px-4 py-4 space-y-4">

        {/* ── My Access Banner ─────────────────────────────────────────── */}
        <div className={`rounded-3xl p-5 border flex items-center gap-4 ${card}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBox}`}>
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className={`text-sm font-bold ${heading}`}>You're a team member</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Role: <span className="font-semibold capitalize">{myRole}</span>
            </p>
          </div>
        </div>

        {/* ── Team Directory ────────────────────────────────────────────── */}
        <div className={`rounded-3xl p-6 border ${card}`}>
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Team</p>
          </div>

          {membersStatus === "loading" && (
            <p className="text-xs text-gray-400 py-4 text-center">Loading...</p>
          )}
          {members.length === 0 && membersStatus !== "loading" && (
            <p className="text-xs text-gray-400 py-6 text-center">No team members found.</p>
          )}

          <div className="space-y-1">
            {members.map((member) => {
              const u = member.userId;
              const id = u?._id || u;
              const isMe = id === user?._id;
              return (
                <div key={id} className={`flex items-center justify-between py-4 border-b last:border-0 ${divider}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${isMe ? 'bg-primary/20 text-primary' : avatar}`}>
                      {u?.avatar
                        ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
                        : u?.firstName?.[0] || "?"
                      }
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${heading}`}>
                        {u?.firstName} {u?.lastName || ""}
                        {isMe && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-primary">You</span>}
                      </p>
                      <p className="text-[11px] font-medium text-gray-400">{u?.email || u?.phone}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${roleBadge(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Reports ───────────────────────────────────────────────────── */}
        <div className={`rounded-3xl p-6 border ${card}`}>
          <div className="flex items-center gap-2 mb-5">
            <FileText className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Reports</p>
          </div>

          <div className="flex gap-2 mb-4">
            {["weekly", "monthly"].map((p) => (
              <button
                key={p}
                onClick={() => dispatch(fetchReports({ period: p }))}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${ghost}`}
              >
                {p}
              </button>
            ))}
          </div>

          {reportsStatus === "loading" && (
            <p className="text-xs text-gray-400 text-center py-6">Loading reports...</p>
          )}
          {reports.length === 0 && reportsStatus !== "loading" && (
            <p className="text-xs text-gray-400 text-center py-6">No reports yet.</p>
          )}

          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report._id} className={`flex items-center justify-between p-4 rounded-2xl border ${darkMode ? "bg-black-200 border-white/5" : "bg-gray-50 border-gray-100"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBox}`}>
                    <FileText className="h-4 w-4 text-gray-400" />
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
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportCSV(report._id)}
                    className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border active:scale-95 transition-all ${ghost}`}
                  >
                    <Download className="h-3 w-3" /> CSV
                  </button>
                  <button
                    onClick={() => handleExportPDF(report._id)}
                    className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border active:scale-95 transition-all ${ghost}`}
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Schedules ─────────────────────────────────────────────────── */}
        <div className={`rounded-3xl p-6 border ${card}`}>
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Schedules</p>
          </div>

          {schedules.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">No scheduled deliveries.</p>
          )}

          <div className="space-y-3">
            {schedules.map((s) => {
              const statusBadge = {
                pending: darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700",
                triggered: darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700",
                skipped: darkMode ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400",
                modified: darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700",
              }[s.status || 'pending'];

              return (
                <div key={s._id} className={`flex items-center gap-4 p-4 rounded-2xl border ${darkMode ? "bg-black-200 border-white/5" : "bg-gray-50 border-gray-100"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBox}`}>
                    <Calendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${heading}`}>{s.label}</p>
                    <p className="text-[11px] font-medium text-gray-400 mt-0.5">
                      {s.scheduledAt
                        ? new Date(s.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                        : s.cronExpression}
                    </p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${statusBadge}`}>
                    {s.status || 'pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}