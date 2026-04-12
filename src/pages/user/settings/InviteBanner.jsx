import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Users, Check, X } from "lucide-react";
import api from "../../../utils/api";
import { updateUser } from "../../../Redux/authSlice";

export default function InviteBanner({ darkMode, invite }) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(null); // 'accepted' | 'declined'
  const [done, setDone] = useState(null);

  const handleRespond = async (response) => {
    setLoading(response);
    try {
      await api.post('/business/invite/respond', { response });
      setDone(response);
      // clear invite from local user state
      dispatch(updateUser({ pendingBusinessInvite: null,
        teamMembership: response === 'accepted' ? { status: 'accepted' } : null
      }));
    } catch (err) {
      alert(`Failed: ${err?.response?.data?.message || err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
  const heading = darkMode ? "text-white" : "text-black-200";

  if (done) return (
    <div className={`rounded-3xl p-6 border ${card} text-center`}>
      <p className={`text-sm font-bold ${done === 'accepted' ? 'text-green-500' : 'text-gray-400'}`}>
        {done === 'accepted' ? '🎉 You joined the team!' : 'Invite declined.'}
      </p>
    </div>
  );

  return (
    <div className={`rounded-3xl p-6 border-2 border-primary/30 relative ${darkMode ? "bg-primary/10" : "bg-primary/5"}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className={`text-sm font-black ${heading}`}>Team Invitation</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{invite.role}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-5 leading-relaxed">
        <span className={`font-bold ${heading}`}>{invite.inviterName}</span> invited you to join{" "}
        <span className={`font-bold ${heading}`}>{invite.businessName}</span> as a {invite.role}.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => handleRespond('accepted')}
          disabled={!!loading}
          className="flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
        >
          <Check className="w-3.5 h-3.5" />
          {loading === 'accepted' ? 'Joining...' : 'Accept'}
        </button>
        <button
          onClick={() => handleRespond('declined')}
          disabled={!!loading}
          className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all ${darkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"}`}
        >
          <X className="w-3.5 h-3.5" />
          {loading === 'declined' ? 'Declining...' : 'Decline'}
        </button>
      </div>
    </div>
  );
}