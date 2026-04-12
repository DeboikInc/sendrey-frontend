import React, { useState, useEffect, useRef, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Edit2, Trash2, Reply, Copy } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

// WhatsApp allows "Delete for Everyone" within 60 hours
const DELETE_FOR_EVERYONE_WINDOW_MS = 60 * 60 * 60 * 1000;
const canDeleteForEveryone = (timestamp) => {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() <= DELETE_FOR_EVERYONE_WINDOW_MS;
};

const MenuButton = ({ icon, label, onClick, danger = false }) => (
  <button
    onClick={onClick}
    className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors active:bg-white/10 hover:bg-white/5 ${danger ? "text-red-400" : "text-gray-100"}`}
  >
    <span className="opacity-80">{icon}</span>
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const RadioOption = ({ label, sublabel, checked, onChange, disabled }) => (
  <label className={`flex items-center gap-3 ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer group"}`}>
    <span
      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
        ${checked ? "border-[#00a884] bg-[#00a884]" : disabled ? "border-gray-500" : "border-gray-400 group-hover:border-[#00a884]"}`}
    >
      {checked && <span className="w-2 h-2 rounded-full bg-white block" />}
    </span>
    <input type="radio" className="sr-only" checked={checked} onChange={onChange} disabled={disabled} />
    <span className="text-sm text-gray-200 select-none" onClick={!disabled ? onChange : undefined}>
      {label}
      {sublabel && <span className="block text-xs text-gray-500">{sublabel}</span>}
    </span>
  </label>
);

const ContextMenu = forwardRef(({
  message,
  position,       // { x, y } — caller passes bubble's bottom-left/right on mobile
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
  isChatActive = false,
}, ref) => {
  const allowDeleteForEveryone = isMe && canDeleteForEveryone(message?.timestamp);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState(allowDeleteForEveryone ? "for-everyone" : "for-me");
  const menuRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const isMobile = window.innerWidth < 640;
  const MENU_WIDTH = 190;
  const MENU_MAX_H = 320;

  // Always below bubble on mobile; clamp to viewport on desktop
  const menuLeft = Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8));
  const menuTop = Math.min(position.y + (isMobile ? 6 : 0), window.innerHeight - MENU_MAX_H - 8);

  const emojiLeft = Math.min(position.x, window.innerWidth - 360);
  const emojiTop = Math.max(position.y - 430, 10);

  // Tight outside-click close — works for mouse AND touch
  useEffect(() => {
    if (showDeleteConfirm) return;
    const close = (e) => {
      const hitMenu = menuRef.current?.contains(e.target);
      const hitEmoji = emojiPickerRef.current?.contains(e.target);
      if (!hitMenu && !hitEmoji) onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [onClose, showDeleteConfirm]);

  const handleEmojiClick = (emojiObject) => {
    onReact?.(message.id, emojiObject.emoji);
    setShowEmojiPicker(false);
    onClose();
  };

  const confirmDelete = () => {
    onDelete?.(message.id, deleteType === "for-everyone");
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <>
      {/* WhatsApp-style blur backdrop — clicking it closes the menu */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-[990] bg-black/30 backdrop-blur-[3px]"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onTouchStart={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />

      {/* Context menu */}
      {!showDeleteConfirm && (
        <motion.div
          ref={(node) => {
            menuRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          initial={{ opacity: 0, scale: 0.88, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: -4 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          style={{ position: "fixed", left: menuLeft, top: menuTop, zIndex: 1000, width: MENU_WIDTH }}
          className="context-menu-container"
        >
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#1f2c34]">
            <div className="flex flex-col divide-y divide-white/5">
              <MenuButton icon={<Smile className="w-4 h-4" />} label="React" onClick={() => setShowEmojiPicker(v => !v)} />
              {showReply && onReply && (
                <MenuButton icon={<Reply className="w-4 h-4" />} label="Reply" onClick={(e) => { e.stopPropagation(); onReply?.(message); onClose(); }} />
              )}
              {(isEditable || alwaysAllowEdit || message.type === "special-instructions" || message.specialInstructions) && (
                <MenuButton icon={<Edit2 className="w-4 h-4" />} label="Edit" onClick={(e) => { e.stopPropagation(); onEdit?.(message.id); onClose(); }} />
              )}
              {(message.type === "text" || !message.type) && message.text && (
                <MenuButton icon={<Copy className="w-4 h-4" />} label="Copy" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(message.text); onClose(); }} />
              )}
              {showDelete && isDeletable && (
                <MenuButton icon={<Trash2 className="w-4 h-4" />} label={isMe ? "Delete" : "Delete for me"} danger onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} />
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
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", left: emojiLeft, top: emojiTop, zIndex: 1001 }}
          >
            <div className="rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                autoFocusSearch={false}
                width={isMobile ? Math.min(320, window.innerWidth - 16) : 350}
                height={400}
                theme={document.documentElement.classList.contains("dark") ? "dark" : "light"}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center px-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); onClose(); } }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1f2c34] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-base font-semibold mb-1 text-gray-900 dark:text-gray-100">Delete message?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                {deleteType === "for-everyone"
                  ? "This message will be deleted for everyone in this chat."
                  : "This message will only be deleted for you."}
              </p>

              {isMe && (
                <div className="mb-5 space-y-3">
                  <RadioOption
                    label="Delete for me"
                    checked={deleteType === "for-me"}
                    onChange={() => setDeleteType("for-me")}
                  />
                  <RadioOption
                    label="Delete for everyone"
                    sublabel={!allowDeleteForEveryone ? "No longer available" : undefined}
                    checked={deleteType === "for-everyone"}
                    onChange={() => setDeleteType("for-everyone")}
                    disabled={!allowDeleteForEveryone}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); onClose(); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors"
                >
                  Delete
                </button>
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