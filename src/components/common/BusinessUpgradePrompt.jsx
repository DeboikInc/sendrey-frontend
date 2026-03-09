import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, CheckCircle2, AlertTriangle, Building2, Sparkles } from "lucide-react";
import { convertToBusiness } from "../../Redux/businessSlice";
import { updateUser } from "../../Redux/authSlice";

const UpgradeModal = ({ onClose, dark }) => {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.business);
  const { user } = useSelector((s) => s.auth);
  
  const [bizName, setBizName] = useState("");
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Styling Tokens
  const overlayBg = dark ? "rgba(0, 0, 0, 0.8)" : "rgba(241, 245, 249, 0.7)";
  const cardBg = dark ? "rgba(20, 20, 20, 0.6)" : "rgba(255, 255, 255, 0.8)";
  const inputBg = dark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  const accentOrange = "#c2410c"; // Dark Orange Margin/Accent

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bizName.trim()) return;
    setLocalError(null);

    try {
      // Logic wrapped in try-catch to avoid Error Page crashes
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
      setLocalError(err?.message || "Failed to activate business profile.");
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop with Heavy Blur */}
      <div 
        className="absolute inset-0 backdrop-blur-xl transition-all duration-500" 
        style={{ background: overlayBg }}
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div 
        className="relative w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300"
        style={{ background: cardBg }}
      >
        <div className="p-8">
          {done ? (
            <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mx-auto mb-6 shadow-xl">
                <CheckCircle2 className="h-10 w-10 text-black" />
              </div>
              <h3 className="text-2xl font-black mb-2 dark:text-white text-black">Welcome, Partner.</h3>
              <p className="text-xs font-medium opacity-50 mb-10 dark:text-white text-black uppercase tracking-widest">Business Mode Active</p>
              <button 
                onClick={onClose} 
                className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-black text-white dark:bg-white dark:text-black active:scale-95 transition-all"
              >
                Enter Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Header with Dark Orange Margin Line */}
              <div className="flex justify-between items-start mb-10 border-l-4 pl-4" style={{ borderColor: accentOrange }}>
                <div>
                  <h3 className="text-xl font-black dark:text-white text-black flex items-center gap-2">
                    Upgrade <Sparkles className="h-4 w-4" style={{ color: accentOrange }} />
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 dark:text-white text-black">Premium Integration</p>
                </div>
                <button onClick={onClose} className="p-2 opacity-30 hover:opacity-100 transition-opacity dark:text-white text-black">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {localError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in shake-1">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-[10px] font-bold text-red-500 uppercase leading-tight">{localError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] px-1 opacity-40 dark:text-white text-black">
                    Official Business Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Blackwood Logistics"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="w-full rounded-2xl px-6 py-5 text-sm font-bold focus:outline-none backdrop-blur-md transition-all dark:text-white text-black border border-transparent focus:border-white/20"
                    style={{ background: inputBg }}
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={status === "loading" || !bizName.trim()}
                    className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all disabled:opacity-20 shadow-xl"
                    style={{ background: dark ? "#ffffff" : "#000000", color: dark ? "#000000" : "#ffffff" }}
                  >
                    {status === "loading" ? "Initializing..." : "Activate Business"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;