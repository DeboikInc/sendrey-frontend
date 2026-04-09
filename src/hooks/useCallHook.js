import { useState, useRef, useCallback, useEffect } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = process.env.REACT_APP_AGORA_APP_ID;

export const useCallHook = ({ socket, chatId, currentUserId, currentUserType }) => {
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [networkQuality, setNetworkQuality] = useState("good");
  const [facingMode, setFacingMode] = useState("user");

  const clientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const callIdRef = useRef(null);
  const tokenRef = useRef(null);

  const startCallTimer = () => {
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const endCallCleanup = useCallback(async () => {
    stopCallTimer();
    try {
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.stop();
      localVideoTrackRef.current?.close();
      if (clientRef.current) await clientRef.current.leave();
    } catch (err) {
      console.warn("Cleanup error:", err);
    }
    localAudioTrackRef.current = null;
    localVideoTrackRef.current = null;
    clientRef.current = null;
    tokenRef.current = null;
    setCallState("idle");
    setCallType(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOn(true);
    setCallDuration(0);
    setRemoteUsers([]);
    setNetworkQuality("good");
    setFacingMode("user");
    callIdRef.current = null;
  }, []);

  const joinAgoraChannel = useCallback(async (channelName, type, token) => {
    if (clientRef.current) return;
    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Network quality monitoring
      client.on("network-quality", (stats) => {
        const down = stats.downlinkNetworkQuality;
        if (down <= 2) setNetworkQuality("good");
        else if (down <= 4) setNetworkQuality("fair");
        else setNetworkQuality("poor");
      });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          setRemoteUsers(prev => {
            const exists = prev.find(u => u.uid === user.uid);
            return exists ? prev : [...prev, user];
          });
        }
        if (mediaType === "audio") user.audioTrack?.play();
      });

      client.on("user-unpublished", (user) => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });

      client.on("user-left", (user) => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });

      await client.join(APP_ID, channelName, token, 0);

      if (type === "voice") {
        localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
        await client.publish([localAudioTrackRef.current]);
      } else {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          {},
          { facingMode: "user" }
        );
        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;
        await client.publish([audioTrack, videoTrack]);
      }

      setCallState("active");
      setCallType(type);
      startCallTimer();
    } catch (error) {
      console.error("Error joining Agora channel:", error);
      endCallCleanup();
    }
  }, [endCallCleanup]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      if (callState !== "idle") return;
      tokenRef.current = data.token;
      setIncomingCall(data);
      setCallType(data.callType);
      setCallState("incoming");
    };

    const handleCallToken = (data) => {
      tokenRef.current = data.token;

      // Caller pre-joins here instead of waiting for callAccepted
      if (callState === 'outgoing') {
        joinAgoraChannel(data.channelName, callType, data.token);
      }
    };

    const handleCallAccepted = async (data) => {
      if (callState !== "outgoing") return;
      await joinAgoraChannel(data.channelName, data.callType, tokenRef.current);
    };

    const handleCallDeclined = () => {
      setCallState("idle");
      setCallType(null);
      setIncomingCall(null);
      tokenRef.current = null;
    };

    const handleCallEnded = () => {
      endCallCleanup();
    };

    const handleCallMissed = () => {
      setCallState("idle");
      setCallType(null);
      setIncomingCall(null);
      tokenRef.current = null;
    };

    const handleCallRejected = () => {
      setCallState("idle");
      setCallType(null);
      setIncomingCall(null);
      tokenRef.current = null;
    };

    socket.on("incomingCall", handleIncomingCall);
    socket.on("callToken", handleCallToken);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("callDeclined", handleCallDeclined);
    socket.on("callEnded", handleCallEnded);
    socket.on("callMissed", handleCallMissed);
    socket.on("callRejected", handleCallRejected);

    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callToken", handleCallToken);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("callDeclined", handleCallDeclined);
      socket.off("callEnded", handleCallEnded);
      socket.off("callMissed", handleCallMissed);
      socket.off("callRejected", handleCallRejected);
    };
  }, [socket, callState, callType, joinAgoraChannel, endCallCleanup]);

  const initiateCall = useCallback(async (type, receiverId, receiverType) => {
    if (!socket) return;
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const channelName = chatId;
    callIdRef.current = callId;
    setCallType(type);
    setCallState("outgoing");
    socket.emit("initiateCall", {
      callId, chatId, callType: type,
      callerId: currentUserId, callerType: currentUserType,
      receiverId, receiverType, channelName,
    });
    // pre join channel
    // joinAgoraChannel(channelName, type, null)
  }, [socket, chatId, currentUserId, currentUserType]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    socket.emit("acceptCall", {
      callId: incomingCall.callId, chatId,
      callType: incomingCall.callType, channelName: incomingCall.channelName,
      receiverId: currentUserId, callerId: incomingCall.callerId,
      callerType: incomingCall.callerType,
      receiverType: currentUserType,
    });
    await joinAgoraChannel(incomingCall.channelName, incomingCall.callType, tokenRef.current);
    setIncomingCall(null);
  }, [incomingCall, socket, chatId, currentUserId, currentUserType, joinAgoraChannel]);

  const declineCall = useCallback(() => {
    if (!incomingCall) return;
    socket.emit("declineCall", {
      callId: incomingCall.callId, chatId,
      callerId: incomingCall.callerId, callerType: incomingCall.callerType,
      receiverId: currentUserId, receiverType: currentUserType,
    });
    setCallState("idle");
    setCallType(null);
    setIncomingCall(null);
    tokenRef.current = null;
  }, [incomingCall, socket, chatId, currentUserId, currentUserType]);

  const endCall = useCallback(() => {
    const duration = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
    socket.emit("endCall", {
      callId: callIdRef.current, chatId,
      callerId: currentUserId, callerType: currentUserType,
      duration, callType,
    });
    endCallCleanup();
  }, [socket, chatId, currentUserId, currentUserType, callType, endCallCleanup]);

  const toggleMute = useCallback(async () => {
    if (!localAudioTrackRef.current) return;
    const newMuted = !isMuted;
    await localAudioTrackRef.current.setEnabled(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!localVideoTrackRef.current) return;
    const newCameraOff = !isCameraOff;
    await localVideoTrackRef.current.setEnabled(!newCameraOff);
    setIsCameraOff(newCameraOff);
  }, [isCameraOff]);

  // Switch front/back camera
  const switchCamera = useCallback(async () => {
    if (!localVideoTrackRef.current || !clientRef.current) return;
    try {
      const newFacing = facingMode === "user" ? "environment" : "user";
      const newVideoTrack = await AgoraRTC.createCameraVideoTrack({ facingMode: newFacing });
      await clientRef.current.unpublish([localVideoTrackRef.current]);
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = newVideoTrack;
      await clientRef.current.publish([newVideoTrack]);
      setFacingMode(newFacing);
    } catch (err) {
      console.error("switchCamera error:", err);
    }
  }, [facingMode]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => !prev);
  }, []);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return {
    callState,
    callType,
    incomingCall,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    callDuration,
    formattedDuration: formatDuration(callDuration),
    remoteUsers,
    localVideoTrack: localVideoTrackRef.current,
    networkQuality,
    facingMode,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
  };
};