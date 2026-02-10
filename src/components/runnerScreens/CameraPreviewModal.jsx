// components/runnerScreens/CameraPreviewModal.js
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import CustomInput from '../common/CustomInput';

export default function CameraPreviewModal({
  isOpen,
  onClose,
  previewImage,
  onRetake,
  onSend,
  onCancel,
  darkMode
}) {
  const [replyText, setReplyText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (onSend && previewImage) {
      // Allow sending even without text - text is optional
      onSend(previewImage, replyText.trim());
      setReplyText('');
      setIsFocused(false);
    }
  };

  const handleClose = () => {
    setReplyText('');
    setIsFocused(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen || !previewImage) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          {/* Header with close button */}
          <div className="flex justify-between items-center p-4">
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>

          {/* Preview Image - Full screen */}
          <div className="h-[70vh] flex items-center justify-center bg-black px-4">
            <img
              src={previewImage}
              alt="Photo preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* CustomInput Section at Bottom */}
          <div className="lg:px-80 py-12 px-3 mt-5">
            <div
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            >
              <CustomInput
                showMic={false}
                setLocationIcon={false}
                showIcons={false}
                send={isFocused ? handleSend : undefined}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Add a caption (optional)..."
                darkMode={darkMode}
              />
            </div>
          </div>

          {/* Conditional Send Button - Only show when NOT focused */}
          {!isFocused && (
            <button
              onClick={handleSend}
              className="absolute bottom-8 right-60 rounded-lg bg-primary h-12 px-6 text-md hover:bg-primary/80 text-white flex items-center gap-2 transition-all active:scale-95 shadow-lg"
              aria-label="Send photo"
            >
              <span className="font-medium">Send</span>
            </button>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}