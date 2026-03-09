import React, { useState, useEffect } from "react";
import { IconButton, Tooltip } from "@material-tailwind/react";
import { 
  ChevronLeft, Moon, Sun, MoreHorizontal, Building2, 
  ArrowRight, CreditCard, User, X, CheckCircle2, AlertTriangle 
} from "lucide-react";
import Logo from "../../assets/Sendrey-Logo-Variants-09.png";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { convertToBusiness, clearBusinessError } from "../../Redux/businessSlice";
import { updateUser } from "../../Redux/authSlice";

// ── Theme Tokens (Sleek Black) ────────────────────────────────────────
const getPopupTheme = (dark) => ({
  overlay: dark ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.4)",
  card: dark 
    ? { background: "#000000", border: "1px solid rgba(255, 255, 255, 0.15)" } 
    : { background: "#ffffff", border: "1px solid #e5e7eb" },
  textMain: dark ? "#ffffff" : "#000000",
  textSub: dark ? "#a1a1aa" : "#6b7280",
  primaryBtn: {
    background: dark ? "#ffffff" : "#000000",
    color: dark ? "#000000" : "#ffffff"
  },
  secondaryBtn: dark
    ? { background: "rgba(255, 255, 255, 0.1)", color: "#ffffff" }
    : { background: "#f1f5f9", color: "#000000" },
  input: dark
    ? { background: "#111111", border: "1px solid #333333", color: "#ffffff" }
    : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#000000" }
});

// ── Upgrade Modal with Error Handling ────────────────────────────────
const UpgradeModal = ({ onClose, dark }) => {
  const t = getPopupTheme(dark);
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.business);
  const user = useSelector((s) => s.auth);
  const [bizName, setBizName] = useState("");
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    setLocalError(null);

    try {
      // .unwrap() allows the try-catch to intercept Redux failures
      await dispatch(convertToBusiness({ 
        userId: user.id, 
        businessName: bizName.trim() 
      })).unwrap();

      await dispatch(updateUser({
        accountType: "business",
        businessProfile: { businessName: bizName.trim() }
      }));
      
      setDone(true);
    } catch (err) {
      // This prevents the "Error Page" by catching the failure here
      setLocalError(err?.message || "Activation failed. Please try again.");
      console.error("Business Upgrade Error:", err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[10000] backdrop-blur-md" style={{ background: t.overlay }} onClick={onClose} />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        <div style={t.card} className="w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          {done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-black dark:bg-white flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-white dark:text-black" />
              </div>
              <h3 className="text-xl font-bold mb-8" style={{ color: t.textMain }}>Business Active</h3>
              <button onClick={onClose} style={t.primaryBtn} className="w-full rounded-2xl py-4 font-bold uppercase tracking-widest text-xs">
                Continue
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-bold" style={{ color: t.textMain }}>Upgrade</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.textSub }}>Business Conversion</p>
                </div>
                <button onClick={onClose} className="p-2 opacity-50 hover:opacity-100 transition"><X /></button>
              </div>

              {localError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-[11px] font-bold text-red-500 uppercase leading-tight">{localError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: t.textSub }}>Business Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    style={t.input}
                    className="w-full rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading" || !bizName.trim()}
                  style={t.primaryBtn}
                  className="w-full rounded-2xl py-4 font-bold uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-30"
                >
                  {status === "loading" ? "Activating..." : "Activate Business"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ── Settings Pull-up ──────────────────────────────────────────────────
const SettingsPullUp = ({ onClose, dark }) => {
  const t = getPopupTheme(dark);
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const isBusiness = user?.accountType === "business";
  const [showUpgrade, setShowUpgrade] = useState(false);

  const initials = user?.firstName ? `${user.firstName[0]}${user.lastName?.[0] || ""}`.toUpperCase() : "?";

  // Navigation Error Handler
  const handleNav = (path) => {
    try {
      onClose();
      navigate(path);
    } catch (err) {
      console.error("Navigation error:", err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[9990] backdrop-blur-sm" style={{ background: t.overlay }} onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[9991] flex justify-center p-4">
        <div style={t.card} className="w-full max-lg rounded-[2.5rem] shadow-2xl px-6 pt-3 pb-10 animate-slide-up">
          <div className="w-12 h-1 rounded-full bg-gray-300 dark:bg-white/20 mx-auto mb-8 opacity-40" />

          <div className="flex items-center gap-4 mb-8 px-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg" style={t.secondaryBtn}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg" style={{ color: t.textMain }}>{user?.firstName} {user?.lastName || ""}</p>
              <p className="text-xs font-medium" style={{ color: t.textSub }}>{user?.email || user?.phone}</p>
            </div>
            <button onClick={onClose} className="p-2 opacity-40 hover:opacity-100 transition"><X className="h-5 w-5"/></button>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => isBusiness ? handleNav("/business/settings") : setShowUpgrade(true)}
              style={t.primaryBtn}
              className="w-full flex items-center justify-between rounded-2xl px-6 py-5 transition-all active:scale-[0.98] shadow-xl shadow-black/10"
            >
              <div className="flex items-center gap-4">
                <Building2 className="h-6 w-6" />
                <div className="text-left">
                  <p className="text-sm font-bold uppercase tracking-tight">{isBusiness ? "Business Dashboard" : "Upgrade to Business"}</p>
                  <p className="text-[11px] opacity-70 font-medium">Manage team & schedules</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 opacity-40" />
            </button>

            {[{ label: "Wallet & Payments", icon: CreditCard, path: "/wallet" }, { label: "Edit Profile", icon: User, path: "/profile" }].map((item, i) => (
              <button 
                key={i} 
                onClick={() => handleNav(item.path)} 
                style={t.secondaryBtn} 
                className="w-full flex items-center justify-between rounded-2xl px-6 py-4 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <item.icon className="h-5 w-5 opacity-70" />
                  <p className="text-sm font-bold">{item.label}</p>
                </div>
                <ArrowRight className="h-4 w-4 opacity-20" />
              </button>
            ))}
          </div>
        </div>
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} dark={dark} />}
      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>
    </>
  );
};

// ── Main Header ───────────────────────────────────────────────────────
export default function Header({ title, showBack, darkMode, toggleDarkMode, rightActions, backTo, onBack }) {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const isBusiness = user?.accountType === "business";
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="px-4 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between dark:bg-black bg-white sticky top-0 z-[100]">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <IconButton variant="text" className="rounded-full" onClick={() => navigate(backTo || -1)}>
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
          )}
          <div className="truncate">
            <div className="font-bold text-[16px] truncate text-gray-800 dark:text-white">
              {title && showBack ? title : <img src={Logo} alt="Logo" width={140} height={140} />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isBusiness && (
            <Tooltip content="Business Dashboard">
              <IconButton variant="text" size="sm" className="rounded-full" onClick={() => navigate("/business/settings")}>
                <Building2 className="h-5 w-5" />
              </IconButton>
            </Tooltip>
          )}
          <div className="flex items-center gap-1">
            {rightActions}
            <IconButton variant="text" size="sm" className="rounded-full" onClick={() => setShowSettings(true)}>
              <MoreHorizontal className="h-5 w-5" />
            </IconButton>
            <IconButton variant="text" size="sm" onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-5 w-5 text-white" /> : <Moon className="h-5 w-5 text-black" />}
            </IconButton>
          </div>
        </div>
      </div>

      {showSettings && <SettingsPullUp onClose={() => setShowSettings(false)} dark={darkMode} />}
    </>
  );
}