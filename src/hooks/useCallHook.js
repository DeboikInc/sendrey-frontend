import { useState, useRef, useCallback, useEffect } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;

const ROLE  = { CALLER: "caller", RECEIVER: "receiver" };
const STATE = { IDLE: "idle", OUTGOING: "outgoing", INCOMING: "incoming", ACTIVE: "active" };

export const useCallHook = ({ socket, chatId, currentUserId, currentUserType }) => {
  const [callState,      setCallState]      = useState(STATE.IDLE);
  const [callType,       setCallType]       = useState(null);
  const [incomingCall,   setIncomingCall]   = useState(null);
  const [isMuted,        setIsMuted]        = useState(false);
  const [isCameraOff,    setIsCameraOff]    = useState(false);
  const [isSpeakerOn,    setIsSpeakerOn]    = useState(true);
  const [callDuration,   setCallDuration]   = useState(0);
  const [remoteUsers,    setRemoteUsers]    = useState([]);
  const [networkQuality, setNetworkQuality] = useState("good");
  const [facingMode,     setFacingMode]     = useState("user");
  const [isConnecting,   setIsConnecting]   = useState(false); // ← overlay flag
  const [callError,      setCallError]      = useState(null);  // ← error flag

  const callStateRef     = useRef(STATE.IDLE);
  const callTypeRef      = useRef(null);
  const roleRef          = useRef(null);
  const callIdRef        = useRef(null);
  const channelNameRef   = useRef(null);
  const tokenRef         = useRef(null);
  const incomingCallRef  = useRef(null);

  const clientRef          = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const prewarmedAudioRef  = useRef(null);
  const prewarmedVideoRef  = useRef(null);
  const preWarmAbortRef    = useRef(false);

  const callTimerRef     = useRef(null);
  const callStartTimeRef = useRef(null);
  const isJoiningRef     = useRef(false);

  const endCallCleanupRef   = useRef(null);
  const joinAgoraChannelRef = useRef(null);

  useEffect(() => { callStateRef.current    = callState;    }, [callState]);
  useEffect(() => { callTypeRef.current     = callType;     }, [callType]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().catch(() => {});
    return () => ctx.close().catch(() => {});
  }, []);

  const startCallTimer = useCallback(() => {
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
  }, []);

  const discardPrewarmedTracks = useCallback(() => {
    preWarmAbortRef.current = true;
    if (prewarmedAudioRef.current) {
      try { prewarmedAudioRef.current.stop(); prewarmedAudioRef.current.close(); } catch (_) {}
      prewarmedAudioRef.current = null;
    }
    if (prewarmedVideoRef.current) {
      try { prewarmedVideoRef.current.stop(); prewarmedVideoRef.current.close(); } catch (_) {}
      prewarmedVideoRef.current = null;
    }
  }, []);

  const preWarmTracks = useCallback(async (type) => {
    preWarmAbortRef.current = false;
    try {
      if (type === "voice") {
        const audio = await AgoraRTC.createMicrophoneAudioTrack();
        if (preWarmAbortRef.current) { audio.stop(); audio.close(); return; }
        prewarmedAudioRef.current = audio;
      } else {
        const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks({}, { facingMode: "user" });
        if (preWarmAbortRef.current) { audio.stop(); audio.close(); video.stop(); video.close(); return; }
        prewarmedAudioRef.current = audio;
        prewarmedVideoRef.current = video;
      }
    } catch (err) {
      console.warn("[useCallHook] preWarmTracks error:", err);
    }
  }, []);

  const endCallCleanup = useCallback(async () => {
    stopCallTimer();
    discardPrewarmedTracks();
    isJoiningRef.current   = false;
    roleRef.current        = null;
    callIdRef.current      = null;
    channelNameRef.current = null;
    tokenRef.current       = null;

    try {
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      if (clientRef.current) await clientRef.current.leave();
    } catch (err) {
      console.warn("[useCallHook] cleanup error:", err);
    }

    localAudioTrackRef.current = null;
    localVideoTrackRef.current = null;
    clientRef.current          = null;

    setCallState(STATE.IDLE);
    setCallType(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOn(true);
    setCallDuration(0);
    setRemoteUsers([]);
    setNetworkQuality("good");
    setFacingMode("user");
    setIsConnecting(false);
    setCallError(null);
  }, [stopCallTimer, discardPrewarmedTracks]);

  useEffect(() => { endCallCleanupRef.current = endCallCleanup; }, [endCallCleanup]);

  // ── Core join ──────────────────────────────────────────────────────────────
  const joinAgoraChannel = useCallback(async (channelName, type, token) => {
    if (isJoiningRef.current) {
      console.warn("[useCallHook] already joining, skip");
      return;
    }
    if (clientRef.current) {
      console.warn("[useCallHook] already have client, skip");
      return;
    }

    isJoiningRef.current = true;
    setCallError(null);
    console.log("[useCallHook] joining →", { channelName, type });

    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("network-quality", ({ downlinkNetworkQuality: d }) => {
        setNetworkQuality(d <= 2 ? "good" : d <= 4 ? "fair" : "poor");
      });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          setRemoteUsers(prev => prev.find(u => u.uid === user.uid) ? prev : [...prev, user]);
        }
        if (mediaType === "audio") user.audioTrack?.play();
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });

      client.on("user-left", (user) => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });

      await client.join(APP_ID, channelName, token, null);

      if (type === "voice") {
        const audio = prewarmedAudioRef.current ?? await AgoraRTC.createMicrophoneAudioTrack();
        prewarmedAudioRef.current  = null;
        localAudioTrackRef.current = audio;
        await client.publish([audio]);
      } else {
        let audio = prewarmedAudioRef.current;
        let video = prewarmedVideoRef.current;
        prewarmedAudioRef.current = null;
        prewarmedVideoRef.current = null;
        if (!audio || !video) {
          [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks({}, { facingMode: "user" });
        }
        localAudioTrackRef.current = audio;
        localVideoTrackRef.current = video;
        await client.publish([audio, video]);
      }

      isJoiningRef.current = false;
      setIsConnecting(false); // ← Agora done, hide overlay
      startCallTimer();
      console.log("[useCallHook] ✅ joined and published");

    } catch (error) {
      console.error("[useCallHook] join failed:", error);
      isJoiningRef.current = false;
      setIsConnecting(false);

      // Map Agora error codes to friendly messages
      const msg = error?.code === "PERMISSION_DENIED"
        ? "Microphone/camera permission denied. Please allow access and try again."
        : error?.code === "TIMEOUT" || error?.message?.includes("timeout")
        ? "Connection timed out. Check your internet and try again."
        : error?.code === "UID_CONFLICT"
        ? "Already in a call on another device."
        : "Failed to connect. Please try again.";

      setCallError(msg);

      // Auto-dismiss error and hang up after 4 seconds
      setTimeout(() => {
        endCallCleanupRef.current?.();
      }, 4000);
    }
  }, [startCallTimer]);

  useEffect(() => { joinAgoraChannelRef.current = joinAgoraChannel; }, [joinAgoraChannel]);

  // ── Socket: reset events ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleCallEnded = () => {
      console.log("[useCallHook] callEnded");
      endCallCleanupRef.current?.();
    };

    const handleReset = () => {
      discardPrewarmedTracks();
      isJoiningRef.current   = false;
      roleRef.current        = null;
      tokenRef.current       = null;
      channelNameRef.current = null;
      setCallState(STATE.IDLE);
      setCallType(null);
      setIncomingCall(null);
      setIsConnecting(false);
      setCallError(null);
    };

    socket.on("callEnded",    handleCallEnded);
    socket.on("callDeclined", handleReset);
    socket.on("callMissed",   handleReset);
    socket.on("callRejected", handleReset);

    return () => {
      socket.off("callEnded",    handleCallEnded);
      socket.off("callDeclined", handleReset);
      socket.off("callMissed",   handleReset);
      socket.off("callRejected", handleReset);
    };
  }, [socket, discardPrewarmedTracks]);

  // ── Socket: call-flow events (registered once, all state via refs) ─────────
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log("[useCallHook] incomingCall | state:", callStateRef.current);

      if (callStateRef.current !== STATE.IDLE) {
        socket.emit("rejectCall", {
          callId: data.callId, chatId: data.chatId,
          callerId: data.callerId, callerType: data.callerType,
          receiverId: currentUserId, receiverType: currentUserType,
        });
        return;
      }

      callIdRef.current      = data.callId;
      channelNameRef.current = data.channelName;
      tokenRef.current       = data.token;
      roleRef.current        = ROLE.RECEIVER;

      setCallType(data.callType);
      setIncomingCall(data);
      setCallState(STATE.INCOMING);
      preWarmTracks(data.callType);
    };

    const handleCallToken = (data) => {
      console.log("[useCallHook] callToken | channel:", data.channelName);
      tokenRef.current       = data.token;
      channelNameRef.current = data.channelName;
    };

    const handleCallAccepted = async (data) => {
      console.log("[useCallHook] callAccepted | role:", roleRef.current, "| state:", callStateRef.current);

      if (roleRef.current !== ROLE.CALLER) {
        console.log("[useCallHook] callAccepted — not caller, ignoring");
        return;
      }
      if (isJoiningRef.current || clientRef.current) {
        console.warn("[useCallHook] callAccepted — already joining");
        return;
      }

      const channel = data.channelName || channelNameRef.current;
      const type    = data.callType    || callTypeRef.current;
      const token   = tokenRef.current;

      if (!channel || !token) {
        console.error("[useCallHook] callAccepted — missing channel or token", { channel, token });
        setCallError("Could not connect — missing call credentials.");
        setTimeout(() => endCallCleanupRef.current?.(), 3000);
        return;
      }

      // ← Switch outgoing → active UI immediately before the async Agora work
      setIsConnecting(true);
      setCallState(STATE.ACTIVE);
      setCallType(type);

      await joinAgoraChannelRef.current(channel, type, token);
    };

    socket.on("incomingCall",  handleIncomingCall);
    socket.on("callToken",     handleCallToken);
    socket.on("callAccepted",  handleCallAccepted);

    return () => {
      socket.off("incomingCall",  handleIncomingCall);
      socket.off("callToken",     handleCallToken);
      socket.off("callAccepted",  handleCallAccepted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const initiateCall = useCallback((type, receiverId, receiverType) => {
    if (!socket) return;
    if (callStateRef.current !== STATE.IDLE) return;

    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    callIdRef.current = callId;
    roleRef.current   = ROLE.CALLER;

    setCallType(type);
    setCallState(STATE.OUTGOING);
    setCallError(null);

    socket.emit("initiateCall", {
      callId, chatId, callType: type,
      callerId: currentUserId, callerType: currentUserType,
      receiverId, receiverType,
      channelName: chatId,
    });

    preWarmTracks(type);
  }, [socket, chatId, currentUserId, currentUserType, preWarmTracks]);

  const acceptCall = useCallback(async (incomingData) => {
    const call = incomingData || incomingCallRef.current;
    if (!call) { console.warn("[useCallHook] acceptCall: no call data"); return; }
    if (isJoiningRef.current || clientRef.current) {
      console.warn("[useCallHook] acceptCall: already joining");
      return;
    }

    const channel = call.channelName || channelNameRef.current;
    const token   = call.token       || tokenRef.current;
    const type    = call.callType    || callTypeRef.current;

    if (!channel || !token) {
      console.error("[useCallHook] acceptCall: missing channel or token", { channel, token });
      setCallError("Could not connect — missing call credentials.");
      setTimeout(() => endCallCleanupRef.current?.(), 3000);
      return;
    }

    socket.emit("acceptCall", {
      callId:       call.callId,
      chatId:       call.chatId || chatId,
      callType:     type,
      channelName:  channel,
      receiverId:   currentUserId,
      receiverType: currentUserType,
      callerId:     call.callerId,
      callerType:   call.callerType,
    });

    // ← Transition UI immediately, show connecting overlay, then do Agora work
    setIncomingCall(null);
    setIsConnecting(true);
    setCallState(STATE.ACTIVE);
    setCallType(type);

    await joinAgoraChannelRef.current(channel, type, token);
  }, [socket, chatId, currentUserId, currentUserType]);

  const declineCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;

    discardPrewarmedTracks();
    socket.emit("declineCall", {
      callId:       call.callId,
      chatId:       call.chatId || chatId,
      callerId:     call.callerId,
      callerType:   call.callerType,
      receiverId:   currentUserId,
      receiverType: currentUserType,
    });

    tokenRef.current       = null;
    channelNameRef.current = null;
    roleRef.current        = null;

    setCallState(STATE.IDLE);
    setCallType(null);
    setIncomingCall(null);
    setCallError(null);
  }, [socket, chatId, currentUserId, currentUserType, discardPrewarmedTracks]);

  const endCall = useCallback(() => {
    const duration = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    if (callStateRef.current === STATE.OUTGOING) {
      socket.emit("missedCall", {
        callId:     callIdRef.current,
        chatId,
        callerId:   currentUserId,
        callerType: currentUserType,
        callType:   callTypeRef.current,
      });
    } else {
      socket.emit("endCall", {
        callId:     callIdRef.current,
        chatId,
        callerId:   currentUserId,
        callerType: currentUserType,
        duration,
        callType:   callTypeRef.current,
      });
    }

    endCallCleanupRef.current?.();
  }, [socket, chatId, currentUserId, currentUserType]);

  const toggleMute = useCallback(async () => {
    if (!localAudioTrackRef.current) return;
    const next = !isMuted;
    await localAudioTrackRef.current.setEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!localVideoTrackRef.current) return;
    const next = !isCameraOff;
    await localVideoTrackRef.current.setEnabled(!next);
    setIsCameraOff(next);
  }, [isCameraOff]);

  const switchCamera = useCallback(async () => {
    if (!localVideoTrackRef.current || !clientRef.current) return;
    try {
      const newFacing = facingMode === "user" ? "environment" : "user";
      const newTrack  = await AgoraRTC.createCameraVideoTrack({ facingMode: newFacing });
      await clientRef.current.unpublish([localVideoTrackRef.current]);
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = newTrack;
      await clientRef.current.publish([newTrack]);
      setFacingMode(newFacing);
    } catch (err) { console.error("[useCallHook] switchCamera error:", err); }
  }, [facingMode]);

  const toggleSpeaker = useCallback(() => setIsSpeakerOn(p => !p), []);

  const formatDuration = (s) => {
    const m   = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return {
    callState, callType, incomingCall,
    isMuted, isCameraOff, isSpeakerOn,
    callDuration, formattedDuration: formatDuration(callDuration),
    remoteUsers, localVideoTrack: localVideoTrackRef.current,
    networkQuality, facingMode,
    isConnecting, callError,
    initiateCall, acceptCall, declineCall, endCall,
    toggleMute, toggleCamera, switchCamera, toggleSpeaker,
  };
};