import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    Mic, MicOff, Video, VideoOff,
    RotateCcw, Volume2, VolumeX,
    WifiOff, WifiLow,
} from "lucide-react";
import { ImPhoneHangUp } from "react-icons/im";
import { IoCall } from "react-icons/io5";

const RED = "#e24b4a";
const AMBER = "#ef9f27";

// Audio contexts for sound effects
let ringingAudio = null;
let dialingAudio = null;

const playRingingSound = () => {
    if (ringingAudio) {
        ringingAudio.pause();
        ringingAudio.currentTime = 0;
    }
    ringingAudio = new Audio("/sounds/phone-ringing.mp3");
    ringingAudio.loop = true;
    ringingAudio.play().catch(e => console.log("Audio play failed:", e));
};

const stopRingingSound = () => {
    if (ringingAudio) {
        ringingAudio.pause();
        ringingAudio.currentTime = 0;
        ringingAudio = null;
    }
};

const playDialingSound = () => {
    if (dialingAudio) {
        dialingAudio.pause();
        dialingAudio.currentTime = 0;
    }
    dialingAudio = new Audio("/sounds/phone-dialing.mp3");
    dialingAudio.loop = true;
    dialingAudio.play().catch(e => console.log("Audio play failed:", e));
};

const stopDialingSound = () => {
    if (dialingAudio) {
        dialingAudio.pause();
        dialingAudio.currentTime = 0;
        dialingAudio = null;
    }
};

const Avatar = ({ name, avatar, size = 96, isRinging = false }) => (
    <div className="relative">
        <div 
            className="rounded-full overflow-hidden border-4 border-primary/50 flex-shrink-0 bg-primary flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            {avatar
                ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                : <span className="text-white text-4xl font-medium">
                    {name?.charAt(0)?.toUpperCase() || "?"}
                </span>
            }
        </div>
        {isRinging && (
            <>
                <div className="absolute inset-0 rounded-full animate-ping bg-primary/60" />
                <div className="absolute inset-0 rounded-full animate-pulse-ring bg-primary/30" />
            </>
        )}
    </div>
);

const Btn = ({ onPress, bg, children, label, size = 52, disabled, variant = "primary" }) => {
    let buttonBg = bg || "bg-white/10";
    if (variant === "danger") buttonBg = "bg-red-600";
    if (variant === "success") buttonBg = "bg-primary";
    
    return (
        <div className="flex flex-col items-center gap-1.5">
            <button
                onClick={onPress}
                disabled={disabled}
                className="rounded-full flex items-center justify-center outline-none transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ width: size, height: size, background: buttonBg }}
            >
                {children}
            </button>
            {label && (
                <span className="text-[10px] text-white/50 whitespace-nowrap">
                    {label}
                </span>
            )}
        </div>
    );
};

