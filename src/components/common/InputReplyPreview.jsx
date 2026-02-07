// InputReplyPreview.jsx
import React from "react";
import { X, Reply } from "lucide-react";

export default function InputReplyPreview({ message, onCancel, darkMode }) {
  if (!message) return null;

  return (
    <div className={`mx-auto max-w-3xl absolute left-5 right-5 bottom-24 px-9`}>
      <div className={`flex items-center gap-3 p-3 rounded-t-2xl shadow-lg ${
        darkMode ? "bg-black-100" : "bg-white"
      }`}>
        <div className="flex-1 border-l-4 border-primary pl-3">
          <div className="flex items-center gap-1 mb-1">
            <Reply className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium text-primary">
              Replying to {message.from === "me" ? "yourself" : "Runner"}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
            {message.text || message.fileName || "Media"}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}