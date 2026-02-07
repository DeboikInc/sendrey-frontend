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
  const [uploadingFiles, setUploadingFiles] = useState(new Set());

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const processedMessageIds = useRef(new Set()); // ADD THIS LINE

  const [showTrackDelivery, setShowTrackDelivery] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageToEdit, setMessageToEdit] = useState(null);

  const {
    socket,
    joinChat,
    sendMessage,
    isConnected,
    uploadFile,
    onFileUploadSuccess,
    onFileUploadError
  } = useSocket();

  const chatId = userData?._id && runner?._id
    ? `user-${userData._id}-runner-${runner._id}`
    : null;

  useEffect(() => {
    onFileUploadSuccess((data) => {
      console.log('✅ File uploaded success data:', data);
      console.log('✅ Temp ID from data:', data.tempId);
      console.log('✅ Message from data:', data.message);

      // ✅ Mark server message ID as processed to prevent duplicate from socket broadcast
      if (data.message?.id) {
        processedMessageIds.current.add(data.message.id);
        console.log('✅ Added server message ID to processed:', data.message.id);
      }

      // Update message with uploaded URL - find by temporary ID
      setMessages(prev => prev.map(msg => {
        const isMatch = msg.tempId === data.tempId ||
          msg.id === data.tempId;

        if (isMatch) {
          console.log('✅ Updating temp message:', msg.id, '→', data.message?.id);

          // Remove the old temp ID from processed set
          processedMessageIds.current.delete(msg.id);
          processedMessageIds.current.delete(msg.tempId);

          return {
            ...msg,
            ...data.message,
            id: data.message?.id || msg.id, // Use server ID
            from: "me",
            isUploading: false,
            fileUrl: data.message?.fileUrl || data.cloudinaryUrl,
            status: "sent",
            tempId: undefined // Remove tempId
          };
        }
        return msg;
      }));

      // Remove from uploading set
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.tempId);
        return newSet;
      });
    });

    onFileUploadError((data) => {
      console.error('❌ Upload failed:', data.error);

      // Mark message as failed
      setMessages(prev => prev.map(msg => {
        if (msg.id === data.tempId ||
          msg.tempId === data.tempId ||
          (msg.fileName === data.fileName && msg.isUploading)) {
          return {
            ...msg,
            status: "failed",
            isUploading: false,
            text: `Failed to upload: ${data.error}`
          };
        }
        return msg;
      }));

      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.tempId);
        return newSet;
      });
    });
  }, [onFileUploadSuccess, onFileUploadError]);

  // Clear processed IDs when chat changes
  useEffect(() => {
    processedMessageIds.current = new Set();
  }, [chatId]);

  useEffect(() => {
    if (socket && isConnected && chatId) {
      const serviceType = userData?.serviceType;

      joinChat(
        chatId,
        {
          taskId: runner?._id || userData?._id || 'pending',
          serviceType: serviceType
        },
        async (msgs) => {
          if (msgs && msgs.length > 0) {
            const isInitialLoad = messages.length === 0;

            if (isInitialLoad) {
              isInitialLoadRef.current = false;
              // Clear processed IDs for fresh chat
              processedMessageIds.current = new Set();

              const processedMessages = msgs.map(msg => {
                const formattedMsg = {
                  ...msg,
                  from: (msg.type === "profile-card" || msg.messageType === "profile-card")
                    ? msg.from
                    : (msg.from === 'system' ? 'system' :
                      (msg.senderId === userData?._id ? "me" : "them")),
                  type: msg.type || msg.messageType || 'text',
                  runnerInfo: msg.runnerInfo
                };

                // Track this message ID
                processedMessageIds.current.add(msg.id);
                return formattedMsg;
              });

              setMessages(processedMessages);
            } else {
              // Filter out messages we've already processed
              const newMessages = msgs.filter(msg =>
                !processedMessageIds.current.has(msg.id)
              );

              if (newMessages.length > 0) {
                const formattedMsgs = newMessages.map(msg => {
                  const formattedMsg = {
                    ...msg,
                    from: msg.from === 'system' ? 'system' :
                      (msg.senderId === userData?._id ? "me" : "them"),
                    type: msg.type || msg.messageType || 'text',
                    runnerInfo: msg.runnerInfo
                  };

                  // Track this message ID
                  processedMessageIds.current.add(msg.id);
                  return formattedMsg;
                });

                setMessages(prev => [...prev, ...formattedMsgs]);
              }
            }
          }
        },
        (msg) => {
          // Real-time messages

          // Skip if already processed
          if (processedMessageIds.current.has(msg.id)) {
            return;
          }

          // Skip file upload success messages (handled separately)
          if (msg.type === 'fileUploadSuccess' || msg.messageType === 'fileUploadSuccess') {
            return;
          }

          // Skip file messages that are currently being uploaded (have matching tempId)
          const isUploadingFile = Array.from(uploadingFiles).some(tempId => {
            // Check if this message matches any uploading file
            return msg.fileName && messages.some(m =>
              (m.id === tempId || m.tempId === tempId) &&
              m.fileName === msg.fileName &&
              m.isUploading
            );
          });

          if (isUploadingFile) {
            console.log('⏭️ Skipping message for currently uploading file:', msg.fileName);
            return;
          }

          // Mark as processed immediately
          processedMessageIds.current.add(msg.id);

          setMessages((prev) => {
            const exists = prev.some(m => m.id === msg.id);

            if (exists) {
              return prev.map(m =>
                m.id === msg.id
                  ? {
                    ...m,
                    ...msg,
                    from: msg.senderId === userData?._id ? "me" : "them",
                    isUploading: false,
                    fileUrl: msg.fileUrl || m.fileUrl,
                  }
                  : m
              );
            }

            // Add new message
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
  }, [socket, chatId, isConnected, joinChat, userData?._id, messages, uploadingFiles]);

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
      const messageId = Date.now().toString();
      const newMsg = {
        id: messageId,
        from: "me",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        senderId: userData?._id,
        senderType: "user",
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToMessage: replyingTo.text || replyingTo.fileName || "Media",
          replyToFrom: replyingTo.from
        })
      };

      // ✅ ADD: Mark this message as processed immediately
      processedMessageIds.current.add(messageId);

      setMessages((p) => [...p, newMsg]);
      setText("");
      setReplyingTo(null);

      if (socket) {
        sendMessage(chatId, newMsg);
      }
    }

    // Send files via socket upload
    if (hasFiles) {
      const filesToSend = [...selectedFiles];
      setSelectedFiles([]);

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

        const tempId = `temp-${Date.now()}-${i}`;

        // ✅ ADD: Mark temp ID as processed
        processedMessageIds.current.add(tempId);

        const localMsg = {
          id: tempId,
          from: "me",
          type: messageType,
          fileName: name,
          fileUrl: preview,
          fileSize: fileSize,
          text: "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "uploading",
          senderId: userData?._id,
          senderType: "user",
          fileType: type,
          isUploading: true,
          tempId: tempId
        };

        setMessages(prev => [...prev, localMsg]);
        setUploadingFiles(prev => new Set(prev).add(tempId));

        try {
          const base64 = await fileToBase64(file);

          uploadFile({
            chatId,
            file: base64,
            fileName: name,
            fileType: type,
            senderId: userData?._id,
            senderType: "user",
            tempId: tempId
          });

          console.log(`Uploading file: ${name}`);
        } catch (error) {
          console.error('Error uploading file:', error);

          setMessages(prev => prev.map(msg =>
            msg.id === tempId ? { ...msg, status: "failed", isUploading: false } : msg
          ));

          setUploadingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(tempId);
            return newSet;
          });
        }

        if (i < filesToSend.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
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

    setSelectedFiles(prev => [...prev, ...filesWithPreview]);
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      const fileToRemove = newFiles[index];

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

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        const tempId = `audio-temp-${Date.now()}`;
        const audioUrl = URL.createObjectURL(audioBlob);

        // ✅ ADD: Mark temp ID as processed
        processedMessageIds.current.add(tempId);

        const localMsg = {
          id: tempId,
          from: "me",
          type: "audio",
          fileName: "voice-message.webm",
          fileUrl: audioUrl,
          fileSize: `${(audioBlob.size / 1024).toFixed(1)} KB`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "uploading",
          senderId: userData?._id,
          senderType: "user",
          isUploading: true,
          tempId: tempId
        };

        setMessages((p) => [...p, localMsg]);
        setUploadingFiles(prev => new Set(prev).add(tempId));

        try {
          const base64 = await blobToBase64(audioBlob);

          uploadFile({
            chatId,
            file: base64,
            fileName: "voice-message.webm",
            fileType: "audio/webm",
            senderId: userData?._id,
            senderType: "user",
            tempId: tempId
          });

          console.log('Uploading voice message...');
        } catch (error) {
          console.error('Error uploading audio:', error);
          setMessages(prev => prev.map(msg =>
            msg.id === tempId ? { ...msg, status: "failed", isUploading: false } : msg
          ));
        }

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

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
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

  const handleDeleteMessage = (messageId, deleteForEveryone = false) => {
    if (deleteForEveryone) {
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

      if (socket && chatId) {
        socket.emit("deleteMessage", {
          chatId,
          messageId,
          userId: userData?._id,
          deleteForEveryone: true
        });
      }
    } else {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
              ...msg,
              deletedForMe: true,
              text: "You deleted this message",
              type: "deleted",
              fileUrl: null,
              fileName: null,
            }
            : msg
        )
      );
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

  const handleMessageReact = (messageId, emoji) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, reaction: emoji }
        : msg
    ));

    if (socket && chatId) {
      socket.emit("reactToMessage", {
        chatId,
        messageId,
        emoji,
        userId: userData?._id,
      });
    }
  };

  const handleMessageReply = (message) => {
    setReplyingTo(message);
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Copied to clipboard");
    });
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

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
                    onReact={handleMessageReact}
                    onReply={handleMessageReply}
                    replyingToMessage={replyingTo?.id === m.id ? replyingTo : null}
                    onCancelReply={handleCancelReply}
                    isChatActive={true}
                    showCursor={true}
                    isUploading={m.isUploading}
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
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            darkMode={darkMode}
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