const NetworkIndicator = ({ quality }) => {
    if (quality === "good") return null;
    const map = {
        fair: { color: AMBER, label: "Fair connection", Icon: WifiLow },
        poor: { color: RED, label: "Poor connection", Icon: WifiOff },
        reconnecting: { color: RED, label: "Reconnecting...", Icon: WifiOff },
    };
    const { color, label, Icon } = map[quality] || map.poor;
    return (
        <div className="inline-flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1 mt-2">
            <Icon size={11} color={color} />
            <span className="text-[11px]" style={{ color }}>{label}</span>
        </div>
    );
};

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
    onAccept,
    onDecline,
    onEnd,
    onToggleMute,
    onToggleCamera,
    onSwitchCamera,
    onToggleSpeaker,
}) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    const hideTimerRef = useRef(null);
    const soundStartedRef = useRef(false);

    // PiP drag state
    const [pipPos, setPipPos] = useState({ x: null, y: null });
    const pipRef = useRef(null);
    const dragState = useRef(null);

    // Play sound effects based on call state
    useEffect(() => {
        if (callState === "incoming" && !soundStartedRef.current) {
            soundStartedRef.current = true;
            playRingingSound();
        } else if (callState === "outgoing" && !soundStartedRef.current) {
            soundStartedRef.current = true;
            playDialingSound();
        } else if (callState === "active" || callState === "idle") {
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

    // Play video tracks
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

    // Auto-hide controls
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
            setControlsVisible(v => {
                if (!v) resetHideTimer();
                return !v;
            });
        }
    };

    // PiP drag handlers
    const onPipPointerDown = (e) => {
        e.stopPropagation();
        const rect = pipRef.current.getBoundingClientRect();
        dragState.current = {
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top,
        };
        pipRef.current.setPointerCapture(e.pointerId);
    };

    const onPipPointerMove = (e) => {
        if (!dragState.current) return;
        e.stopPropagation();
        const parent = pipRef.current.parentElement.getBoundingClientRect();
        const pip = pipRef.current.getBoundingClientRect();
        let nx = e.clientX - parent.left - dragState.current.startX;
        let ny = e.clientY - parent.top - dragState.current.startY;
        nx = Math.max(0, Math.min(nx, parent.width - pip.width));
        ny = Math.max(0, Math.min(ny, parent.height - pip.height));
        setPipPos({ x: nx, y: ny });
    };

    const onPipPointerUp = (e) => {
        e.stopPropagation();
        dragState.current = null;
    };

    const isVideoActive = callType === "video" && callState === "active";
    const isReconnecting = networkQuality === "reconnecting";
    const showRemoteVideo = isVideoActive && remoteUsers.length > 0 && remoteUsers[0]?.videoTrack;
    const isRinging = callState === "incoming" || callState === "outgoing"; // eslint-disable-line no-unused-vars

    const pipStyle = pipPos.x !== null
        ? { left: pipPos.x, top: pipPos.y, right: "auto", bottom: "auto" }
        : { top: 110, right: 14 };

    // Add keyframe animations
    const keyframes = `
        @keyframes ripple {
            0% { transform: scale(0.85); opacity: 0.9; }
            100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 0.4; }
            100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes pulse-text {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }
    `;

    return (
        <div
            onClick={handleTap}
            className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-black-100"
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
        >
            <style>{keyframes}</style>
            
            {/* Remote video fullscreen - ONLY show when video is active */}
            <div
                ref={remoteVideoRef}
                className="absolute inset-0 z-0 flex items-center justify-center bg-black-200"
            >
                {showRemoteVideo && (
                    <div ref={remoteVideoRef} className="absolute inset-0" />
                )}
            </div>

            {/* Reconnecting overlay */}
            {isReconnecting && (
                <div className="absolute inset-0 z-30 bg-black/70 flex flex-col items-center justify-center gap-4">
                    <div className="w-14 h-14 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-white text-base font-medium">Reconnecting...</p>
                </div>
            )}

            {/* Main content */}
            <div className="relative z-10 flex flex-col h-full">

                {/* Top bar - caller name and status (only during active call) */}
                {callState === "active" && controlsVisible && (
                    <div className={`pt-12 px-5 pb-5 ${isVideoActive ? 'bg-gradient-to-b from-black/70 to-transparent' : ''}`}>
                        <p className="text-white text-lg font-medium mb-0">{callerName}</p>
                        <p className="text-primary text-sm font-mono mt-1 mb-0">{formattedDuration}</p>
                        <NetworkIndicator quality={networkQuality} />
                    </div>
                )}

                {/* Center content - for incoming/outgoing states - ONLY ONE AVATAR */}
                {(callState === "incoming" || callState === "outgoing") && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 z-20">
                        <Avatar 
                            name={callerName} 
                            avatar={callerAvatar} 
                            size={120}
                            isRinging={true}
                        />
                        <p className="text-primary text-base text-center" style={{ animation: "pulse-text 1.5s ease-in-out infinite" }}>
                            {callState === "incoming" ? "Incoming call..." : "Calling..."}
                        </p>
                    </div>
                )}

                {/* PiP self-view (draggable) */}
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
                        <div className="absolute bottom-1.5 right-1.5 grid grid-cols-2 gap-0.5 opacity-40">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="w-1 h-1 rounded-full bg-white" />
                            ))}
                        </div>
                    </div>
                )}

                {/* Bottom controls */}
                <div
                    className={`pb-8 transition-opacity duration-300 mt-auto ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ pointerEvents: controlsVisible ? 'auto' : 'none' }}
                >
                    {/* INCOMING - Accept/Decline */}
                    {callState === "incoming" && (
                        <div className="flex justify-around items-center px-12 pb-6">
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={() => {
                                        stopRingingSound();
                                        onDecline();
                                    }}
                                    className="w-[68px] h-[68px] rounded-full bg-red-600 flex items-center justify-center outline-none transition-transform active:scale-95"
                                >
                                    <ImPhoneHangUp size={26} color="white" />
                                </button>
                                <span className="text-xs text-white/55">Decline</span>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={() => {
                                        stopRingingSound();
                                        onAccept();
                                    }}
                                    className="w-[68px] h-[68px] rounded-full bg-primary flex items-center justify-center outline-none transition-transform active:scale-95"
                                >
                                    <IoCall size={28} color="white" />
                                </button>
                                <span className="text-xs text-white/55">Accept</span>
                            </div>
                        </div>
                    )}

                    {/* OUTGOING - Cancel */}
                    {callState === "outgoing" && (
                        <div className="flex justify-center pb-6">
                            <Btn 
                                onPress={() => {
                                    stopDialingSound();
                                    onEnd();
                                }} 
                                variant="danger" 
                                size={68} 
                                label="Cancel"
                            >
                                <ImPhoneHangUp size={26} color="white" />
                            </Btn>
                        </div>
                    )}

                    {/* ACTIVE - Call controls */}
                    {callState === "active" && (
                        <div className="mx-4 bg-white/5 backdrop-blur-sm rounded-3xl py-4 px-2 border border-white/10">
                            <div className="flex justify-around items-center">
                                <Btn
                                    onPress={onToggleMute}
                                    bg={isMuted ? "bg-red-600/30" : "bg-white/10"}
                                    label={isMuted ? "Unmute" : "Mute"}
                                    size={52}
                                >
                                    {isMuted
                                        ? <MicOff size={20} color="#e24b4a" />
                                        : <Mic size={20} color="white" />
                                    }
                                </Btn>

                                <Btn
                                    onPress={onToggleCamera}
                                    bg={isCameraOff ? "bg-red-600/30" : "bg-white/10"}
                                    label={isCameraOff ? "Start cam" : "Stop cam"}
                                    size={52}
                                >
                                    {isCameraOff
                                        ? <VideoOff size={20} color="#e24b4a" />
                                        : <Video size={20} color="white" />
                                    }
                                </Btn>

                                <Btn
                                    onPress={onEnd}
                                    variant="danger"
                                    size={58}
                                    label="End call"
                                >
                                    <ImPhoneHangUp size={22} color="white" />
                                </Btn>

                                <Btn
                                    onPress={onToggleSpeaker}
                                    bg={isSpeakerOn ? "bg-primary/30" : "bg-white/10"}
                                    label={isSpeakerOn ? "Speaker" : "Earpiece"}
                                    size={52}
                                >
                                    {isSpeakerOn
                                        ? <Volume2 size={20} color="#F47C20" />
                                        : <VolumeX size={20} color="white" />
                                    }
                                </Btn>

                                <Btn
                                    onPress={onSwitchCamera}
                                    bg="bg-white/10"
                                    label="Flip"
                                    size={52}
                                >
                                    <RotateCcw size={20} color="white" />
                                </Btn>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}