import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { ImPhoneHangUp } from "react-icons/im";
import { IoCall } from "react-icons/io5";
import BarLoader from "./BarLoader";

const CallerAvatar = ({ name, avatar }) => (
  <div className="flex flex-col items-center gap-4 z-10">
    <div className="relative z-10 w-32 h-32 rounded-full overflow-hidden border-4 border-primary/30 shadow-2xl">
      {avatar
        ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
        : <div className="w-full h-full bg-primary flex items-center justify-center">
            <span className="text-white text-5xl font-bold">
              {name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
      }
    </div>
    <div className="text-center mt-4">
      <p className="text-white text-3xl font-semibold">{name}</p>
    </div>
  </div>
);

// ── Connecting overlay — shown immediately on Accept until Agora is ready ─────
const ConnectingOverlay = () => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-4">
    <BarLoader />
    <p className="text-white text-base font-medium">Connecting...</p>
  </div>
);

// ── Error overlay — shown on Agora failure, auto-dismisses ────────────────────
const ErrorOverlay = ({ message }) => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 gap-4 px-8">
    <div className="w-14 h-14 rounded-full bg-red-600/20 flex items-center justify-center">
      <ImPhoneHangUp size={24} color="#ef4444" />
    </div>
    <p className="text-white text-base font-semibold text-center">Call Failed</p>
    <p className="text-white/60 text-sm text-center leading-relaxed">{message}</p>
    <p className="text-white/30 text-xs">Ending call...</p>
  </div>
);

export default function CallScreen({
  callState,
  callType,
  callerName,
  callerAvatar,
  isMuted,
  isCameraOff,
  formattedDuration,
  remoteUsers,
  localVideoTrack,
  isConnecting = false,
  callError = null,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
}) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && callType === "video") {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack, callType]);

  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const user = remoteUsers[0];
      if (user.videoTrack) user.videoTrack.play(remoteVideoRef.current);
    }
  }, [remoteUsers]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-gradient-to-b from-black-100 to-black-200">

      {/* Remote video */}
      {callType === "video" && callState === "active" && remoteUsers.length > 0 && (
        <div ref={remoteVideoRef} className="absolute inset-0 z-0 bg-black-200" />
      )}

      {/* Overlays — sit above everything, pointer-events block taps while showing */}
      {callError   && <ErrorOverlay message={callError} />}
      {!callError && isConnecting && <ConnectingOverlay />}

      {/* Main content */}
      <div className="relative z-10 flex flex-col h-full px-6 py-10">

        <div className="flex-1 flex flex-col items-center justify-center">
          <CallerAvatar name={callerName} avatar={callerAvatar} />
          <div className="mt-6 text-center">
            {callState === "outgoing" && (
              <p className="text-gray-400 text-base animate-pulse">Calling...</p>
            )}
            {callState === "incoming" && (
              <p className="text-gray-400 text-base animate-pulse">
                Incoming {callType} call
              </p>
            )}
            {callState === "active" && !isConnecting && (
              <p className="text-primary text-lg font-mono">{formattedDuration}</p>
            )}
            {callState === "active" && isConnecting && (
              <p className="text-white/40 text-sm">Connecting...</p>
            )}
          </div>
        </div>

        {/* PiP self-view */}
        {callType === "video" && callState === "active" && (
          <div
            ref={localVideoRef}
            className="absolute top-10 right-6 w-28 h-40 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl z-20 bg-black-200"
          />
        )}

        {/* Controls */}
        <div className="pb-8">

          {/* INCOMING */}
          {callState === "incoming" && (
            <div className="flex items-center justify-center gap-20">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onDecline}
                  className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <ImPhoneHangUp size={24} color="white" />
                </button>
                <span className="text-white text-sm">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onAccept}
                  className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <IoCall size={24} color="white" />
                </button>
                <span className="text-white text-sm">Accept</span>
              </div>
            </div>
          )}

          {/* OUTGOING */}
          {callState === "outgoing" && (
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onEnd}
                  className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <ImPhoneHangUp size={24} color="white" />
                </button>
                <span className="text-white text-sm">Cancel</span>
              </div>
            </div>
          )}

          {/* ACTIVE */}
          {callState === "active" && (
            <div className="flex items-center justify-center gap-10">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onToggleMute}
                  disabled={isConnecting}
                  className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40 ${
                    isMuted ? "bg-red-600" : "bg-gray-700 dark:bg-black-200"
                  }`}
                >
                  {isMuted ? <MicOff size={20} color="white" /> : <Mic size={20} color="white" />}
                </button>
                <span className="text-white text-xs">{isMuted ? "Unmute" : "Mute"}</span>
              </div>

              {callType === "video" && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={onToggleCamera}
                    disabled={isConnecting}
                    className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40 ${
                      isCameraOff ? "bg-red-600" : "bg-gray-700 dark:bg-black-200"
                    }`}
                  >
                    {isCameraOff ? <VideoOff size={20} color="white" /> : <Video size={20} color="white" />}
                  </button>
                  <span className="text-white text-xs">Camera</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={onEnd}
                  className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <ImPhoneHangUp size={24} color="white" />
                </button>
                <span className="text-white text-sm">End</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}