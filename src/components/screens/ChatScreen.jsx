import React, { useState, useRef, useEffect } from "react";
import {
  IconButton,
  Tooltip,
} from "@material-tailwind/react";
import {
  Phone,
  Video,
  MoreHorizontal,
} from "lucide-react";
import Header from "../common/Header";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";
import { useSocket } from "../../hooks/useSocket";
import InvoiceScreen from "../runnerScreens/InvoiceScreen";
import { TrackDeliveryScreen } from "./TrackDeliveryScreen";
import ProfileCardMessage from "../runnerScreens/ProfileCardMessage";

const initialMessages = [];

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

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  const [showTrackDelivery, setShowTrackDelivery] = useState(false);
  const [trackingData, setTrackingData] = useState(null);

  const isInitialLoadRef = useRef(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const { socket, joinChat, sendMessage, isConnected } = useSocket();

  const chatId = userData?._id && runner?._id
    ? `user-${userData._id}-runner-${runner._id}`
    : null;


  useEffect(() => {
    if (socket && isConnected && chatId) {
      joinChat(
        chatId,
        async (msgs) => {
          if (msgs && msgs.length > 0) {
            const isInitialLoad = messages.length === 0;

            if (isInitialLoad) {
              isInitialLoadRef.current = false;
              // Process messages one by one
              const processedMessages = [];

              for (let i = 0; i < msgs.length; i++) {
                const msg = msgs[i];

                // Format message preserving all properties
                const formattedMsg = {
                  ...msg,
                  from: (msg.type === "profile-card" || msg.messageType === "profile-card")
                    ? msg.from  // Keep whatever it already is ('them')
                    : (msg.from === 'system' ? 'system' :
                      (msg.senderId === userData?._id ? "me" : "them")),
                  type: msg.type || msg.messageType || 'text',
                  runnerInfo: msg.runnerInfo
                };

                processedMessages.push(formattedMsg);
                setMessages(prev => [...prev, formattedMsg]);

                // Wait before showing next message
                if (i < msgs.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
            } else {
              // Normal load
              const formattedMsgs = msgs.map(msg => ({
                ...msg,
                from: msg.from === 'system' ? 'system' :
                  (msg.senderId === userData?._id ? "me" : "them"),
                type: msg.type || msg.messageType || 'text',
                runnerInfo: msg.runnerInfo
              }));
              setMessages(formattedMsgs);
            }
          }
        },
        (msg) => {
          // Real-time messages
          setMessages((prev) => {
            // Check for duplicates by ID
            const exists = prev.some(m => m.id === msg.id);
            if (exists) {
              // Update existing message (replace blob URL with base64 if needed)
              return prev.map(m => {
                if (m.id === msg.id && m.isLocal && msg.fileUrl) {
                  // Replace local blob URL with socket base64
                  return { ...msg, from: msg.senderId === userData?._id ? "me" : "them" };
                }
                return m;
              });
            }

            // New message - add it
            const formattedMsg = {
              ...msg,
              from: msg.from === 'system' ? 'system' :
                (msg.senderId === userData?._id ? "me" : "them"),
              type: msg.type || msg.messageType || 'text',
              fileUrl: msg.fileUrl
            };

            return [...prev, formattedMsg];
          });

        }
      );
    }
  }, [socket, chatId, isConnected, joinChat, userData?._id, messages.length]);

  useEffect(() => {
    if (!socket || !chatId) return;

    const handleReceiveInvoice = ({ message, invoiceId, invoiceData }) => {
      // Format message for consistency with existing messages
      const formattedMsg = {
        ...message,
        from: message.from === 'system' ? 'system' : (message.senderId === userData?._id ? 'me' : 'them')
      };
      setMessages(prev => [...prev, formattedMsg]);
    };

    socket.on("receiveInvoice", handleReceiveInvoice);

    return () => {
      socket.off("receiveInvoice", handleReceiveInvoice);
    };
  }, [socket, chatId, userData?._id]);

  // track runner
  // Inside ChatScreen.jsx -> useEffect for tracking
  useEffect(() => {
    if (!socket) return;

    const handleReceiveTrackRunner = (data) => {
      console.log("Tracking started:", data);

      const trackingMsg = {
        id: `track-${Date.now()}`,
        from: "them",
        type: "tracking",
        trackingData: data.trackingData,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      };

      setMessages((prev) => [...prev, trackingMsg]);
    };

    socket.on("receiveTrackRunner", handleReceiveTrackRunner);
    return () => socket.off("receiveTrackRunner", handleReceiveTrackRunner);
  }, [socket]);

  // listen for deleted events
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleMessageDeleted = ({ messageId, deletedBy }) => {
      console.log(`Message ${messageId} deleted by ${deletedBy}`);

      // Update message to show deleted
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...msg,
              deleted: true,
              text: "This message was deleted",
              type: "deleted",
              fileUrl: null,
              fileName: null,
            }
            : msg
        )
      );
    };

    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, chatId]);



  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);


  const send = async () => {
    const hasText = text.trim();
    const hasFiles = selectedFiles.length > 0;

    if (!hasText && !hasFiles) return;

    // Send text first if any
    if (hasText) {
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

      if (socket) {
        sendMessage(chatId, newMsg);
      }
    }

    // Send files
    if (hasFiles) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]); // Clear immediately

      for (let i = 0; i < filesToSend.length; i++) {
        const fileData = filesToSend[i];
        const { file, name, type, size, preview } = fileData;

        let messageType = "file";
        if (type.startsWith("image/")) messageType = "image";
        else if (type.startsWith("audio/")) messageType = "audio";
        else if (type.startsWith("video/")) messageType = "video";

        const fileSize = size < 1024 * 1024
          ? `${(size / 1024).toFixed(1)} KB`
          : `${(size / (1024 * 1024)).toFixed(1)} MB`;

        const msgId = `${Date.now()}-${i}`;

        // Create LOCAL message with blob URL for instant display
        const localMsg = {
          id: msgId,
          from: "me",
          type: messageType,
          fileName: name,
          fileUrl: preview, // Keep blob URL for local display
          fileSize: fileSize,
          text: "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "sent",
          senderId: userData?._id,
          senderType: "user",
          fileType: type,
          isLocal: true // Mark as local
        };

        // Show immediately with blob URL
        setMessages(prev => [...prev, localMsg]);

        // Convert to base64 in background and send
        try {
          const base64 = await fileToBase64(file);

          // Send through socket with base64
          const socketMsg = {
            id: msgId, // Same ID
            from: "me",
            type: messageType,
            fileName: name,
            fileUrl: base64,
            fileSize: fileSize,
            text: "",
            time: localMsg.time,
            status: "sent",
            senderId: userData?._id,
            senderType: "user",
            fileType: type
          };

          if (socket) {
            sendMessage(chatId, socketMsg);
          }

          console.log(`File sent: ${name}`);
        } catch (error) {
          console.error('Error sending file:', error);
          // Update message to show error
          setMessages(prev => prev.map(msg =>
            msg.id === msgId ? { ...msg, status: "failed" } : msg
          ));
        }

        // Small delay between files
        if (i < filesToSend.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };


  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);

    const filesWithPreview = files.map(file => ({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      preview: URL.createObjectURL(file),
    }));

    // SIMPLE - just add the files
    setSelectedFiles(prev => [...prev, ...filesWithPreview]);
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      const fileToRemove = newFiles[index];

      // Revoke the URL when removing a file
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }

      newFiles.splice(index, 1);
      return newFiles;
    });
  };

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

        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

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
    // Update local messages to show "deleted"
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
            ...msg,
            deleted: true,
            text: "This message was deleted",
            type: "deleted",
            fileUrl: null,
            fileName: null,
          }
          : msg
      )
    );

    // Emit delete event to socket
    if (socket && chatId) {
      socket.emit("deleteMessage", {
        chatId,
        messageId,
        userId: userData?._id,
      });
    }
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
    return () => {
      // Clean up ONLY when component unmounts
      console.log("Cleaning up blob URLs on unmount");

      selectedFiles.forEach(f => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });

      messages.forEach(m => {
        if (m.fileUrl && m.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(m.fileUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {messages.map((m) => {

            const isProfileCard = m.type === "profile-card" || m.messageType === "profile-card";
            if (isProfileCard) {
              console.log("Profile card data:", m.runnerInfo);
            }

            if (m.type === "profile-card" || m.messageType === "profile-card") {
              return (
                <div key={m.id} className="my-4">
                  <ProfileCardMessage
                    runnerInfo={m.runnerInfo}
                    darkMode={darkMode}
                  />
                </div>
              );
            }
            return (
              <React.Fragment key={m.id}>
                {m.type !== "invoice" && m.type !== "tracking" && (
                  <Message
                    m={m}
                    onDelete={handleDeleteMessage}
                    onEdit={handleEditMessage}
                    showCursor={false}
                  />
                )}

                {m.type === "invoice" && m.invoiceData && (
                  <div className="my-2 flex justify-start">
                    <InvoiceScreen
                      darkMode={darkMode}
                      invoiceData={m.invoiceData}
                      runnerData={runner}
                      socket={socket}
                      chatId={chatId}
                      userId={userData?._id}
                      runnerId={runner?._id}
                      onAcceptSuccess={() => {
                        console.log("Invoice accepted successfully");
                      }}
                      onDeclineSuccess={() => {
                        console.log("Invoice declined successfully");
                      }}
                    />
                  </div>
                )}

                {m.type === "tracking" && (
                  <div className="my-2 flex justify-start">
                    <TrackDeliveryScreen
                      darkMode={darkMode}
                      trackingData={m.trackingData}
                    />
                  </div>
                )}


              </React.Fragment>
            );
          })}
        </div>
      </div>



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
            selectedFiles={selectedFiles}
            onRemoveFile={handleRemoveFile}
          />

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