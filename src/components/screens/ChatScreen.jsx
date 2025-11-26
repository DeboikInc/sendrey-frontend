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

const initialMessages = [
  { id: 1, from: "them", text: "Hi there, How are you?", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text: "Waiting for your reply. As I have to go back soon. I have to travel long distance.",
    time: "12:25 PM",
    status: "delivered",
  },
];

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);

export default function ChatScreen({ runner, market, userData, darkMode, toggleDarkMode, onBack }) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sidebar, setSidebar] = useState(false);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const inputRef = useRef(null);

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
      id: Date.now(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages((p) => [...p, newMsg]);
    setText("");

    // Simulate reply for demo purposes
    setTimeout(() => {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          from: "them",
          text: "Got it! I'll keep you updated on my progress.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        },
      ]);
    }, 1200);
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

    setTimeout(() => {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          from: "them",
          text: "Got it! I'll keep you updated on my progress.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        },
      ]);
    }, 1200);
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

  return (
    <div className="h-full flex flex-col">
      <Header
        title={runner.name}
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

      {/* when a runner is found */}
      <div className=" justify-left flex flex-col gap-2 items-center bg-gray-100 dark:bg-black-200 dark:text-white">
        <p className="rounded-full p-4 h-32 w-32 border border-blue-400"></p>
        <p className="text-lg ">Daniel TestRunner</p>
        <p>⭐⭐⭐⭐ <span>10+ Runs</span></p>
        <p className="bg-gray-600 p-3">
          me: Hello I am Daniel TestRunner and I will be your captain for this errand.
        </p>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200">
        <div className="mx-auto max-w-3xl">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
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