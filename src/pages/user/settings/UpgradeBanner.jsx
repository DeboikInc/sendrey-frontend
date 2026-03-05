import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Building2, X } from "lucide-react";
import {
  acknowledgeSuggestion,
  convertToBusiness,
  fetchTeamMembers,
  fetchReports,
} from "../../../Redux/businessSlice";
import { updateUser } from "../../../Redux/authSlice";

export default function UpgradeBanner({ darkMode }) {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.business);
  const [showModal, setShowModal] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState(null);

  const handleUpgrade = () => {
    dispatch(acknowledgeSuggestion());
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!businessName.trim()) return;
    setError(null);
    try {
      const result = await dispatch(convertToBusiness({ businessName: businessName.trim() })).unwrap();
      const user = result?.data?.user;
      if (user) dispatch(updateUser(user));
      dispatch(fetchTeamMembers());
      dispatch(fetchReports({}));
      setShowModal(false);
    } catch (err) {
      setError(err || "Failed to activate business account. Please try again.");
    }
  };

  return (
    <>
      {/* Banner */}
      <div className={`rounded-3xl p-6 border-2 border-primary/30 relative ${darkMode ? "bg-primary/10" : "bg-primary/5"}`}>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className={`text-sm font-black ${darkMode ? "text-white" : "text-black-200"}`}>
              Upgrade to Business
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-5 leading-relaxed">
          Unlock team access, expense reports and scheduled deliveries for your business.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleUpgrade}
            className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white active:scale-95 transition-all"
          >
            Upgrade
          </button>
        </div>
      </div>

      {/* Conversion Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div
            className="absolute inset-0"
            onClick={() => setShowModal(false)}
          />
          <div className={`relative w-full rounded-t-3xl p-6 ${darkMode ? "bg-black-100" : "bg-white"}`}>
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-6" />

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className={`text-lg font-black ${darkMode ? "text-white" : "text-black-200"}`}>
                  Activate Business
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  You'll be the admin
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400 my-5 leading-relaxed">
              Invite team members, track expenses and schedule recurring deliveries.
            </p>

            <input
              type="text"
              placeholder="Your business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={`w-full rounded-2xl px-5 py-4 text-sm focus:outline-none placeholder:text-gray-400 border mb-4 ${darkMode
                ? "bg-black-200 border-white/10 text-white"
                : "bg-gray-50 border-gray-200 text-black-200"
                }`}
            />

            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
                <p className="text-red-500 text-xs font-medium">{error}</p>
                <button onClick={() => setError(null)}>
                  <X className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={!businessName.trim() || status === "loading"}
                className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white active:scale-95 disabled:opacity-50 transition-all"
              >
                {status === "loading" ? "Activating..." : "Activate Business"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className={`px-6 rounded-2xl text-[11px] font-black uppercase border ${darkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
                  }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}