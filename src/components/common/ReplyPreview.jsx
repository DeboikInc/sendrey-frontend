// ReplyPreview.jsx
import React from "react";
import { Reply } from "lucide-react";

export default function ReplyPreview({ message, darkMode }) {
  if (!message) return null;

  return (
    <div className={`mb-2 p-2 rounded-lg border-l-4 ${
      message.from === "me"
        ? "bg-white/20 border-white/40"
        : "bg-gray-100 dark:bg-gray-800 border-gray-400"
    }`}>
      <div className="flex items-center gap-1 mb-1">
        <Reply className="w-3 h-3 opacity-70" />
        <span className="text-xs font-medium opacity-90">
          {message.from === "me" ? "You" : "Runner"}
        </span>
      </div>
      <p className="text-xs opacity-80 truncate">
        {message.text || message.fileName || "Media"}
      </p>
    </div>
  );
}