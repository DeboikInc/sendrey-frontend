import React, { useState, useEffect, useRef, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Edit2, Trash2, Reply, Copy, X, } from "lucide-react";
import { Button } from "@material-tailwind/react";
import EmojiPicker from "emoji-picker-react";

const ContextMenu = forwardRef(({
  message,
  position,
  onClose,
  onReact,
  onEdit,
  onDelete,
  onReply,
  isMe,
  isEditable,
  isDeletable,
  alwaysAllowEdit = false,
  showReply = true,
  showDelete = true,
}, ref) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const emojiPickerRef = useRef(null);

  // Calculate position for emoji picker (above the menu)
  const emojiPickerPosition = {
    x: Math.min(position.x, window.innerWidth - 350),
    y: Math.max(position.y - 400, 10),
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if delete modal is open
      if (showDeleteConfirm) return;

      const contextMenu = document.querySelector('.context-menu-container');
      const emojiPicker = emojiPickerRef.current;

      if (contextMenu && !contextMenu.contains(e.target) &&
        emojiPicker && !emojiPicker.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, showDeleteConfirm]);

  const handleEmojiClick = (emojiObject) => {
    if (onReact) {
      onReact(message.id, emojiObject.emoji);
    }
    setShowEmojiPicker(false);
    onClose();
  };

  const handleEditClick = () => {
    if (onEdit && isEditable) {
      onEdit(message.id);
    }
    onClose();
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (isMe) {
      // User's own message - show delete for everyone option
      setDeleteType("for-everyone");
    } else {
      // Other person's message - delete for me only
      setDeleteType("for-me");
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(message.id, deleteType === "for-everyone");
    }
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleReplyClick = (e) => {
    e.stopPropagation();
    if (onReply) {
      onReply(message);
    }
    onClose();
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    if (message.text) {
      navigator.clipboard.writeText(message.text);
    }
    onClose();
  };

  return (
    <>
      {/* Context Menu - Only show when delete confirm is not open */}
      {!showDeleteConfirm && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed',
            left: Math.min(position.x, window.innerWidth - 200),
            top: Math.min(position.y, window.innerHeight - 350),
            zIndex: 1000,
          }}
          className="context-menu-container"
        >
          <div className=" backdrop-blur-lg overflow-hidden min-w-[180px]">
            {/* Menu Options */}
            <div className="flex gap-1 flex-col">
              {/* Emoji Reaction - Available for all messages */}
              <Button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-full px-4 py-3 text-left flex items-center gap-3 bg-black-100"
              >
                <Smile className="w-5 h-5" />
                <span className="text-sm font-medium">React</span>
              </Button>

              {/* Reply - Available for all messages */}
               {showReply && onReply && (
                <Button
                  onClick={handleReplyClick}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors bg-black-100"
                >
                  <Reply className="w-5 h-5" />
                  <span className="text-sm font-medium">Reply</span>
                </Button>
              )}

              {/* EDIT - Show if editable OR alwaysAllowEdit is true */}
              {(isEditable || alwaysAllowEdit || message.type === "special-instructions" || message.specialInstructions) && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) {
                      onEdit(message.id);
                    }
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors bg-black-100"
                >
                  <Edit2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Edit</span>
                </Button>
              )}


              {/* Copy - Available for all text messages */}
              {(message.type === "text" || !message.type) && message.text && (
                <Button
                  onClick={handleCopy}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors bg-black-100"
                >
                  <Copy className="w-5 h-5" />
                  <span className="text-sm font-medium">Copy</span>
                </Button>
              )}

              {/* Edit - only for user's own messages within time limit */}
              {/* {isMe && isEditable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(message.id);
                    onClose();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Edit</span>
                </button>
              )} */}

              {showDelete && isDeletable && (
                <Button
                  onClick={handleDeleteClick}
                  className="w-full px-4 py-3 text-left flex items-center bg-black-100 text-red-700 gap-3 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {isMe ? "Delete" : "Delete for me"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && !showDeleteConfirm && (
          <motion.div
            ref={emojiPickerRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: emojiPickerPosition.x,
              top: emojiPickerPosition.y,
              zIndex: 1001,
            }}
            className="emoji-picker-container"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                autoFocusSearch={false}
                width={350}
                height={400}
                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                previewConfig={{
                  showPreview: false,
                }}
                skinTonesDisabled={true}
                searchDisabled={false}
                categories={[
                  { category: "smileys_people", name: "Smileys & People" },
                  { category: "animals_nature", name: "Animals & Nature" },
                  { category: "food_drink", name: "Food & Drink" },
                  { category: "travel_places", name: "Travel & Places" },
                  { category: "activities", name: "Activities" },
                  { category: "objects", name: "Objects" },
                  { category: "symbols", name: "Symbols" },
                  { category: "flags", name: "Flags" },
                ]}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowDeleteConfirm(false);
                onClose();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl"
            >
              <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-200">
                {deleteType === "for-everyone" ? "Delete message?" : "Delete for you?"}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {deleteType === "for-everyone"
                  ? "This message will be deleted for everyone."
                  : "This message will only be deleted for you. The other person will still see it."
                }
              </p>

              {isMe && (
                <div className="mb-4 space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="deleteType"
                      checked={deleteType === "for-me"}
                      onChange={() => setDeleteType("for-me")}
                      className="cursor-pointer"
                    />
                    <span>Delete for me</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="deleteType"
                      checked={deleteType === "for-everyone"}
                      onChange={() => setDeleteType("for-everyone")}
                      className="cursor-pointer"
                    />
                    <span>Delete for everyone</span>
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  variant="outlined"
                  className="flex-1 dark:text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

ContextMenu.displayName = "ContextMenu";

export default ContextMenu;