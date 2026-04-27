import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff,
  RotateCcw, Volume2, VolumeX,
  WifiOff, WifiLow,
} from "lucide-react";
import { ImPhoneHangUp } from "react-icons/im";
import { IoCall } from "react-icons/io5";
import BarLoader from "./BarLoader";

const RED   = "#e24b4a";
const AMBER = "#ef9f27";

const SOUNDS = {
  ringing: (() => { const a = new Audio("/sounds/phone-ringing.mp3"); a.loop = true; a.load(); return a; })(),
  dialing: (() => { const a = new Audio("/sounds/phone-dialing.mp3"); a.loop = true; a.load(); return a; })(),
};
const playRingingSound = () => { SOUNDS.ringing.currentTime = 0; SOUNDS.ringing.play().catch(() => {}); };
const stopRingingSound = () => { SOUNDS.ringing.pause(); SOUNDS.ringing.currentTime = 0; };
const playDialingSound = () => { SOUNDS.dialing.currentTime = 0; SOUNDS.dialing.play().catch(() => {}); };
const stopDialingSound = () => { SOUNDS.dialing.pause(); SOUNDS.dialing.currentTime = 0; };

const PulseRing = ({ size = 140 }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    {[1, 2, 3].map(i => (
      <div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping"
        style={{ animationDuration: `${1.2 + i * 0.4}s`, animationDelay: `${i * 0.2}s` }}
      />
    ))}
    <div className="absolute inset-0 rounded-full bg-primary/15" />
  </div>
);

const Avatar = ({ name, avatar, size = 96 }) => (
  <div
    className="rounded-full overflow-hidden border-4 border-white/20 flex-shrink-0 bg-primary flex items-center justify-center z-10 relative"
    style={{ width: size, height: size }}
  >
    {avatar
      ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
      : <span className="text-white font-medium" style={{ fontSize: size * 0.38 }}>
          {name?.charAt(0)?.toUpperCase() || "?"}
        </span>
    }
  </div>
);

const ControlBtn = ({ onPress, bg, children, label, size = 52, disabled }) => (
  <div className="flex flex-col items-center gap-1.5">
    <button
      onClick={onPress}
      disabled={disabled}
      className="rounded-full flex items-center justify-center outline-none transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ width: size, height: size, background: bg || "rgba(255,255,255,0.12)" }}
    >
      {children}
    </button>
    {label && <span className="text-[11px] text-white/50 whitespace-nowrap">{label}</span>}
  </div>
);

const NetworkIndicator = ({ quality }) => {
  if (quality === "good") return null;
  const map = {
    fair:         { color: AMBER, label: "Fair connection",  Icon: WifiLow },
    poor:         { color: RED,   label: "Poor connection",  Icon: WifiOff },
    reconnecting: { color: RED,   label: "Reconnecting...", Icon: WifiOff },
  };
  const { color, label, Icon } = map[quality] || map.poor;
  return (
    <div className="inline-flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1 mt-2">
      <Icon size={11} color={color} />
      <span className="text-[11px]" style={{ color }}>{label}</span>
    </div>
  );
};

// ── Connecting overlay ─────────────────────────────────────────────────────────
const ConnectingOverlay = () => (
  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-4">
    <BarLoader />
    <p className="text-white text-base font-medium">Connecting...</p>
  </div>
);

// ── Error overlay ──────────────────────────────────────────────────────────────
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

