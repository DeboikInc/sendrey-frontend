import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCheck, Smile, Download, FileText, Trash2, Edit2 } from "lucide-react";

export default function Message({ m, onReact, onDelete, onEdit, onMessageClick, canResendOtp }) {
  const isMe = m.from === "me";
  const isSystem = m.from === "system";
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(m.text);
  const contextMenuRef = useRef(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showContextMenu]);

  const handleContextMenu = (e) => {
    e.preventDefault();

    if (!isMe) {
      return;
    }

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleLeftClick = (e) => {
    // Handle resend link click
    if (m.isResendLink && onMessageClick) {
      onMessageClick(m);
      return;
    }

    // Only show menu if clicking on the message bubble itself, not on interactive elements
    if (e.target.tagName === 'AUDIO' || e.target.tagName === 'A' || e.target.tagName === 'IMG' || e.target.tagName === 'INPUT') {
      return;
    }

    if (!isMe) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenuPosition({ x: rect.right - 150, y: rect.bottom });
    setShowContextMenu(true);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(m.id);
    }
    setShowContextMenu(false);
  };

  const handleEditClick = () => {
    // Only allow editing text messages
    if (m.type === "text" || !m.type) {
      setIsEditing(true);
      setShowContextMenu(false);
    }
  };

  const handleEditSave = () => {
    if (onEdit && editText.trim()) {
      onEdit(m.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditText(m.text);
    setIsEditing(false);
  };

  // Function to render different message types
  const renderMessageContent = () => {
    // If editing, show input
    if (isEditing) {
      return (
        <div className="flex flex-col gap-2">
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-white/10 dark:bg-black/20 rounded px-2 py-1 outline-none resize-none"
            rows={3}
            onClick={(e) => {
              e.stopPropagation();
              handleEditSave();
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleEditSave();
              }
              if (e.key === "Escape") {
                handleEditCancel();
              }
            }}
          />
        </div>
      );
    }

    // Image message
    if (m.type === "image" && m.fileUrl) {
      return (
        <div className="max-w-xs">
          <img
            src={m.fileUrl}
            alt={m.fileName || "Image"}
            className="rounded-lg w-full h-auto"
          />
          {m.fileName && (
            <p className="text-xs mt-1 opacity-70">{m.fileName}</p>
          )}
        </div>
      );
    }

    // Audio/Voice message
    if (m.type === "audio" && m.audioUrl) {
      return (
        <div className="flex flex-col gap-2">
          <audio controls className="max-w-xs">
            <source src={m.audioUrl} type="audio/webm" />
            Your browser does not support audio playback.
          </audio>
          {m.text && <p className="text-xs opacity-70">{m.text}</p>}
        </div>
      );
    }

    // File message (PDF, DOC, etc)
    if (m.type === "file" && m.fileUrl) {
      return (
        <a
          href={m.fileUrl}
          download={m.fileName}
          className={`flex items-center gap-3 p-3 rounded-lg hover:opacity-80 transition-opacity ${isMe ? "bg-white/10" : "bg-gray-200 dark:bg-gray-700"
            }`}
        >
          <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{m.fileName}</p>
            <p className="text-xs opacity-70">{m.fileSize}</p>
          </div>
          <Download className="h-5 w-5 opacity-70 flex-shrink-0" />
        </a>
      );
    }

    // Text message with resend link styling
    if (m.hasResendLink) {
      const parts = m.text.split('Resend');
      return (
        <div>
          {parts[0]}
          <span
            className={`${canResendOtp
              ? 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer'
              : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
              } transition-colors`}
            onClick={(e) => {
              e.stopPropagation();
              if (canResendOtp && onMessageClick) {
                onMessageClick(m);
              }
            }}
          >
            Resend
          </span>
          {parts[1]}
        </div>
      );
    }

    // Text message (default)
    return <div>{m.text}</div>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`w-full flex ${isMe ? "justify-end" : isSystem ? "justify-center" : "justify-start"
        } mb-2 group`}
    >
      <div
        className={`relative max-w-[80%] md:max-w-[55%] ${isSystem ? "text-center" : ""
          }`}
      >
        <div
          onClick={!isSystem ? handleLeftClick : undefined}
          onContextMenu={!isSystem ? handleContextMenu : undefined}
          className={`shadow-sm backdrop-blur-sm rounded-2xl px-4 py-3 text-sm font-normal relative cursor-pointer
          ${isMe
              ? "bg-primary border-primary text-white"
              : isSystem
                ? "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                : m.isResendLink
                  ? "bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                  : "bg-gray-1001 dark:bg-black-100 dark:border-black-100 border-gray-1001 dark:text-gray-1002 text-black-200"
            }`}
        >
          <div className="flex justify-between items-start gap-2">
            {/* Render message content based on type */}
            <div className="flex-1">
              {renderMessageContent()}
            </div>
          </div>

          {/* Show reaction under message bubble */}
          {m.reaction && (
            <span className="absolute -bottom-3 right-2 text-lg">
              {m.reaction}
            </span>
          )}

          {!isSystem && (
            <div
              className={`mt-1 flex items-center gap-1 text-[10px] ${isMe ? "text-gray-100" : "text-primary"
                }`}
            >
              {isMe && (
                <span className="flex items-center">
                  {m.status === "read" ? (
                    <CheckCheck className="w-3 h-3" />
                  ) : m.status === "delivered" ? (
                    <Check className="w-3 h-3" />
                  ) : null}
                </span>
              )}
            </div>
          )}
        </div>

        {!isSystem && (
          <span className="text-gray-800 text-xs font-medium">{m.time}</span>
        )}

        {/* Context Menu */}
        <AnimatePresence>
          {showContextMenu && (
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.1 }}
              style={{
                position: 'fixed',
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
                zIndex: 1000,
              }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]"
            >
              {(m.type === "text" || !m.type) && (
                <button
                  onClick={handleEditClick}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}