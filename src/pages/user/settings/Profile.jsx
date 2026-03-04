// user/profile
import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Camera, Mail, Phone, User, Shield, KeyRound, ChevronRight } from "lucide-react";
import { updateProfile } from "../../../Redux/userSlice";
import { updateUser } from "../../../Redux/authSlice";
import { setPin, resetPin, forgotPin } from "../../../Redux/pinSlice";
import { PinPad } from "../../../components/common/PinPad";

export default function Profile({ darkMode }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { isPinSet } = useSelector((s) => s.pin);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const [pinMode, setPinMode]               = useState(null); // null | 'set' | 'reset_current' | 'reset_new' | 'forgot'
  const [collectedCurrentPin, setCollectedCurrentPin] = useState('');
  const [pinSaveError, setPinSaveError]     = useState(null);
  const [pinSuccess, setPinSuccess]         = useState(null);

  const hasPinSet = user?.pin !== undefined || isPinSet;

  const card    = darkMode ? "bg-black-200 border-white/10" : "bg-gray-50 border-gray-100";
  const heading = darkMode ? "text-white" : "text-black-200";
  const label   = "text-[10px] font-bold uppercase tracking-widest text-gray-400";
  const value   = `text-sm font-semibold ${heading}`;
  const fieldRow = `flex items-center gap-4 p-4 rounded-2xl border ${card}`;

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await dispatch(updateProfile(formData)).unwrap();
      if (result?.data?.user) dispatch(updateUser(result.data.user));
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Avatar */}
      <div className="flex flex-col items-center py-4">
        <div className="relative">
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-2xl font-black overflow-hidden ${darkMode ? "bg-black-200 text-white" : "bg-gray-100 text-black-200"}`}>
            {user?.avatar
              ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
              : `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`
            }
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg active:scale-90 transition-all"
          >
            {uploading
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera className="w-4 h-4 text-white" />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <p className={`mt-4 text-xl font-black ${heading}`}>
          {user?.firstName} {user?.lastName}
        </p>
        <span className={`mt-1 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg ${
          user?.accountType === "business"
            ? "bg-primary/10 text-primary"
            : darkMode ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"
        }`}>
          {user?.accountType === "business" ? "Business Account" : "Personal Account"}
        </span>
      </div>

      {/* Info Fields */}
      <div className="space-y-2">
        <div className={fieldRow}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-black-100" : "bg-white"}`}>
            <User className="h-4 w-4 text-gray-400" />
          </div>
          <div>
            <p className={label}>Full Name</p>
            <p className={value}>{user?.firstName} {user?.lastName}</p>
          </div>
        </div>

        <div className={fieldRow}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-black-100" : "bg-white"}`}>
            <Mail className="h-4 w-4 text-gray-400" />
          </div>
          <div>
            <p className={label}>Email</p>
            <p className={value}>{user?.email || "—"}</p>
          </div>
        </div>

        <div className={fieldRow}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${darkMode ? "bg-black-100" : "bg-white"}`}>
            <Phone className="h-4 w-4 text-gray-400" />
          </div>
          <div>
            <p className={label}>Phone</p>
            <p className={value}>{user?.phone || "—"}</p>
          </div>
        </div>

        <p className="text-primary text-xs">
          To change any information, contact <a href="mailto:sendrey@support.com">sendrey@support.com</a>
        </p>
      </div>

      {/* ── Security / PIN ───────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
          Security
        </p>

        {pinSuccess && (
          <div className="p-3 rounded-xl bg-green-500/10 text-green-500 text-xs text-center font-medium">
            {pinSuccess}
          </div>
        )}
        {pinSaveError && (
          <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-xs text-center">
            {pinSaveError}
          </div>
        )}

        {!hasPinSet ? (
          // ── No PIN yet ────────────────────────────────────────────────────
          <button
            onClick={() => { setPinMode('set'); setPinSaveError(null); setPinSuccess(null); }}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border ${card}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className={`text-sm font-semibold ${heading}`}>Set Transaction PIN</p>
                <p className="text-xs text-gray-400 mt-0.5">Required for payments & transfers</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ) : (
          // ── PIN already set ───────────────────────────────────────────────
          <div className="space-y-2">
            <button
              onClick={() => { setPinMode('reset_current'); setPinSaveError(null); setPinSuccess(null); }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border ${card}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${heading}`}>Change PIN</p>
                  <p className="text-xs text-gray-400 mt-0.5">Enter current PIN then set new one</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => { setPinMode('forgot'); setPinSaveError(null); setPinSuccess(null); }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border ${card}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${heading}`}>Forgot PIN</p>
                  <p className="text-xs text-gray-400 mt-0.5">Reset via identity verification</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* ── PIN Modals ────────────────────────────────────────────────────────── */}

      {/* Set PIN */}
      {pinMode === 'set' && (
        <PinPad
          dark={darkMode}
          title="Set Transaction PIN"
          subtitle="Choose a 4-digit PIN for payments"
          skipVerify
          onPin={async (pin) => {
            try {
              await dispatch(setPin({ pin })).unwrap();
              setPinMode(null);
              setPinSuccess('PIN set successfully');
            } catch (err) {
              setPinSaveError(err || 'Failed to set PIN');
              setPinMode(null);
            }
          }}
          onCancel={() => setPinMode(null)}
        />
      )}

      {/* Reset PIN — step 1: verify current */}
      {pinMode === 'reset_current' && (
        <PinPad
          dark={darkMode}
          title="Current PIN"
          subtitle="Enter your current PIN to continue"
          skipVerify
          onPin={(pin) => {
            setCollectedCurrentPin(pin);
            setPinMode('reset_new');
          }}
          onCancel={() => setPinMode(null)}
        />
      )}

      {/* Reset PIN — step 2: new PIN */}
      {pinMode === 'reset_new' && (
        <PinPad
          dark={darkMode}
          title="New PIN"
          subtitle="Choose your new 4-digit PIN"
          skipVerify
          onPin={async (newPin) => {
            try {
              await dispatch(resetPin({ currentPin: collectedCurrentPin, newPin })).unwrap();
              setPinMode(null);
              setCollectedCurrentPin('');
              setPinSuccess('PIN updated successfully');
            } catch (err) {
              setPinSaveError(err || 'Failed to update PIN. Check your current PIN.');
              setPinMode(null);
              setCollectedCurrentPin('');
            }
          }}
          onCancel={() => { setPinMode(null); setCollectedCurrentPin(''); }}
        />
      )}

      {/* Forgot PIN */}
      {pinMode === 'forgot' && (
        <PinPad
          dark={darkMode}
          title="Reset PIN"
          subtitle="Set your new 4-digit PIN"
          skipVerify
          onPin={async (newPin) => {
            try {
              await dispatch(forgotPin({ newPin, confirmPin: newPin })).unwrap();
              setPinMode(null);
              setPinSuccess('PIN reset successfully');
            } catch (err) {
              setPinSaveError(err || 'Failed to reset PIN');
              setPinMode(null);
            }
          }}
          onCancel={() => setPinMode(null)}
        />
      )}

    </div>
  );
}