export default function VideoCallScreen({
  callState,
  callType,
  callerName,
  callerAvatar,
  isMuted,
  isCameraOff,
  isSpeakerOn,
  formattedDuration,
  remoteUsers,
  localVideoTrack,
  networkQuality = "good",
  isConnecting   = false,
  callError      = null,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleSpeaker,
}) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef    = useRef(null);
  const soundStartedRef = useRef(false);

  // PiP drag
  const [pipPos, setPipPos] = useState({ x: null, y: null });
  const pipRef    = useRef(null);
  const dragState = useRef(null);

  // ── Sounds ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "idle") return;
    if (callState === "incoming" && !soundStartedRef.current) {
      soundStartedRef.current = true;
      playRingingSound();
    } else if (callState === "outgoing" && !soundStartedRef.current) {
      soundStartedRef.current = true;
      playDialingSound();
    } else if (callState === "active") {
      if (soundStartedRef.current) {
        stopRingingSound();
        stopDialingSound();
        soundStartedRef.current = false;
      }
    }
    return () => {
      if (callState === "incoming" || callState === "outgoing") {
        stopRingingSound();
        stopDialingSound();
        soundStartedRef.current = false;
      }
    };
  }, [callState]);

  // ── Video tracks ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && callType === "video") {
      localVideoTrack.play(localVideoRef.current);
    }
    return () => { localVideoTrack?.stop(); };
  }, [localVideoTrack, callType]);

  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const user = remoteUsers[0];
      if (user.videoTrack) user.videoTrack.play(remoteVideoRef.current);
    }
  }, [remoteUsers]);

  // ── Auto-hide controls ────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (callState === "active" && callType === "video") {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 5000);
    }
  }, [callState, callType]);

  useEffect(() => {
    setControlsVisible(true);
    resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [callState, resetHideTimer]);

  const handleTap = () => {
    if (callState === "active" && callType === "video") {
      setControlsVisible(v => { if (!v) resetHideTimer(); return !v; });
    }
  };

  // ── PiP drag ──────────────────────────────────────────────────────────────
  const onPipPointerDown = (e) => {
    e.stopPropagation();
    const rect = pipRef.current.getBoundingClientRect();
    dragState.current = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    pipRef.current.setPointerCapture(e.pointerId);
  };
  const onPipPointerMove = (e) => {
    if (!dragState.current) return;
    e.stopPropagation();
    const parent = pipRef.current.parentElement.getBoundingClientRect();
    const pip    = pipRef.current.getBoundingClientRect();
    let nx = e.clientX - parent.left - dragState.current.startX;
    let ny = e.clientY - parent.top  - dragState.current.startY;
    nx = Math.max(0, Math.min(nx, parent.width  - pip.width));
    ny = Math.max(0, Math.min(ny, parent.height - pip.height));
    setPipPos({ x: nx, y: ny });
  };
  const onPipPointerUp = (e) => { e.stopPropagation(); dragState.current = null; };

  const isVideoActive  = callType === "video" && callState === "active";
  const isReconnecting = networkQuality === "reconnecting";
  const showRemoteVideo = isVideoActive && remoteUsers.length > 0 && remoteUsers[0]?.videoTrack;
  const isIncoming = callState === "incoming";
  const isOutgoing = callState === "outgoing";
  const isActive   = callState === "active";
  const isVideoCall = callType === "video";

  const pipStyle = pipPos.x !== null
    ? { left: pipPos.x, top: pipPos.y, right: "auto", bottom: "auto" }
    : { top: 110, right: 14 };

  return (
    <div
      onClick={handleTap}
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        background: (isIncoming && isVideoCall)
          ? "linear-gradient(160deg, #0f1a2e 0%, #1a0f2e 50%, #0d1f1a 100%)"
          : "#000",
      }}
    >
      {/* Remote video */}
      {showRemoteVideo && <div ref={remoteVideoRef} className="absolute inset-0 z-0" />}

      {/* Background scrim */}
      {!showRemoteVideo && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      )}

      {/* Reconnecting overlay */}
      {isReconnecting && (
        <div className="absolute inset-0 z-30 bg-black/70 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-white text-base font-medium">Reconnecting...</p>
        </div>
      )}

      {/* Error / Connecting overlays — above everything including reconnecting */}
      {callError    && <ErrorOverlay message={callError} />}
      {!callError  && isConnecting && <ConnectingOverlay />}

      {/* Main content */}
      <div className="relative z-10 flex flex-col h-full">

        {/* INCOMING VIDEO */}
        {isIncoming && isVideoCall && (
          <>
            <div className="flex flex-col items-center pt-16 pb-4 px-6">
              <p className="text-white/60 text-sm font-medium mb-3 tracking-wide uppercase">
                Incoming video call
              </p>
              <div className="relative flex items-center justify-center mb-4">
                <PulseRing size={160} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Avatar name={callerName} avatar={callerAvatar} size={108} />
                </div>
              </div>
              <p className="text-white text-2xl font-semibold mt-2 text-center">
                {callerName || "Unknown"}
              </p>
            </div>
            <div className="flex justify-center mt-2">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-4 py-2">
                <Video size={14} className="text-white/70" />
                <span className="text-white/70 text-sm">Video call</span>
              </div>
            </div>
            <div className="mt-auto pb-16 px-12">
              <p className="text-white/40 text-xs text-center mb-8">
                Swipe up to accept, swipe down to decline
              </p>
              <div className="flex justify-between items-end">
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => { stopRingingSound(); onDecline(); }}
                    className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: "#e24b4a" }}
                  >
                    <ImPhoneHangUp size={30} color="white" />
                  </button>
                  <span className="text-white/70 text-sm font-medium">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => { stopRingingSound(); onAccept(); }}
                    className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform relative overflow-hidden"
                    style={{ background: "#22c55e" }}
                  >
                    <div className="absolute inset-0 opacity-30" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)" }} />
                    <Video size={30} color="white" />
                  </button>
                  <span className="text-white/70 text-sm font-medium">Accept</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* INCOMING VOICE */}
        {isIncoming && !isVideoCall && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 z-20">
              <div className="relative flex items-center justify-center">
                <PulseRing size={160} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Avatar name={callerName} avatar={callerAvatar} size={108} />
                </div>
              </div>
              <p className="text-white text-2xl font-semibold text-center">{callerName}</p>
              <p className="text-primary text-sm" style={{ animation: "pulse-text 1.5s ease-in-out infinite" }}>
                Incoming call...
              </p>
            </div>
            <div className="pb-16 px-12">
              <div className="flex justify-between items-end">
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => { stopRingingSound(); onDecline(); }}
                    className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: "#e24b4a" }}
                  >
                    <ImPhoneHangUp size={30} color="white" />
                  </button>
                  <span className="text-white/70 text-sm font-medium">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => { stopRingingSound(); onAccept(); }}
                    className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ background: "#22c55e" }}
                  >
                    <IoCall size={30} color="white" />
                  </button>
                  <span className="text-white/70 text-sm font-medium">Accept</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* OUTGOING */}
        {isOutgoing && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 z-20">
              <div className="relative flex items-center justify-center">
                <PulseRing size={160} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Avatar name={callerName} avatar={callerAvatar} size={108} />
                </div>
              </div>
              <p className="text-white text-2xl font-semibold text-center">{callerName}</p>
              <p className="text-white/50 text-sm">
                {isVideoCall ? "Calling (video)..." : "Calling..."}
              </p>
            </div>
            <div className="pb-16 flex justify-center">
              <ControlBtn
                onPress={() => { stopDialingSound(); onEnd(); }}
                bg="#e24b4a"
                size={72}
                label="Cancel"
              >
                <ImPhoneHangUp size={28} color="white" />
              </ControlBtn>
            </div>
          </>
        )}

        {/* ACTIVE */}
        {isActive && (
          <>
            {controlsVisible && (
              <div className={`pt-12 px-5 pb-4 ${isVideoActive ? "bg-gradient-to-b from-black/70 to-transparent" : ""}`}>
                <p className="text-white text-lg font-semibold">{callerName}</p>
                <div className="flex items-center gap-2 mt-1">
                  {isVideoCall && (
                    <span className="text-white/50 text-xs">
                      <Video size={11} className="inline mr-1 opacity-60" />
                      Video call
                    </span>
                  )}
                  {/* Show timer only once actually connected */}
                  {!isConnecting && (
                    <p className="text-primary text-sm font-mono">{formattedDuration}</p>
                  )}
                </div>
                <NetworkIndicator quality={networkQuality} />
              </div>
            )}

            {!isVideoActive && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Avatar name={callerName} avatar={callerAvatar} size={108} />
              </div>
            )}

            {/* PiP */}
            {isVideoActive && (
              <div
                ref={pipRef}
                onPointerDown={onPipPointerDown}
                onPointerMove={onPipPointerMove}
                onPointerUp={onPipPointerUp}
                onClick={e => e.stopPropagation()}
                className="absolute z-20 w-[88px] h-[120px] rounded-2xl overflow-hidden border border-primary/40 bg-black-200 cursor-grab touch-none"
                style={pipStyle}
              >
                <div ref={localVideoRef} className="absolute inset-0" />
                {isCameraOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black-200">
                    <VideoOff size={20} color="rgba(255,255,255,0.4)" />
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div
              className={`mt-auto pb-10 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
              style={{ pointerEvents: controlsVisible ? "auto" : "none" }}
            >
              <div className="mx-4 bg-white/8 backdrop-blur-sm rounded-3xl py-5 px-4 border border-white/10">
                <div className="flex justify-around items-center">
                  <ControlBtn
                    onPress={onToggleMute}
                    bg={isMuted ? "rgba(226,75,74,0.3)" : "rgba(255,255,255,0.12)"}
                    label={isMuted ? "Unmute" : "Mute"}
                    disabled={isConnecting}
                  >
                    {isMuted ? <MicOff size={20} color={RED} /> : <Mic size={20} color="white" />}
                  </ControlBtn>

                  {isVideoCall && (
                    <ControlBtn
                      onPress={onToggleCamera}
                      bg={isCameraOff ? "rgba(226,75,74,0.3)" : "rgba(255,255,255,0.12)"}
                      label={isCameraOff ? "Camera on" : "Camera off"}
                      disabled={isConnecting}
                    >
                      {isCameraOff ? <VideoOff size={20} color={RED} /> : <Video size={20} color="white" />}
                    </ControlBtn>
                  )}

                  <ControlBtn onPress={onEnd} bg="#e24b4a" size={62} label="End">
                    <ImPhoneHangUp size={24} color="white" />
                  </ControlBtn>

                  <ControlBtn
                    onPress={onToggleSpeaker}
                    bg={isSpeakerOn ? "rgba(80,200,120,0.25)" : "rgba(255,255,255,0.12)"}
                    label={isSpeakerOn ? "Speaker" : "Earpiece"}
                    disabled={isConnecting}
                  >
                    {isSpeakerOn ? <Volume2 size={20} color="#4ade80" /> : <VolumeX size={20} color="white" />}
                  </ControlBtn>

                  {isVideoCall && (
                    <ControlBtn
                      onPress={onSwitchCamera}
                      bg="rgba(255,255,255,0.12)"
                      label="Flip"
                      disabled={isConnecting}
                    >
                      <RotateCcw size={20} color="white" />
                    </ControlBtn>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse-text { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>
    </div>
  );
}