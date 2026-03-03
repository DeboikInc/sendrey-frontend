import React, { useState } from "react";
import { IconButton, Tooltip } from "@material-tailwind/react";
import { ChevronLeft, Moon, Sun, MoreHorizontal, Building2, ArrowRight, CreditCard, User, X, CheckCircle2 } from "lucide-react";
import Logo from "../../assets/Sendrey-Logo-Variants-09.png";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { convertToBusiness } from "../../Redux/businessSlice";
import { updateUser } from "../../Redux/authSlice";

// ── Upgrade Modal ─────────────────────────────────────────────────────────────

const UpgradeModal = ({ onClose, darkMode }) => {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.business);
  const [bizName, setBizName] = useState("");
  const [done, setDone] = useState(false);
  const user = useSelector((s) => s.auth);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    dispatch(convertToBusiness({ userId: user.id, businessName: bizName.trim() }))
      .unwrap()
      .then(() => {
        dispatch(updateUser({
          accountType: "business",
          businessProfile: {
            businessName: bizName.trim(),
            convertedAt: new Date().toISOString(),
            members: [],
            scheduledConversations: [],
          },
        }));
        setDone(true);
      });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
        <div className={`rounded-3xl shadow-2xl w-full max-w-sm p-6 ${darkMode ? "bg-gray-900" : "bg-white"}`}>
          {done ? (
            <div className="text-center py-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? "bg-green-900/30" : "bg-green-100"}`}>
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h3 className={`text-lg font-bold mb-1 ${darkMode ? "text-white" : "text-gray-900"}`}>
                You're now a business!
              </h3>
              <p className={`text-sm mb-5 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Access your dashboard from the business icon on any screen.
              </p>
              <button
                onClick={onClose}
                className={`w-full rounded-2xl py-3 text-sm font-semibold ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                    Upgrade to Business
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Free — takes 10 seconds</p>
                </div>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full transition ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                {["Team management", "Expense reports", "Scheduled deliveries"].map((f) => (
                  <span
                    key={f}
                    className={`text-xs px-3 py-1.5 rounded-full ${darkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"}`}
                  >
                    {f}
                  </span>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Your business name"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  autoFocus
                  className={`w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
                    darkMode
                      ? "border-gray-700 bg-gray-800 text-white focus:ring-white"
                      : "border-gray-200 bg-white text-gray-900 focus:ring-black"
                  }`}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={status === "loading" || !bizName.trim()}
                  className={`w-full rounded-2xl py-3 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 ${
                    darkMode ? "bg-white text-black" : "bg-black text-white"
                  }`}
                >
                  {status === "loading" ? "Activating..." : "Activate Business Account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ── Settings Pull-up Sheet ────────────────────────────────────────────────────

const SettingsPullUp = ({ onClose, darkMode }) => {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const isBusiness = user?.accountType === "business";
  const [showUpgrade, setShowUpgrade] = useState(false);

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  const handleAction = (fn) => { onClose(); fn(); };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9990]" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[9991] flex justify-center">
        <div className={`w-full max-w-lg rounded-t-3xl shadow-2xl px-4 pt-3 pb-8 animate-slide-up ${darkMode ? "bg-gray-900" : "bg-white"}`}>

          {/* drag handle */}
          <div className={`w-10 h-1 rounded-full mx-auto mb-5 ${darkMode ? "bg-gray-700" : "bg-gray-200"}`} />

          {/* profile row */}
          <div className="flex items-center gap-3 mb-5 px-1">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${darkMode ? "bg-white text-black" : "bg-gray-900 text-white"}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className={`font-semibold text-sm truncate ${darkMode ? "text-white" : "text-gray-900"}`}>
                {user?.firstName} {user?.lastName || ""}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email || user?.phone}</p>
            </div>
            <button
              onClick={onClose}
              className={`ml-auto p-2 rounded-full transition ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="flex flex-col gap-3">

            {/* Upgrade / Business Dashboard */}
            <button
              onClick={() => isBusiness ? handleAction(() => navigate("/business/settings")) : setShowUpgrade(true)}
              className={`w-full flex items-center justify-between rounded-2xl px-5 py-4 hover:opacity-90 transition ${
                darkMode ? "bg-white text-black" : "bg-gray-900 text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5" />
                <div className="text-left">
                  <p className="text-sm font-semibold">
                    {isBusiness ? "Business Dashboard" : "Upgrade to Business"}
                  </p>
                  <p className="text-xs opacity-60 mt-0.5">
                    {isBusiness ? "Manage team, reports & schedules" : "Team access, reports & scheduled deliveries"}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 opacity-60" />
            </button>

            {/* Wallet */}
            <button
              onClick={() => handleAction(() => navigate("/wallet"))}
              className={`w-full flex items-center justify-between border rounded-2xl px-5 py-4 transition ${
                darkMode
                  ? "bg-black border-gray-900 text-white hover:bg-gray-700"
                  : "bg-gray-400 border-gray-200 text-white hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${darkMode ? "bg-gray-900" : "bg-white"}`}>
                  <CreditCard className={`h-4 w-4 ${darkMode ? "text-gray-300" : "text-gray-600"}`} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Wallet & Payments</p>
                  <p className="text-xs text-gray-400 mt-0.5">Balance, cards, payouts</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>

            {/* Profile */}
            <button
              onClick={() => handleAction(() => navigate("/profile"))}
              className={`w-full flex items-center justify-between border rounded-2xl px-5 py-4 transition ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                  : "bg-gray-50 border-gray-100 text-gray-900 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${darkMode ? "bg-gray-900" : "bg-white"}`}>
                  <User className={`h-4 w-4 ${darkMode ? "text-gray-300" : "text-gray-600"}`} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Edit Profile</p>
                  <p className="text-xs text-gray-400 mt-0.5">Name, photo, bio</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>

          </div>
        </div>
      </div>

      {showUpgrade && <UpgradeModal darkMode={darkMode} onClose={() => setShowUpgrade(false)} />}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1) both; }
      `}</style>
    </>
  );
};

// ── Header ────────────────────────────────────────────────────────────────────

export default function Header({ title, showBack, darkMode, toggleDarkMode, rightActions, backTo, onBack }) {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const isBusiness = user?.accountType === "business";
  const [showSettings, setShowSettings] = useState(false);

  const HeaderIcon = ({ children, tooltip, onClick }) => (
    <Tooltip content={tooltip} placement="bottom" className="text-xs">
      <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );

  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
    else navigate(-1);
  };

  return (
    <>
      <div className={`px-4 py-3 border-b flex items-center justify-between backdrop-blur-xl ${
        darkMode ? "border-white/10 bg-gray-950" : "border-gray-200 bg-white"
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <IconButton variant="text" className="rounded-full" onClick={handleBack}>
              <ChevronLeft className={`h-5 w-5 ${darkMode ? "text-gray-300" : "text-gray-700"}`} />
            </IconButton>
          )}
          <div className="truncate">
            <div className={`font-bold text-[16px] truncate ${darkMode ? "text-white" : "text-gray-800"}`}>
              {title && showBack ? title : <img src={Logo} alt="Logo" width={140} height={140} />}
            </div>
          </div>
        </div>

        {isBusiness && (
          <HeaderIcon tooltip="Business Dashboard" onClick={() => navigate("/business/settings")}>
            <Building2 className={`h-5 w-5 ${darkMode ? "text-gray-300" : "text-gray-700"}`} />
          </HeaderIcon>
        )}

        <div className="flex items-center gap-2">
          {rightActions}
          <HeaderIcon tooltip="More" onClick={() => setShowSettings(true)}>
            <MoreHorizontal className={`h-5 w-5 ${darkMode ? "text-gray-300" : "text-gray-700"}`} />
          </HeaderIcon>
          <IconButton variant="text" size="sm" onClick={toggleDarkMode}>
            {darkMode
              ? <Sun className="h-5 w-5 text-gray-300" />
              : <Moon className="h-5 w-5 text-gray-700" />
            }
          </IconButton>
        </div>
      </div>

      {showSettings && <SettingsPullUp darkMode={darkMode} onClose={() => setShowSettings(false)} />}
    </>
  );
}