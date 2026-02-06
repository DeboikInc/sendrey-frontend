import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCheck, Smile, Download, FileText, Trash2, Edit2 } from "lucide-react";
import { Button } from "@material-tailwind/react";

export default function Message({
  m, onReact,
  onDelete,
  onEdit, onMessageClick,
  canResendOtp, onConnectButtonClick,
  onChooseDeliveryClick, showCursor = true,
  onUseMyNumberClick, isChatActive = false,

}) {
  const isMe = m.from === "me";

  const isSystem = m.from === "system" || m.messageType === "system" || m.type === "system";
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(m.text);
  const contextMenuRef = useRef(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    if (!isMe || !isChatActive) {
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

    if (!isMe || !isChatActive) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenuPosition({ x: rect.right - 150, y: rect.bottom });
    setShowContextMenu(true);
  };

  const handleDelete = () => {
    if (!isMe || !isChatActive) {
      return;
    }
    setShowDeleteConfirm(true);
    setShowContextMenu(false);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(m.id);
    }
    setShowDeleteConfirm(false);
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

  if ((m.messageType === 'system' || m.type === 'system') && !m.runnerInfo) {
    const getTextColor = () => {
      if (m.text === "Invoice accepted" || m.style === "success") {
        return "text-primary dark:text-primary";
      }
      if (m.text === "Invoice Declined" || m.style === "error") {
        return "text-red-600 dark:text-red-400";
      }
      return "text-gray-600 dark:text-gray-400";
    };

    return (
      <div className="flex justify-center mb-3">
        <div className="px-4 py-2 mr-auto ml-auto">
          <p className={`text-sm ${getTextColor()} text-center font-medium`}>
            {m.text}
          </p>
        </div>
      </div>
    );
  }

  if (m.deleted || m.type === "deleted") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className={`w-full flex ${isMe ? "justify-end" : "justify-start"} mb-2`}
      >
        <div className={`relative max-w-[80%] md:max-w-[55%]`}>
          <div
            className={`backdrop-blur-sm rounded-2xl px-4 py-3 text-sm font-normal italic ${isMe
              ? "dark:bg-gray-300 bg-gray-300/50 dark:bg-primary text-primary dark:text-white"
              : ""
              }`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 opacity-80" />
              <span>This message was deleted</span>
            </div>
          </div>
          <span className="text-gray-800 text-xs font-medium">{m.time}</span>
        </div>
      </motion.div>
    );
  }

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
        <div className="max-w-xs md:max-w-md cursor-pointer">
          <img
            src={m.fileUrl}
            alt={m.fileName || "Image"}
            className="rounded-lg w-full h-auto bg-black-100 max-h-40 object-contain hover:opacity-90 transition-opacity"
            onClick={() => {
              const imgWindow = window.open();
              imgWindow.document.write(`
            <html>
              <head><title>${m.fileName || 'Image'}</title></head>
              <body style="margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                <img src="${m.fileUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />
              </body>
            </html>
          `);
            }}
          />
          {m.fileName && (
            <p className="text-xs mt-1 opacity-70">{m.fileName}</p>
          )}
        </div>
      );
    }

    // Audio/Voice message
    if (m.type === "audio" && (m.audioUrl || m.fileUrl)) {
      const audioSrc = m.audioUrl || m.fileUrl;
      return (
        <div className="flex flex-col gap-2">
          <audio controls className="max-w-xs">
            <source src={audioSrc} type="audio/webm" />
            <source src={audioSrc} type="audio/mpeg" />
            <source src={audioSrc} type="audio/mp3" />
            Your browser does not support audio playback.
          </audio>
          {m.fileName && <p className="text-xs opacity-70">{m.fileName}</p>}
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

    // videos
    if (m.type === "video" && m.fileUrl) {
      return (
        <div className="max-w-xs md:max-w-md">
          <video
            src={m.fileUrl}
            controls
            className="rounded-lg w-full h-auto max-h-96"
          >
            Your browser does not support video playback.
          </video>
          {m.fileName && (
            <p className="text-xs mt-1 opacity-70">{m.fileName}</p>
          )}
        </div>
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
          {parts[1] || ''}
        </div>
      );
    }

    if (m.hasConnectRunnerButton) {
      // use second "connect to runner" text
      const lastIndex = m.text.lastIndexOf('Connect To Runner');
      const beforeText = m.text.substring(0, lastIndex);
      const afterText = m.text.substring(lastIndex + 'Connect To Runner'.length);
      return (
        <div>
          {beforeText}
          <div className="mt-3">
            <Button
              className="w-full bg-primary text-white"
              onClick={(e) => {
                e.stopPropagation();
                onConnectButtonClick && onConnectButtonClick();
              }}
            >
              Connect To Runner
            </Button>
          </div>
          {afterText}
        </div>
      );
    }

    if (m.hasChooseDeliveryButton) {
      // use second "connect to runner" text
      const lastIndex = m.text.lastIndexOf('Choose Delivery Location');
      const beforeText = m.text.substring(0, lastIndex);
      const afterText = m.text.substring(lastIndex + 'Choose Delivery Location'.length);
      return (
        <div>
          {beforeText}
          <div className="mt-3">
            <Button
              className="w-full bg-primary text-white"
              onClick={(e) => {
                e.stopPropagation();
                onChooseDeliveryClick && onChooseDeliveryClick();
              }}
            >
              Choose Delivery Location
            </Button>
          </div>
          {afterText}
        </div>
      );
    }


    if (m.hasUseMyNumberButton) {
      const useMyNumberText = "Use My Phone Number";
      const index = m.text.indexOf(useMyNumberText);

      if (index !== -1) {
        const beforeText = m.text.substring(0, index);
        return (
          <div>
            {beforeText}
            <div className="mt-3">
              <Button
                className="w-full bg-primary text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onUseMyNumberClick && onUseMyNumberClick();
                }}
              >
                Use My Phone Number
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div>
          {m.text}
          <div className="mt-3">
            <Button
              className="w-full bg-primary text-white"
              onClick={(e) => {
                e.stopPropagation();
                onUseMyNumberClick && onUseMyNumberClick();
              }}
            >
              Use My Phone Number
            </Button>
          </div>
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
          className={`backdrop-blur-sm rounded-2xl px-4 py-3 text-sm font-normal relative ${showCursor ? 'cursor-pointer' : ''}
          ${isMe
              ? "bg-primary border-primary text-white"
              : isSystem
                ? "bg-transparent text-gray-600 dark:text-gray-400"
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
              {isChatActive && (m.type === "text" || !m.type) && (
                <button
                  onClick={handleEditClick}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {isChatActive && (m.type === "text" || !m.type) && (
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl"
              >
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-200">
                  Delete Message?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-100 mb-6">
                  This message will be deleted for everyone. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="outlined"
                    className="flex-1 dark:text-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}