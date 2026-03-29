import React from "react";
import { Users, } from "lucide-react";

export default function TeamMemberBanner({ darkMode, membership, onViewTeam }) {
  const card = darkMode ? "bg-primary/10 border-primary/30" : "bg-primary/5 border-primary/20";
  const heading = darkMode ? "text-white" : "text-black-200";

  return (
    <div onClick={onViewTeam}
     className={`rounded-3xl p-6 border-2 ${card}`}>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className={`text-sm font-black ${heading}`}>Team Member</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            {membership?.role}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        You're part of a business team. Your orders and tasks are tracked under the business account.
      </p>
      <p className="text-sm text-primary cursor-pointer font-black uppercase tracking-widest mt-3">
        View team →
      </p>
    </div>
  );
}