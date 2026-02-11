import React, { useState, useEffect, useRef } from "react";
import { Button } from "@material-tailwind/react";
import { Footprints, Bike, Navigation, Car, Truck, Search } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import Header from "../common/Header";
import CustomInput from "../common/CustomInput";
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
  onDirectConnect
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

  const listRef = useRef(null);

  // Media states
  const [specialInstructionsMedia, setSpecialInstructionsMedia] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const camera = useCameraHook();
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Load existing data when editing
  useEffect(() => {
    if (isEditing && editingField === "special-instructions" && currentOrder?.specialInstructions) {
      const existing = currentOrder.specialInstructions;

      if (typeof existing === 'string') {
        setSpecialInstructions(existing);
      } else if (typeof existing === 'object') {
        setSpecialInstructions(existing.text || '');
        setSpecialInstructionsMedia(existing.media || []);
      }

      setShowConnectButton(true);
    }
  }, [isEditing, editingField, currentOrder]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

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
      specialInstructionsMedia.forEach(media => {
        if (media.preview) {
          URL.revokeObjectURL(media.preview);
        }
      });
    };
  }, [specialInstructionsMedia]);


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
    files.forEach(file => {
      const preview = URL.createObjectURL(file);
      setSpecialInstructionsMedia(prev => [...prev, {
        file,
        type: file.type,
        name: file.name,
        preview,
        size: file.size
      }]);
    });
    event.target.value = '';
  };

  const handleRemoveMedia = (index) => {
    setSpecialInstructionsMedia(prev => {
      const media = prev[index];
      if (media.preview) {
        URL.revokeObjectURL(media.preview);
      }
      return prev.filter((_, i) => i !== index);
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

        setSpecialInstructionsMedia(prev => [...prev, {
          file: audioFile,
          type: "audio/webm",
          name: "Voice message",
          preview,
          size: audioBlob.size,
          isAudio: true
        }]);

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
              text: `Make your request detailed enough for your runner to understand (Type a message or record a voice note). Press the Connect To Runner button when you are done. Connect To Runner`,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              hasConnectRunnerButton: true,
            }];
          });
          setShowConnectButton(true);
        }, 900);
      }, 1200);
    });
  };

  const handleSendMessage = () => {
    if (!text.trim() && specialInstructionsMedia.length === 0) return;

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

    if (specialInstructionsMedia.length > 0) {
      const latestMedia = specialInstructionsMedia[specialInstructionsMedia.length - 1];
      const mediaMessage = {
        id: Date.now() + 1,
        from: "me",
        type: latestMedia.type?.startsWith('image/') ? 'image' : 'audio',
        fileName: latestMedia.name,
        fileUrl: latestMedia.preview,
        fileSize: `${(latestMedia.size / 1024).toFixed(1)} KB`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      };

      setMessages(prev => [...prev, mediaMessage]);
    }

    setText("");
  };

  const handleConnectToRunner = async () => {
    if (!userLocation || !selectedVehicle) {
      alert('Please ensure your location is enabled and select a vehicle');
      return;
    }
    console.log('VehicleSelectionScreen - marketCoordinates in service:', service?.marketCoordinates);

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

    if (isEditing && editingField === "special-instructions") {
      onEditComplete(orderData);
      return;
    }

    // Check if in retry mode (onDirectConnect exists)
    if (onDirectConnect) {
      // Skip modal, connect directly
      onDirectConnect(orderData);
    } else {
      // First time - show confirm modal
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
                    setSpecialInstructionsMedia(prev => [...prev, {
                      file,
                      type: 'image/jpeg',
                      name: file.name,
                      preview,
                      size: file.size
                    }]);

                    setMessages(prev => [...prev, {
                      id: Date.now(),
                      from: "me",
                      type: 'image',
                      fileName: file.name,
                      fileUrl: preview,
                      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
                      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      status: "sent",
                    }]);
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

  const renderMediaPreviews = () => {
    if (specialInstructionsMedia.length === 0) return null;

    return (
      <div className="mb-2 p-2 bg-gray-100 dark:bg-black-100 rounded-lg">
        <div className="flex flex-wrap gap-2">
          {specialInstructionsMedia.map((media, index) => (
            <div key={index} className="relative group">
              {media.type?.startsWith('image/') ? (
                <img
                  src={media.preview}
                  alt="Attachment"
                  className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300 dark:border-gray-600"
                />
              ) : (
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-2xl mb-1">🎤</span>
                  <span className="text-xs">{Math.floor(media.size / 1024)}KB</span>
                </div>
              )}
              <button
                onClick={() => handleRemoveMedia(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleEditMessage = (messageId, newText) => {
    console.log('Editing message:', messageId, newText);

    // Update the special instructions state
    setSpecialInstructions(newText);

    // Update the message in messages array
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          text: newText,
          edited: true,
          timestamp: new Date().toISOString(),
          // Preserve special properties
          hasConnectRunnerButton: msg.hasConnectRunnerButton,
        };
      }
      return msg;
    }));
  };


  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="h-full flex flex-col">
        <div ref={listRef} className="flex-1 overflow-y-auto p-4">
          {messages.map(m => (
            <Message
              key={m.id}
              m={m}
              showCursor={false}
              onConnectButtonClick={m.hasConnectRunnerButton ? handleConnectToRunner : undefined}

              disableContextMenu={true}
              alwaysAllowEdit={
                m.from === "me" &&
                !m.hasConnectRunnerButton &&
                !m.isFleetSelection
              }
              onEdit={handleEditMessage}

              showReply={false}
              showDelete={true}
            // onDelete={handleDeleteMessage}
            />
          ))}
        </div>

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
          <div className="absolute w-full bottom-8 sm:bottom-[40px] px-4 sm:px-8 lg:px-64 right-0 left-0">

            {/* Media previews ABOVE CustomInput */}
            {renderMediaPreviews()}

            <CustomInput
              showMic={true}
              showPlus={true}
              showIcons={true}
              showEmojis={false}
              countryRestriction="us"
              stateRestriction="ny"
              setMessages={setMessages}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isRecording ? `Recording... ${recordingTime}s` : ""}
              send={handleSendMessage}
            />

            {/* Edit mode done button */}
            {isEditing && editingField === "special-instructions" && (
              <button
                onClick={handleConnectToRunner}
                className="w-full mt-3 py-3 bg-primary text-white rounded-lg font-semibold"
              >
                Done Editing
              </button>
            )}
          </div>
        )}

        {renderCameraUI()}
        {renderPreviewUI()}
      </div>
    </Onboarding>
  );
}