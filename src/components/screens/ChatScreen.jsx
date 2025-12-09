import React, { useState, useRef, useEffect } from "react";
import {
  IconButton,
  Button,
  Input,
  Tooltip,
  Avatar
} from "@material-tailwind/react";
import {
  Phone,
  Video,
  Paperclip,
  Mic,
  Send,
  ChevronLeft,
  Square,
  MoreHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import Header from "../common/Header";
import Message from "../common/Message";
import StatusQuickReplies from "../common/StatusQuickReplies";
import CustomInput from "../common/CustomInput";
import { useSocket } from "../../hooks/useSocket";
// import 

const initialMessages = [
];

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);

export default function ChatScreen({ runner, market, userData, darkMode, toggleDarkMode, onBack, }) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sidebar, setSidebar] = useState(false);
  const [hasRunnerAccepted, setHasRunnerAccepted] = useState(false);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const inputRef = useRef(null);



  const SOCKET_URL = "http://localhost:4001";
  const { socket, joinChat, sendMessage, isConnected } = useSocket(SOCKET_URL);

  const chatId = userData?._id && runner?._id
    ? `user-${userData._id}-runner-${runner._id}`
    : null;

  useEffect(() => {
    if (socket && isConnected && chatId) {
      joinChat(
        chatId,
        (msgs) => {
          if (msgs && msgs.length > 0) {
            const formattedMsgs = msgs.map(msg => ({
              ...msg,
              from: msg.from === 'system' ? 'system' : (msg.senderId === userData?._id ? "me" : "them")
            }));
            setMessages(formattedMsgs);
          }
        },
        (msg) => {
          // ONLY add message if it's NOT from yourself
          if (msg.senderId !== userData?._id) {
            const formattedMsg = {
              ...msg,
              from: msg.from === 'system' ? 'system' : 'them'
            };
            setMessages((prev) => [...prev, formattedMsg]);
          }
        }
      );
    }
  }, [socket, chatId, isConnected, joinChat, userData?._id]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup recording interval
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const send = () => {
    if (!text.trim()) return;

    const newMsg = {
      id: Date.now().toString(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      senderId: userData?._id,
      senderType: "user"
    };

    setMessages((p) => [...p, newMsg]);
    setText("");

    // Send via socket
    if (socket) {
      sendMessage(chatId, newMsg);
    }
  };

  const handleStatusSelect = (status) => {
    const newMsg = {
      id: Date.now(),
      from: "me",
      text: status,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      type: "text"
    };

    setMessages((p) => [...p, newMsg]);

    // Send via socket
    if (socket) {
      sendMessage(chatId, newMsg);
    }
  };

  // File upload handling
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    let messageType = "file";
    if (file.type.startsWith("image/")) {
      messageType = "image";
    } else if (file.type.startsWith("audio/")) {
      messageType = "audio";
    }

    const fileSize = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    const newMsg = {
      id: Date.now(),
      from: "me",
      type: messageType,
      fileName: file.name,
      fileUrl: fileUrl,
      fileSize: fileSize,
      text: messageType === "image" ? "" : `File: ${file.name}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      file: file,
    };
    setMessages((p) => [...p, newMsg]);

    // Reset file input
    event.target.value = "";
  };

  // Voice recording handling
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        const newMsg = {
          id: Date.now(),
          from: "me",
          audioUrl: audioUrl,
          type: "audio",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "sent",
          audio: audioUrl,
        };
        setMessages((p) => [...p, newMsg]);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleDeleteMessage = (messageId) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const handleEditMessage = (messageId, newText) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, text: newText, edited: true }
          : msg
      )
    );
  };

  useEffect(() => {
    console.log('Runner data received:', runner);
    console.log('UserData received:', userData);
  }, [runner, userData]);

  return (
    <div className="h-full flex flex-col">
      <Header
        title={runner?.firstName && runner?.lastName
          ? `${runner.firstName} ${runner.lastName}`
          : runner?.firstName || runner?.lastName || "Runner"}
        showBack={true}
        onBack={onBack}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        rightActions={
          <div className="items-center gap-3 hidden sm:flex">
            <HeaderIcon tooltip="More"><MoreHorizontal className="h-6 w-6" /></HeaderIcon>
            <HeaderIcon tooltip="Video call"><Video className="h-5 w-5" /></HeaderIcon>
            <HeaderIcon tooltip="Voice call"><Phone className="h-5 w-5" /></HeaderIcon>
          </div>
        }
      />
      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 pb-24 bg-chat-pattern bg-gray-100 dark:bg-black-200">
        <div className="mx-auto max-w-3xl">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              showCursor={false}
            />
          ))}
        </div>
      </div>



      {/* Status Quick Replies for Runners */}
      {/* <StatusQuickReplies onSelect={handleStatusSelect} /> */}

      {/* Message Input */}
      <div className="w-full bg-gray-100 dark:bg-black-200 px-4 py-4">
        <div className="relative w-full">
          <CustomInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            send={send}
            showMic={true}
            showIcons={true}
            placeholder={
              isRecording ? `Recording... ${recordingTime}s` : "Type a message"
            }
            searchIcon={null}
            onMicClick={toggleRecording}
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            onAttachClick={() => fileInputRef.current?.click()}
          />

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
        </div>
      </div>


    </div>
  );
}