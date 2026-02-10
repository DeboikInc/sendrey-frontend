import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCheck, Smile, Download, FileText, Trash2, Edit2, Reply, Video, Music } from "lucide-react";
import { Button } from "@material-tailwind/react";
import ContextMenu from "./ContextMenu";

export default function Message({
  m,
  onReact,
  onDelete,
  onEdit,
  onReply,
  onMessageClick,
  canResendOtp,
  onConnectButtonClick,
  onBudgetFlexibilityClick,
  onChooseDeliveryClick,
  showCursor = true,
  onUseMyNumberClick,
  isChatActive = false,
  replyingToMessage = null,
  onCancelReply,
  userType = "user",
  messages = [],
  onScrollToMessage
}) {
  // 1. ALL HOOKS AT THE TOP - NO EXCEPTIONS
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(m.text);
  const contextMenuRef = useRef(null);

  const messageRef = useRef(null);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const isEmojiOnly = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,5}$/u.test(m.text?.trim());

  // 2. ALL OTHER HOOKS (useEffect)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside the context menu
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        // Also check if click is not on the message bubble that opened the menu
        const messageBubble = messageRef.current;
        if (messageBubble && !messageBubble.contains(event.target)) {
          setShowContextMenu(false);
        }
      }
    };

    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showContextMenu]);

  // Cleanup effect - moved to top and always called
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []); // Empty dependency array is OK here

  // 3. THEN COMPUTE VALUES
  const isMe = m.from === "me";
  const isSystem = m.from === "system" || m.messageType === "system" || m.type === "system";
  const isProfileCard = m.type === "profile-card" || m.messageType === "profile-card";

  // 4. EARLY RETURN FOR PROFILE CARD
  if (isProfileCard) {
    console.log('📱 Profile card message detected, rendering nothing (should be handled by parent):', m);
    return null; // Don't render anything - profile cards should be handled by parent component
  }

  // Handle long press for mobile/touch devices
  const handleTouchStart = (e) => {
    if (isSystem) return;

    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      showContextMenuAtPosition(e);
    }, 500);
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const showContextMenuAtPosition = (e) => {
    let x, y;

    if (e.type.includes('touch')) {
      const touch = e.touches[0] || e.changedTouches[0];
      x = touch.clientX;
      y = touch.clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }

    setContextMenuPosition({ x, y });
    setShowContextMenu(true);
  };

  const handleReact = (messageId, emoji) => {
    if (onReact) {
      onReact(messageId, emoji);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (isSystem) return;
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleLeftClick = (e) => {
    if (
      e.target.tagName === 'AUDIO' ||
      e.target.tagName === 'A' ||
      e.target.tagName === 'IMG' ||
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'VIDEO' ||
      e.target.closest('button') ||
      e.target.closest('a')
    ) {
      return;
    }

    if (isSystem || !isChatActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenuPosition({ x: rect.right - 150, y: rect.bottom + 5 });
    setShowContextMenu(true);
  };

  const handleEdit = (messageId) => {
    setIsEditing(true);
    setEditText(m.text);
  };

  const handleReply = (message) => {
    if (onReply) {
      onReply(message);
    }
  };

  const handleEditSave = () => {
    if (onEdit && editText.trim() && editText !== m.text) {
      onEdit(m.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditText(m.text);
    setIsEditing(false);
  };

  // Check if message can be edited (within 15 minutes like WhatsApp)
  const canEditMessage = () => {
    if (!m.timestamp) return false;
    const messageTime = new Date(m.timestamp).getTime();
    const currentTime = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    return (currentTime - messageTime) <= fifteenMinutes;
  };

  const renderReplyPreview = () => {
    if (!m.replyToMessage) return null;

    const getReplyContent = () => {
      // If replyToMessage is an object with file info
      const replyMsg = messages.find(msg => msg.id === m.replyTo);

      if (replyMsg) {
        const isReplyEmojiOnly = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,5}$/u.test(replyMsg.text?.trim());

        // Emoji-only reply
        if (isReplyEmojiOnly && !replyMsg.hasResendLink && !replyMsg.hasConnectRunnerButton &&
          !replyMsg.hasChooseDeliveryButton && !replyMsg.hasUseMyNumberButton &&
          !replyMsg.hasBudgetFlexibilityButtons) {
          return (
            <div className="flex items-center gap-2">
              <div className="">
                <p className="text-2xl">
                  {replyMsg.text}
                </p>
              </div>
            </div>
          );
        }
        // Image
        if ((replyMsg.type === "image" || replyMsg.type === "media") && replyMsg.fileUrl) {
          return (
            <div className="flex items-center gap-2">
              <img
                src={replyMsg.fileUrl}
                alt="Reply preview"
                className="w-10 h-10 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium opacity-90">Photo</p>
                {replyMsg.fileName && (
                  <p className="text-xs opacity-70 truncate">{replyMsg.fileName}</p>
                )}
              </div>
            </div>
          );
        }

        // Video
        if (replyMsg.type === "video" && replyMsg.fileUrl) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded bg-white/30 dark:bg-gray-700/50 flex items-center justify-center">
                <Video className="w-5 h-5 opacity-70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium opacity-90">Video</p>
                {replyMsg.fileName && (
                  <p className="text-xs opacity-70 truncate">{replyMsg.fileName}</p>
                )}
              </div>
            </div>
          );
        }

        // Audio
        if ((replyMsg.type === "audio" || replyMsg.fileType === "voice_note") && (replyMsg.audioUrl || replyMsg.fileUrl)) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded bg-white/30 dark:bg-gray-700/50 flex items-center justify-center">
                <Music className="w-5 h-5 opacity-70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium opacity-90">Voice message</p>
              </div>
            </div>
          );
        }

        // File/Document
        if ((replyMsg.type === "file" || replyMsg.type === "document") && replyMsg.fileUrl) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded bg-white/30 dark:bg-gray-700/50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500 opacity-70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium opacity-90">Document</p>
                {replyMsg.fileName && (
                  <p className="text-xs opacity-70 truncate">{replyMsg.fileName}</p>
                )}
              </div>
            </div>
          );
        }
      }

      // Text message (default)
      return (
        <p className="text-xs opacity-80 truncate">
          {m.replyToMessage}
        </p>
      );
    };

    const handleReplyClick = (e) => {
      e.stopPropagation();
      if (onScrollToMessage && m.replyTo) {
        onScrollToMessage(m.replyTo);
      }
    };

    // Determine the sender name for the reply
    const getReplySenderName = () => {
      const replyMsg = messages.find(msg => msg.id === m.replyTo);

      if (!replyMsg) {
        // Fallback to the stored replyToFrom
        if (m.replyToFrom === "me") return "You";
        if (m.replyToFrom === "them") return userType === "user" ? "Runner" : "User";
        return userType === "user" ? "Runner" : "User";
      }

      // If the CURRENT message is from me, check who I replied to
      if (isMe) {
        // I replied to someone
        if (replyMsg.from === "me") {
          return "You"; // I replied to myself
        } else {
          return userType === "user" ? "Runner" : "User"; // I replied to the other person
        }
      } else {
        // The other person sent this message
        if (replyMsg.from === "me") {
          return "You"; // They replied to MY message
        } else {
          return userType === "user" ? "Runner" : "User"; // They replied to their own message
        }
      }
    };

    return (
      <div
        onClick={handleReplyClick}
        className={`mb-2 p-2 rounded-lg border-l-4 cursor-pointer hover:opacity-80 transition-opacity ${isMe
          ? "bg-white/20 border-white/40"
          : "bg-gray-100 dark:bg-gray-800 border-gray-400"
          }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <Reply className="w-3 h-3 opacity-70" />
          <span className="text-xs font-medium opacity-90">
            {getReplySenderName()}
          </span>
        </div>
        {getReplyContent()}
      </div>
    );
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

  if (m.deleted || m.type === "deleted" || m.deletedForMe) {
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
              ? "bg-gray-300/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400"
              : "bg-gray-200/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
              }`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 opacity-60" />
              <span>
                {m.deletedForMe ? "You deleted this message" : "This message was deleted"}
              </span>
            </div>
          </div>
          <span className="text-gray-800 dark:text-gray-400 text-xs font-medium">{m.time}</span>
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

    if (isEmojiOnly && !m.hasResendLink && !m.hasConnectRunnerButton &&
      !m.hasChooseDeliveryButton && !m.hasUseMyNumberButton &&
      !m.hasBudgetFlexibilityButtons && !m.replyToMessage) {
      return (
        <div className=" text-center">
          <p className="text-3xl">
            {m.text}
          </p>
        </div>
      );
    }

    // Media handling (image, audio, file, video, media)
    if ((m.type === "image" || m.type === "media") && m.fileUrl) {
      return (
        <div className="flex flex-col gap-2">
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
          </div>
          {/* Show caption/text if exists */}
          {m.text && m.text.trim() && (
            <div className="mt-1 ml-auto">
              {m.text}
            </div>
          )}
        </div>
      );
    }

    // Audio/Voice message
    if ((m.type === "audio" || m.fileType === "voice_note") && (m.audioUrl || m.fileUrl)) {
      const audioSrc = m.audioUrl || m.fileUrl;
      return (
        <div className="flex flex-col gap-2">
          <audio controls className="max-w-xs">
            <source src={audioSrc} type="audio/webm" />
            <source src={audioSrc} type="audio/mpeg" />
            <source src={audioSrc} type="audio/mp3" />
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    // File/Document message
    if ((m.type === "file" || m.type === "document") && m.fileUrl) {
      return (
        <a
          href={m.fileUrl}
          download={m.fileName}
          className={`truncate flex items-center gap-3 p-3 rounded-lg hover:opacity-80 transition-opacity ${isMe ? "bg-white/10" : "bg-gray-200 dark:bg-gray-700"
            }`}
        >
          <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs opacity-70">{m.fileSize}</p>
          </div>
          <Download className="h-5 w-5 opacity-70 flex-shrink-0" />
        </a>
      );
    }

    // videos
    if (m.type === "video" && m.fileUrl) {
      return (
        <div className="flex flex-col gap-2">
          <div className="max-w-xs md:max-w-md">
            <video
              src={m.fileUrl}
              controls
              className="rounded-lg w-full h-auto max-h-96"
            >
              Your browser does not support video playback.
            </video>
          </div>

          {m.text && m.text.trim() && (
            <div className="mt-1">
              {m.text}
            </div>
          )}
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

    if (m.hasBudgetFlexibilityButtons) {
      const parts = m.text.split('?');
      return (
        <div>
          {parts[0]}?
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onBudgetFlexibilityClick && onBudgetFlexibilityClick("stay within budget");
              }}
              className="flex-1 bg-primary text-white text-sm py-2"
            >
              Stay within budget
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onBudgetFlexibilityClick && onBudgetFlexibilityClick("can adjust slightly");
              }}
              className="flex-1 bg-gray-600 text-white text-sm py-2"
            >
              Can adjust slightly
            </Button>
          </div>
          {parts[1] && <div className="mt-2">{parts[1]}</div>}
        </div>
      );
    }

    // Text message (default)
    return <div>{m.text}</div>;
  };

  return (
    <>
      <motion.div
        id={`message-${m.id}`}
        ref={messageRef}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className={`w-full flex ${isMe ? "justify-end" : isSystem ? "justify-center" : "justify-start"
          } mb-2 group relative`}
      >
        <div
          className={`relative max-w-[80%] md:max-w-[55%] ${isSystem ? "text-center" : ""
            }`}
        >
          {/* Message bubble with blur selection effect */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={handleContextMenu}
            onClick={handleLeftClick}
            className={`backdrop-blur-sm rounded-2xl px-4 py-3 text-sm font-normal relative transition-all duration-200
              ${showContextMenu ? 'bg-opacity-70 backdrop-blur-md' : ''}
              ${isMe && isChatActive ? 'active:scale-[0.99]' : ''}
               ${isEmojiOnly ? 'px-3 py-1' : 'px-4 py-3'}
              ${isMe
                ? "bg-primary border-primary text-white"
                : isSystem
                  ? "bg-transparent text-gray-600 dark:text-gray-400"
                  : m.isResendLink
                    ? "bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                    : "bg-gray-1001 dark:bg-black-100 dark:border-black-100 border-gray-1001 dark:text-gray-1002 text-black-200"
              }`}
          >
            {/* Selection overlay when context menu is open */}
            {showContextMenu && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl" />
            )}

            <div className="relative z-10">
              {/* Reply preview inside message */}
              {renderReplyPreview()}

              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  {renderMessageContent()}
                </div>
              </div>
            </div>

            {/* Show reaction under message bubble */}
            {m.reaction && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -bottom-6 right-2"
              >
                <div className="rounded-full p-2 shadow-lg">
                  <span className="text-xl">{m.reaction}</span>
                </div>
              </motion.div>
            )}
            {m.edited && (
              <span className="text-xs opacity-70 ml-2">(edited)</span>
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
        </div>
      </motion.div>

      {/* Context Menu */}
      <AnimatePresence>
        {showContextMenu && (
          <ContextMenu
            ref={contextMenuRef}
            message={m}
            position={contextMenuPosition}
            onClose={() => setShowContextMenu(false)}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={onDelete}
            onReply={handleReply}
            isMe={isMe}
            isEditable={canEditMessage() && (m.type === "text" || !m.type)}
            isDeletable={isChatActive}
          />
        )}
      </AnimatePresence>
    </>
  );
}