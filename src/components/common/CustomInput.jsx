import { Button, IconButton, Tooltip } from "@material-tailwind/react";
import { Mic, Paperclip, Smile, Square, Plus, MapPin, X, Camera } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import EmojiPicker from "emoji-picker-react";
import InputReplyPreview from "./InputReplyPreview";

export default function CustomInput({
  value,
  onChange,
  send,
  showMic = true,
  placeholder,
  showIcons = true,
  showPlus = false,
  setLocationIcon = false,
  searchIcon,
  onMicClick,
  onAttachClick,
  isRecording = false,
  toggleRecording,
  onLocationClick,
  selectedFiles = [],
  onFilesChange,
  onRemoveFile,
  replyingTo = null,
  onCancelReply,
  darkMode = false,
  showCamera,
  onOpenCamera,
  userName,
  className,
  // Audio recording callbacks — optional, used when parent wants to handle recording
  onAudioReady, // (audioBlob, audioUrl) => void  — called when recording stops
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  // ── Audio recording state ──────────────────────────────────────────────────
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioPreview, setAudioPreview] = useState(null); // { url, blob }
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // ── Device detection for emoji ─────────────────────────────────────────────
  const isTouchDevice = useRef(
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  // Hidden emoji-capable input for mobile native emoji keyboard
  const nativeEmojiInputRef = useRef(null);

  // ── Recording logic ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioPreview({ url, blob, mimeType });
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(100);
      setRecordingActive(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record audio.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setRecordingActive(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Clear chunks so onstop doesn't set preview
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks?.().forEach(t => t.stop());
      };
    }
    clearInterval(timerRef.current);
    setRecordingActive(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  }, []);

  const handleMicClick = useCallback(() => {
    if (onMicClick) return onMicClick(); // parent override
    if (recordingActive) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recordingActive, startRecording, stopRecording, onMicClick]);

  const handleSendAudio = useCallback(() => {
    if (!audioPreview) return;
    // Pass blob, url and mimeType to parent — do NOT revoke here.
    // The url stays alive so the optimistic message bubble can play it.
    // ChatComposer will revoke it after the upload completes.
    if (onAudioReady) {
      onAudioReady(audioPreview.blob, audioPreview.url, audioPreview.mimeType);
    }
    setAudioPreview(null);
    setRecordingSeconds(0);
  }, [audioPreview, onAudioReady]);

  const handleDiscardAudio = useCallback(() => {
    if (audioPreview?.url) URL.revokeObjectURL(audioPreview.url);
    setAudioPreview(null);
    setRecordingSeconds(0);
  }, [audioPreview]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Format seconds → mm:ss ─────────────────────────────────────────────────
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Emoji logic ────────────────────────────────────────────────────────────
  const handleEmojiButtonClick = () => {
    if (isTouchDevice.current) {
      // On touch devices: focus a hidden input with emoji keyboard
      nativeEmojiInputRef.current?.focus();
    } else {
      setShowEmojiPicker(prev => !prev);
    }
  };

  const handleNativeEmojiInput = (e) => {
    const emoji = e.target.value;
    if (!emoji) return;

    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const newValue = value.slice(0, cursorPos) + emoji + value.slice(cursorPos);
    onChange({ target: { value: newValue }, currentTarget: { value: newValue } });

    // Clear hidden input
    e.target.value = '';

    // Refocus main input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = cursorPos + emoji.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 10);
  };

  const handleEmojiSelect = (emojiData) => {
    const emoji = emojiData.emoji;
    if (!emoji || !inputRef.current) return;

    const cursorPos = inputRef.current.selectionStart || value.length;
    const newValue = value.slice(0, cursorPos) + emoji + value.slice(cursorPos);
    onChange({ target: { value: newValue }, currentTarget: { value: newValue } });

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = cursorPos + emoji.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 10);

    setShowEmojiPicker(false);
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiButtonRef.current?.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const handleSend = () => send();

  const showSendButton = value || (selectedFiles && selectedFiles.length > 0) || audioPreview;
  // Mic only shows when not typing, no files, no audio preview, and not currently recording
  const showMicButton = showMic && !value && (!selectedFiles || selectedFiles.length === 0) && !audioPreview && !recordingActive;

  return (
    <div className="flex flex-col w-full">

      {/* Hidden native emoji input for touch devices */}
      <input
        ref={nativeEmojiInputRef}
        type="text"
        inputMode="text"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
        onChange={handleNativeEmojiInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Reply preview */}
      {replyingTo && (
        <InputReplyPreview
          message={replyingTo}
          onCancel={onCancelReply}
          darkMode={darkMode}
          userName={userName}
        />
      )}

      {/* Audio preview — sits directly above input bar in normal flow */}
      {audioPreview && !recordingActive && (
        <div className={`flex items-center gap-2 px-3 py-2 ${darkMode ? 'bg-transparent border-gray-700' : 'bg-white border-t border-gray-200'}`}>
          <audio src={audioPreview.url} controls className="flex-1 h-9" style={{ minWidth: 0 }} />
          <button onClick={handleDiscardAudio} className="p-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors flex-shrink-0">
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Emoji Picker — desktop only, anchored above input */}
      {showEmojiPicker && !isTouchDevice.current && (
        <div ref={emojiPickerRef} className="absolute bottom-full left-0 z-50 mb-1">
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            theme={darkMode ? 'dark' : 'light'}
            height={350}
            width={300}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {/* Main input row */}
      <div className="flex w-full items-center gap-3">

        {showPlus && !value && (
          <Button className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
            <Plus className="h-10 w-10 text-white bg-primary rounded-full p-2" />
          </Button>
        )}

        {showCamera && (
          <Button onClick={onOpenCamera} className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
            <Camera className="h-10 w-10 text-white bg-primary rounded-full p-2" />
          </Button>
        )}

        {setLocationIcon && !value && (
          <Button onClick={onLocationClick} className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
            <MapPin className="h-10 w-10 text-white bg-primary rounded-full p-2" />
          </Button>
        )}

        <div className="flex-1 w-full flex items-center px-3 bg-white dark:bg-black-100 rounded-full h-14 shadow-lg backdrop-blur-lg">
          {showIcons && (
            <div ref={emojiButtonRef}>
              <Tooltip content="Emoji" placement="bottom" className="text-xs">
                <IconButton variant="text" size="sm" className="rounded-full" onClick={handleEmojiButtonClick}>
                  <Smile className="h-6 w-6" />
                </IconButton>
              </Tooltip>
            </div>
          )}

          {recordingActive ? (
            <div className="flex-1 flex items-center gap-2 px-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className={`text-sm font-mono ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{formatTime(recordingSeconds)}</span>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Recording...</span>
            </div>
          ) : (
            <input
              ref={inputRef}
              placeholder={placeholder || 'Type a message'}
              className={`w-full bg-transparent focus:outline-none font-normal text-lg text-black-100 dark:text-gray-100 px-4 ${className}`}
              value={value}
              onChange={onChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          )}

          {showIcons && !recordingActive && (
            <Tooltip content="Attach" placement="bottom" className="text-xs">
              <IconButton variant="text" size="sm" className="rounded-full" onClick={onAttachClick}>
                <Paperclip className="h-6 w-6" />
              </IconButton>
            </Tooltip>
          )}

          {searchIcon}
        </div>

        {/* Mic / Recording controls / Send */}
        <div className="flex items-center gap-2">
          {showMicButton && (
            <IconButton variant="text" className="rounded-full bg-primary text-white" onClick={handleMicClick}>
              <Mic className="h-6 w-6" />
            </IconButton>
          )}

          {recordingActive && (
            <>
              <IconButton variant="text" className="rounded-full bg-gray-200 dark:bg-gray-700" onClick={cancelRecording}>
                <X className="h-5 w-5 text-red-500" />
              </IconButton>
              <IconButton variant="text" className="rounded-full bg-red-500 text-white" onClick={stopRecording}>
                <Square className="h-5 w-5" />
              </IconButton>
            </>
          )}

          {showSendButton && !recordingActive && (
            <Button onClick={audioPreview ? handleSendAudio : handleSend} className="rounded-lg bg-primary h-12 px-6 text-md">
              Send
            </Button>
          )}
        </div>
      </div>

      {/* File previews — shown below input when files are staged */}
      {selectedFiles && selectedFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap rounded-2xl shadow-lg mt-2">
          {selectedFiles.map((fileData, index) => (
            <div key={index} className="relative group p-3 dark:bg-black-100 bg-white">
              {fileData.type.startsWith('image/') ? (
                <img src={fileData.preview} alt={fileData.name} className="w-20 h-20 object-cover rounded-lg" />
              ) : fileData.type.startsWith('video/') ? (
                <video src={fileData.preview} className="w-20 h-20 object-cover rounded-lg" />
              ) : fileData.type.startsWith('audio/') ? (
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center p-2 gap-1">
                  <Mic className="h-6 w-6 text-primary" />
                  <audio src={fileData.preview} controls className="w-full" style={{ height: 24 }} />
                </div>
              ) : (
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center p-2">
                  <Paperclip className="h-6 w-6 mb-1" />
                  <p className="text-[10px] text-center truncate w-full px-1">{fileData.name}</p>
                </div>
              )}
              <button
                onClick={() => onRemoveFile(index)}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate">
                {fileData.size < 1024 * 1024
                  ? `${(fileData.size / 1024).toFixed(1)} KB`
                  : `${(fileData.size / (1024 * 1024)).toFixed(1)} MB`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}