import React from "react";
import { X, Reply, FileText, Video, Music } from "lucide-react";

export default function InputReplyPreview({ message, onCancel, darkMode, userName }) {
  if (!message) return null;

  const getReplyContent = () => {
    // Image
    if ((message.type === "image" || message.type === "media") && message.fileUrl) {
      return (
        <div className="flex items-center gap-2">
          <img 
            src={message.fileUrl} 
            alt="Reply preview" 
            className="w-10 h-10 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Photo</p>
            {message.fileName && (
              <p className="text-xs opacity-70 truncate">{message.fileName}</p>
            )}
          </div>
        </div>
      );
    }

    // Video
    if (message.type === "video" && message.fileUrl) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Video className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Video</p>
            {message.fileName && (
              <p className="text-xs opacity-70 truncate">{message.fileName}</p>
            )}
          </div>
        </div>
      );
    }

    // Audio
    if ((message.type === "audio" || message.fileType === "voice_note") && (message.audioUrl || message.fileUrl)) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Music className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Voice message</p>
          </div>
        </div>
      );
    }

    // File/Document
    if ((message.type === "file" || message.type === "document") && message.fileUrl) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Document</p>
            {message.fileName && (
              <p className="text-xs opacity-70 truncate">{message.fileName}</p>
            )}
          </div>
        </div>
      );
    }

    // Text message (default)
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
        {message.text || "Message"}
      </p>
    );
  };

  // Determine who we're replying to
  const getReplyToText = () => {
    if (message.from === "me") {
      return "yourself";
    } else if (userName) {
      return userName;
    } else {
      return "them";
    }
  };

  return (
    <div className={`mx-auto max-w-3xl absolute left-5 right-5 bottom-20 px-9`}>
      <div className={`flex items-center gap-3 p-3 rounded-t-2xl shadow-lg ${
        darkMode ? "bg-black-100" : "bg-white"
      }`}>
        <div className="flex-1 border-l-4 border-primary pl-3">
          <div className="flex items-center gap-1 mb-1">
            <Reply className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium text-primary">
              Replying to {getReplyToText()}
            </span>
          </div>
          {getReplyContent()}
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