import { useState, useRef, useCallback, useEffect } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

const APP_ID = process.env.REACT_APP_AGORA_APP_ID || "1ee5d2968dfb469aabebb1a1d41581cc";

export const useCallHook = ({ socket, chatId, currentUserId, currentUserType }) => {
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteUsers, setRemoteUsers] = useState([]);

  const clientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const callIdRef = useRef(null);
  const tokenRef = useRef(null); // Store token

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

      if (clientRef.current) {
        await clientRef.current.leave();
      }
    } catch (err) {
      console.warn("Cleanup error:", err);
    }

    localAudioTrackRef.current = null;
    localVideoTrackRef.current = null;
    clientRef.current = null;
    tokenRef.current = null; // Clear token

    setCallState("idle");
    setCallType(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
    setRemoteUsers([]);
    callIdRef.current = null;
  }, []);

  const joinAgoraChannel = useCallback(async (channelName, type, token) => {
    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
          setRemoteUsers((prev) => {
            const exists = prev.find((u) => u.uid === user.uid);
            return exists ? prev : [...prev, user];
          });
        }

        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      client.on("user-unpublished", (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      client.on("user-left", (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      // Use token from backend
      await client.join(APP_ID, channelName, token, 0);

      if (type === "voice") {
        localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
        await client.publish([localAudioTrackRef.current]);
      } else {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;
        await client.publish([audioTrack, videoTrack]);
      }

      setCallState("active");
      setCallType(type);
      startCallTimer();

      console.log(` Joined Agora channel: ${channelName} as ${type}`);
    } catch (error) {
      console.error("Error joining Agora channel:", error);
      endCallCleanup();
    }
  }, [endCallCleanup]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log("Incoming call:", data);
      if (callState !== "idle") return;

      //  Store token from incoming call
      tokenRef.current = data.token;

      setIncomingCall(data);
      setCallType(data.callType);
      setCallState("incoming");
    };

    const handleCallToken = (data) => {
      console.log("Received call token:", data);
      tokenRef.current = data.token;
    };

    const handleCallAccepted = async (data) => {
      console.log(" Call accepted:", data);
      if (callState !== "outgoing") return;

      //  Use stored token from when we initiated the call
      await joinAgoraChannel(data.channelName, data.callType, tokenRef.current);
    };

    const handleCallDeclined = () => {
      console.log("❌ Call declined");
      setCallState("idle");
      setCallType(null);
      setIncomingCall(null);
      tokenRef.current = null;
    };

    const handleCallEnded = () => {
      console.log("📴 Call ended by other party");
      endCallCleanup();
    };

    socket.on("incomingCall", handleIncomingCall);
    socket.on("callToken", handleCallToken);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("callDeclined", handleCallDeclined);
    socket.on("callEnded", handleCallEnded);

    return () => {
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callToken", handleCallToken);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("callDeclined", handleCallDeclined);
      socket.off("callEnded", handleCallEnded);
    };
  }, [socket, callState, joinAgoraChannel, endCallCleanup]);

  

  const initiateCall = useCallback(async (type, receiverId, receiverType) => {
    console.log("=== initiateCall ===");
    console.log("type:", type);
    console.log("receiverId:", receiverId);
    console.log("receiverType:", receiverType);
    console.log("chatId:", chatId);

    if (!socket) {
      console.log(" BLOCKED - socket not connected");
      return;
    }

    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const channelName = chatId;

    callIdRef.current = callId;
    setCallType(type);
    setCallState("outgoing");

    //  Backend will generate token and send it back via incomingCall event
    socket.emit("initiateCall", {
      callId,
      chatId,
      callType: type,
      callerId: currentUserId,
      callerType: currentUserType,
      receiverId,
      receiverType,
      channelName,
    });

    console.log(` Initiating ${type} call to ${receiverId}`);
  }, [socket, chatId, currentUserId, currentUserType]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    socket.emit("acceptCall", {
      callId: incomingCall.callId,
      chatId,
      callType: incomingCall.callType,
      channelName: incomingCall.channelName,
      receiverId: currentUserId,
      callerId: incomingCall.callerId,
      callerType: incomingCall.callerType,
    });

    //  Use token from incoming call
    await joinAgoraChannel(incomingCall.channelName, incomingCall.callType, tokenRef.current);
    setIncomingCall(null);
  }, [incomingCall, socket, chatId, currentUserId, joinAgoraChannel]);

  const declineCall = useCallback(() => {
    if (!incomingCall) return;

    socket.emit("declineCall", {
      callId: incomingCall.callId,
      chatId,
      callerId: incomingCall.callerId,
      callerType: incomingCall.callerType,
      receiverId: currentUserId,
    });

    setCallState("idle");
    setCallType(null);
    setIncomingCall(null);
    tokenRef.current = null;
  }, [incomingCall, socket, chatId, currentUserId]);

  const endCall = useCallback(() => {
    const duration = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    socket.emit("endCall", {
      callId: callIdRef.current,
      chatId,
      callerId: currentUserId,
      callerType: currentUserType,
      duration,
      callType,
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
    callDuration,
    formattedDuration: formatDuration(callDuration),
    remoteUsers,
    localVideoTrack: localVideoTrackRef.current,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};