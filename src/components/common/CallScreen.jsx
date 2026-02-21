import React, { useEffect, useRef } from "react";
import { IconButton } from "@material-tailwind/react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { ImPhoneHangUp } from "react-icons/im";
import { IoCall } from "react-icons/io5";

// Avatar shown during voice call or when video is off
const CallerAvatar = ({ name, avatar }) => (
  <div className="flex flex-col items-center gap-4 z-10">
    <div className="relative z-10 w-32 h-32 rounded-full overflow-hidden border-4 border-primary/30 shadow-2xl">
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-primary flex items-center justify-center">
          <span className="text-white text-5xl font-bold">
            {name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>
      )}
    </div>
    <div className="text-center mt-4">
      <p className="text-white text-3xl font-semibold">{name}</p>
    </div>
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
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && callType === "video") {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack, callType]);

  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const remoteUser = remoteUsers[0];
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.play(remoteVideoRef.current);
      }
    }
  }, [remoteUsers]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-gradient-to-b from-black-100 to-black-200">
      {/* Remote video (full screen when active video call) */}
      {callType === "video" && callState === "active" && remoteUsers.length > 0 && (
        <div
          ref={remoteVideoRef}
          className="absolute inset-0 z-0 bg-black-200"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col h-full px-6 py-10">
        {/* Caller info + status */}
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
            {callState === "active" && (
              <p className="text-primary text-lg font-mono">{formattedDuration}</p>
            )}
          </div>
        </div>

        {/* Local video pip (for video calls) */}
        {callType === "video" && callState === "active" && (
          <div
            ref={localVideoRef}
            className="absolute top-10 right-6 w-28 h-40 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl z-20 bg-black-200"
          />
        )}

        {/* Call controls at bottom */}
        <div className="pb-8">
          {/* INCOMING: Accept / Decline */}
          {callState === "incoming" && (
            <div className="flex items-center justify-center gap-20">
              <div className="flex flex-col items-center gap-3">
                <IconButton
                  onClick={onDecline}
                  className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  <ImPhoneHangUp size={24} />
                </IconButton>
                <span className="text-white text-sm">Decline</span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <IconButton
                  onClick={onAccept}
                  className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <IoCall size={24} />
                </IconButton>
                <span className="text-white text-sm">Accept</span>
              </div>
            </div>
          )}

          {/* OUTGOING: Cancel only */}
          {callState === "outgoing" && (
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <IconButton
                  onClick={onEnd}
                  className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  <ImPhoneHangUp size={24} />
                </IconButton>
                <span className="text-white text-sm">Cancel</span>
              </div>
            </div>
          )}

          {/* ACTIVE: Mute/Video/End controls */}
          {callState === "active" && (
            <div className="flex items-center justify-center gap-10">
              {/* Mute button */}
              <div className="flex flex-col items-center gap-3">
                <IconButton
                  onClick={onToggleMute}
                  className={`rounded-full w-14 h-14 ${
                    isMuted
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-gray-700 hover:bg-gray-600 dark:bg-black-200"
                  }`}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </IconButton>
                <span className="text-white text-xs">{isMuted ? "Unmute" : "Mute"}</span>
              </div>

              {/* Video button (only for video calls) */}
              {callType === "video" && (
                <div className="flex flex-col items-center gap-3">
                  <IconButton
                    onClick={onToggleCamera}
                    className={`rounded-full w-14 h-14 ${
                      isCameraOff
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-gray-700 hover:bg-gray-600 dark:bg-black-200"
                    }`}
                  >
                    {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </IconButton>
                  <span className="text-white text-xs">
                    {isCameraOff ? "Camera" : "Camera"}
                  </span>
                </div>
              )}

              {/* End call button */}
              <div className="flex flex-col items-center gap-3">
                <IconButton
                  onClick={onEnd}
                  className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  <ImPhoneHangUp size={24} />
                </IconButton>
                <span className="text-white text-sm">End</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}