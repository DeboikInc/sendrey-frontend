import React from "react";
import { X, Reply, FileText, Image as ImageIcon, Video, Music } from "lucide-react";
import { motion } from "framer-motion";

export default function ReplyPreview({ message, onCancel, darkMode }) {
  if (!message) return null;

  const getReplyContent = () => {
    // Image
    if ((message.type === "image" || message.type === "media") && message.fileUrl) {
      return (
        <div className="flex items-center gap-2">
          <img 
            src={message.fileUrl} 
            alt="Reply preview" 
            className="w-12 h-12 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium opacity-90">Photo</p>
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
          <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Video className="w-6 h-6 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium opacity-90">Video</p>
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
          <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Music className="w-6 h-6 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium opacity-90">Voice message</p>
          </div>
        </div>
      );
    }

    // File/Document
    if ((message.type === "file" || message.type === "document") && message.fileUrl) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium opacity-90">Document</p>
            {message.fileName && (
              <p className="text-xs opacity-70 truncate">{message.fileName}</p>
            )}
          </div>
        </div>
      );
    }

    // Text message (default)
    return (
      <p className="text-xs opacity-80 truncate">
        {message.text || "Message"}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={`${
        darkMode ? "bg-gray-800" : "bg-gray-100"
      } border-l-4 border-primary rounded-lg p-3 mb-2`}
    >
      <div className="flex items-start gap-2">
        <Reply className="w-4 h-4 opacity-70 mt-1 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium opacity-90 mb-1">
            Replying to {message.from === "me" ? "yourself" : "Runner"}
          </p>
          {getReplyContent()}
        </div>

        <button
          onClick={onCancel}
          className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}