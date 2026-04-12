// components/screens/TeamNotifyPrompt.jsx

import React, { useState } from "react";
import { useSelector, shallowEqual } from "react-redux";
import { X, Bell, BellOff, Check } from "lucide-react";

export default function TeamNotifyPrompt({ darkMode, chatId, orderData, onDismiss }) {
  const members = useSelector(s => s.business.members, shallowEqual);
  const currentUser = useSelector(s => s.auth.user);
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // don't show if no members or user is the only admin
  const notifiableMembers = members.filter(
    (m) => (m.userId?._id || m.userId) !== currentUser?._id
  );

  const toggleMember = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleNotify = async () => {
    if (selected.length === 0) { onDismiss(); return; }
    setSending(true);
    try {
      await Promise.all(
        selected.map((memberId) =>
          fetch(`${process.env.REACT_APP_API_URL}/business/notify/team-member`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              recipientId: memberId,
              title: "  New Team Delivery",
              body: `${currentUser?.firstName} just placed a delivery order. Tap to view details.`,
              data: { type: "team_order_notify", chatId },
            }),
          })
        )
      );
      setDone(true);
      setTimeout(onDismiss, 1500);
    } catch (err) {
      console.error("Notify failed:", err);
      onDismiss();
    } finally {
      setSending(false);
    }
  };

  if (notifiableMembers.length === 0) return null;

  const card = darkMode ? "bg-black-100 border-white/10" : "bg-white border-gray-100";
  const heading = darkMode ? "text-white" : "text-black-200";
  const ghost = darkMode ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200";
  const memberBg = darkMode ? "bg-black-200" : "bg-gray-50";
  const avatar = darkMode ? "bg-black-200 text-white" : "bg-gray-100 text-black-200";

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-end">
      <div className={`w-full rounded-t-3xl p-6 border-t ${card} transition-all`}>

        {/* handle */}
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-6" />

        {/* header */}
        <div className="flex items-center justify-between mb-2">
          <p className={`text-base font-bold ${heading}`}>Notify your team?</p>
          <button onClick={onDismiss} className="p-2 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Let your team know about this delivery. Select who to notify.
        </p>

        {/* done state */}
        {done ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <p className={`text-sm font-bold ${heading}`}>Team notified!</p>
          </div>
        ) : (
          <>
            {/* member list */}
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {notifiableMembers.map((member) => {
                const u = member.userId;
                const id = u?._id || u;
                const isSelected = selected.includes(id);

                return (
                  <button
                    key={id}
                    onClick={() => toggleMember(id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? darkMode
                          ? "border-white/30 bg-white/5"
                          : "border-black-200/30 bg-black-200/5"
                        : `${memberBg} border-transparent`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${avatar}`}>
                        {u?.avatar
                          ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-xl" />
                          : u?.firstName?.[0] || "?"
                        }
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${heading}`}>
                          {u?.firstName} {u?.lastName || ""}
                        </p>
                        <p className="text-[11px] text-gray-400">{member.role}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? darkMode ? "border-white bg-white" : "border-black-200 bg-black-200"
                        : darkMode ? "border-white/20" : "border-gray-300"
                    }`}>
                      {isSelected && (
                        <Check className={`w-3 h-3 ${darkMode ? "text-black-200" : "text-white"}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* actions */}
            <div className="flex gap-3">
              <button
                onClick={handleNotify}
                disabled={sending}
                className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
              >
                <Bell className="w-3.5 h-3.5" />
                {sending ? "Sending..." : selected.length > 0 ? `Notify ${selected.length}` : "Notify"}
              </button>
              <button
                onClick={onDismiss}
                className={`px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest border flex items-center gap-2 ${ghost}`}
              >
                <BellOff className="w-3.5 h-3.5" /> Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}