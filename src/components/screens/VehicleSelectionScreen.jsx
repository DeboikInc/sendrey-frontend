import React, { useState, useEffect, useRef } from "react";
import { Button, IconButton, Tooltip } from "@material-tailwind/react";
import { Footprints, Bike, Navigation, Car, Truck, Search, Mic, Square, Paperclip, Smile, X, Camera, Music } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import Header from "../common/Header";
import { useDispatch, useSelector } from "react-redux";
import { updateOrder } from '../../Redux/orderSlice';
import { FaWalking, FaMotorcycle } from "react-icons/fa";
import { useCameraHook } from "../../hooks/useCameraHook";

const vehicleTypes = [
  { type: "pedestrian", icon: Footprints, label: "Walking" },
  { type: "cycling", icon: Bike, label: "Cycling" },
  { type: "bike", icon: Navigation, label: "Bike" },
  { type: "car", icon: Car, label: "Car" },
  { type: "van", icon: Truck, label: "Van" },
];

const initialMessages = [
  { id: 1, from: "them", text: "What kind of fleet can handle this errand? Select from the options below: ", time: "12:26 PM", status: "delivered" },
];

const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);

export default function VehicleSelectionScreen({
  onSelectVehicle,
  onConnectToRunner,
  darkMode, toggleDarkMode,
  service,
  selectedService,
  socket,
  onShowConfirmOrder,
  isEditing,
  editingField,
  currentOrder,
  onEditComplete,
  serverUpdated,
  onFetchRunners
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [searchTerm, setSearchTerm] = useState("");
  const dispatch = useDispatch();
  const timeoutRef = useRef(null);
  const [showConnectButton, setShowConnectButton] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [text, setText] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [userLocation, setUserLocation] = useState(null);

  const [isRetryMode, setIsRetryMode] = useState(false);

  const currentUser = useSelector((state) => state.auth?.user);
  const userId = currentUser?._id;

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Media states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [specialInstructionsMedia, setSpecialInstructionsMedia] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const camera = useCameraHook();
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load existing data when editing
  useEffect(() => {
    if (isEditing && editingField === "special-instructions" && currentOrder?.specialInstructions) {
      const existing = currentOrder.specialInstructions;

      if (typeof existing === 'string') {
        setSpecialInstructions(existing);
      } else if (typeof existing === 'object') {
        setSpecialInstructions(existing.text || '');
        setSpecialInstructionsMedia(existing.media || []);
        setSelectedFiles(existing.media || []);
      }

      setShowConnectButton(true);
    }
  }, [isEditing, editingField, currentOrder]);



  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      selectedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      specialInstructionsMedia.forEach(media => {
        if (media.preview) {
          URL.revokeObjectURL(media.preview);
        }
      });

      messages.forEach(msg => {
        if (msg.fileUrl && msg.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(msg.fileUrl);
        }
      });
    };
  }, [selectedFiles, specialInstructionsMedia, messages]);

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
    setSpecialInstructionsMedia(prev => [...prev, ...filesWithPreview]);

    event.target.value = '';
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

    setSpecialInstructionsMedia(prev => {
      const newMedia = [...prev];
      newMedia.splice(index, 1);
      return newMedia;
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
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const preview = URL.createObjectURL(audioBlob);

        const fileData = {
          file: audioFile,
          type: "audio/webm",
          name: "Voice message",
          preview,
          size: audioBlob.size,
          isAudio: true
        };

        setSelectedFiles(prev => [...prev, fileData]);
        setSpecialInstructionsMedia(prev => [...prev, fileData]);

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

  const handleSelect = (type, label) => {
    const newMsg = {
      id: Date.now(),
      from: "me",
      text: label,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      isFleetSelection: true,
    };

    setMessages(prev => [...prev, newMsg]);
    setSelectedVehicle(type);

    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        status: "delivered",
      };
      setMessages(prev => [...prev, botResponse]);

      setTimeout(() => {
        setTimeout(async () => {
          if (selectedService === "pick-up" && !service?.pickupLocation) {
            console.error('Pickup location is missing for pickup service');
            return;
          }

          setMessages(prev => {
            const filtered = prev.filter(msg => msg.text !== "In progress...");
            return [...filtered, {
              id: Date.now() + 3,
              from: "them",
              text: `Make your request detailed enough for your runner to understand (Type a message, take a picture or record a voice note). Press the Connect To Runner button when you are done. Connect To Runner`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              hasConnectRunnerButton: true,
              isConnectToRunner: true
            }];
          });
          setShowConnectButton(true);
        }, 900);
      }, 1200);
    });
  };

  const handleSendMessage = () => {
    if (!text.trim() && selectedFiles.length === 0) return;

    if (text.trim()) {
      const userMessage = {
        id: Date.now(),
        from: "me",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      };

      setMessages(prev => [...prev, userMessage]);
      setSpecialInstructions(prev =>
        prev ? `${prev}\n${text.trim()}` : text.trim()
      );
    }

    // Send ALL selected files, not just the latest one
    if (selectedFiles.length > 0) {
      selectedFiles.forEach((fileData, index) => {

        const messageFileUrl = URL.createObjectURL(fileData.file);

        const mediaMessage = {
          id: Date.now() + index + 1,
          from: "me",
          type: fileData.type?.startsWith('image/') ? 'image' :
            fileData.type?.startsWith('audio/') ? 'audio' : 'file',
          fileName: fileData.name,
          fileUrl: messageFileUrl,
          fileSize: `${(fileData.size / 1024).toFixed(1)} KB`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "sent",
          isUploading: false,
        };

        setMessages(prev => [...prev, mediaMessage]);
      });

      setSelectedFiles([]);
      setSpecialInstructionsMedia([]);
    }

    setText("");
  };

  const handleConnectToRunner = async () => {
    if (!userLocation || !selectedVehicle) {
      alert('Please ensure your location is enabled');
      return;
    }

    const orderData = {
      ...service,
      fleetType: selectedVehicle,
      specialInstructions: {
        text: specialInstructions,
        media: specialInstructionsMedia
      },
      serviceType: selectedService,
      userLocation: userLocation
    };

    dispatch(updateOrder(orderData));

    // Handle edit mode
    if (isEditing && editingField === "special-instructions") {
      onEditComplete(orderData);
      return;
    }

    // Check serverUpdated state
    if (serverUpdated) {
      // Server already updated - directly fetch runners (retry mode)
      console.log('🔄 Retry mode: Fetching runners directly...');
      onFetchRunners(orderData);
    } else {
      // First time - show confirm modal
      console.log('📋 First time: Showing confirm modal...');
      onShowConfirmOrder(orderData);
    }
  };

  const renderCameraUI = () => {
    if (!camera.cameraOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
          <button
            onClick={camera.capturePhoto}
            className="w-16 h-16 rounded-full bg-white border-4 border-primary"
          />
          <button
            onClick={camera.closeCamera}
            className="px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const renderPreviewUI = () => {
    if (!camera.isPreviewOpen || !camera.capturedImage) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <img src={camera.capturedImage} alt="Preview" className="max-h-full" />
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
          <button
            onClick={camera.retakePhoto}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            Retake
          </button>
          <button
            onClick={() => {
              const photo = camera.confirmPhoto();
              if (photo) {
                fetch(photo)
                  .then(res => res.blob())
                  .then(blob => {
                    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const preview = URL.createObjectURL(file);

                    const fileData = {
                      file,
                      type: 'image/jpeg',
                      name: file.name,
                      preview,
                      size: file.size
                    };

                    setSelectedFiles(prev => [...prev, fileData]);
                    setSpecialInstructionsMedia(prev => [...prev, fileData]);

                    // DON'T add to chat immediately - wait for send button
                  });
              }
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Use Photo
          </button>
        </div>
      </div>
    );
  };

  const handleEditMessage = (messageId, newText) => {
    console.log('Editing message:', messageId, newText);

    setSpecialInstructions(newText);

    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          text: newText,
          edited: true,
          timestamp: new Date().toISOString(),
          hasConnectRunnerButton: msg.hasConnectRunnerButton,
        };
      }
      return msg;
    }));
  };

  const handleDeleteMessage = (messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const handleSend = () => {
    handleSendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="h-full flex flex-col ">
        <div className="flex-1 overflow-hidden relative">
          <div ref={messagesEndRef} className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full p-4 pb-[280px] marketSelection">
              {messages.map(m => (
                <Message
                  key={m.id}
                  m={m}
                  showCursor={false}
                  onConnectButtonClick={m.hasConnectRunnerButton ? handleConnectToRunner : undefined}
                  disableContextMenu={m.isFleetSelection || m.isConnectToRunner? true : false}
                  alwaysAllowEdit={
                    m.from === "me" &&
                    !m.hasConnectRunnerButton &&
                    !m.isFleetSelection &&
                    !m.isConnectToRunner&&
                    m.type !== "audio" &&
                    !m.isAudio
                  }
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  showReply={false}
                  showDelete={true}
                  isChatActive={true}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0">
          {!showConnectButton && (
            <div className="flex text-3xl gap-2 justify-center mb-7">
              {[
                { type: "cycling", icon: Bike, label: "Cycling" },
                { type: "car", icon: Car, label: "Car" },
                { type: "van", icon: Truck, label: "Van" },
                { type: "pedestrian", icon: FaWalking, label: "Pedestrian" },
                { type: "bike", icon: FaMotorcycle, label: "Bike" }
              ].map(({ type, icon: Icon, label }) => (
                <Button
                  key={type}
                  variant="outlined"
                  className="flex flex-col p-3"
                  onClick={() => handleSelect(type, label)}
                >
                  <Icon className="text-2xl" />
                </Button>
              ))}
            </div>
          )}

          {showConnectButton && (
            <div className="pt-3 pb-4 px-4 sm:px-8 lg:px-64">
              {/* File Previews - Directly above input, no gap */}
              {selectedFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 ml-[60px]">
                  {selectedFiles.map((fileData, index) => (
                    <div key={index} className="relative flex-shrink-0">
                      {fileData.type?.startsWith('image/') ? (
                        <img
                          src={fileData.preview}
                          alt={fileData.name}
                          className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
                        />
                      ) : fileData.type?.startsWith('audio/') ? (
                        <div className="flex items-center gap-2 h-14 bg-primary p-2 rounded-lg">
                          <div className="w-10 h-10 rounded bg-gray-700 dark:bg-gray-300 flex items-center justify-center">
                            <Music className="w-5 h-5 opacity-70" />
                          </div>
                          <div className="flex flex-col mt-2 min-w-0 text-black-100 dark:text-gray-200">
                            <p className="text-xs font-medium opacity-90">Audio message</p>
                            <span className="text-xs">{Math.floor(fileData.size / 1024)}KB</span>
                          </div>
                        </div>
                      ) : null}
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="absolute -top-0 -right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Input Area - Fixed positioning */}
              <div className="flex items-center gap-3 w-full">
                {/* Camera Button */}
                <Button
                  onClick={camera.openCamera}
                  className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none"
                >
                  <Camera className="h-10 w-10 text-white bg-primary rounded-full p-2" />
                </Button>

                {/* Input Container */}
                <div className="flex-1 flex items-center px-3 bg-white dark:bg-black-100 rounded-full h-14 shadow-lg">
                  <input
                    ref={inputRef}
                    placeholder={isRecording ? `Recording... ${recordingTime}s` : "Type a message"}
                    className="w-full bg-transparent focus:outline-none font-normal text-lg text-black-100 dark:text-gray-100 px-2"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />

                  <HeaderIcon tooltip="Attach" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-6 w-6" />
                  </HeaderIcon>
                </div>

                {/* Mic/Send Button */}
                <div className="flex items-center">
                  {!text && selectedFiles.length === 0 ? (
                    <IconButton
                      variant="text"
                      className="rounded-full bg-primary text-white"
                      onClick={toggleRecording}
                    >
                      {isRecording ? (
                        <Square className="h-6 w-6 text-red-700" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                    </IconButton>
                  ) : (
                    <Button
                      onClick={handleSend}
                      className="rounded-lg bg-primary h-12 px-6 text-md"
                    >
                      Send
                    </Button>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*"
                multiple
              />
            </div>
          )}
        </div>

        {renderCameraUI()}
        {renderPreviewUI()}
      </div>
    </Onboarding>
  );
}