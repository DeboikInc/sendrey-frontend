import React, { useState, useEffect, useRef } from "react";
import { Button } from "@material-tailwind/react";
import { Footprints, Bike, Navigation, Car, Truck, Search } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import Header from "../common/Header";
import CustomInput from "../common/CustomInput";
import { useDispatch, useSelector } from "react-redux";
import { updateProfile } from '../../Redux/userSlice';
import { FaWalking, FaMotorcycle, } from "react-icons/fa";
// import { useSocket } from "../hooks/useSocket"; 


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
  socket
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [searchTerm, setSearchTerm] = useState("");
  const dispatch = useDispatch();
  const timeoutRef = useRef(null);
  const [showConnectButton, setShowConnectButton] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [text, setText] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");

  const currentUser = useSelector((state) => state.auth?.user);
  const userId = currentUser?._id;

  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelect = (type, label) => {
    const newMsg = {
      id: Date.now(),
      from: "me",
      text: label,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
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
          if (onSelectVehicle) {
            onSelectVehicle(type);
          }

          if (selectedService === "pick-up" && !service?.pickupLocation) {
            console.error('Pickup location is missing for pickup service');
            // Show error to user or handle appropriately
            return;
          }

          // Update profile with serviceType and fleetType
          try {
            console.log('Sending currentRequest:', {
              pickupLocation: service?.pickupLocation,
              deliveryLocation: service?.deliveryLocation
            });

            await dispatch(updateProfile({
              currentRequest: {
                serviceType: selectedService,
                fleetType: type,
                userId: userId,
                timestamp: new Date().toISOString(),

                // common
                deliveryLocation: service?.deliveryLocation,
                status: "awaiting_runner_connection",

                // for additional information
                // additionalDetails: additionalDetails,

                ...(selectedService === "run-errand" ? {
                  marketLocation: service?.pickupLocation,
                  marketItems: service?.marketItems,
                  budget: service?.budget,
                  budgetFlexibility: service?.budgetFlexibility || "stay within budget",
                  marketCoordinates: service?.pickupCoordinates,

                } : {
                  // pickup ?
                  pickupLocation: service?.pickupLocation,
                  pickupPhone: service?.pickupPhone,
                  pickupCoordinates: service?.pickupCoordinates,
                  dropoffPhone: service?.dropoffPhone,
                })
              }

            })).unwrap();
            console.log(`User profile updated with service ${selectedService} and fleet type - ${type}`);
          } catch (error) {
            console.error('Failed to update profile:', error);
          }

          // Remove "In progress..." and immediately add connect message
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
    },);
  };

  const handleSendMessage = () => {
    if (!text.trim()) return;

    // Add user's message to the chat
    const userMessage = {
      id: Date.now(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages(prev => [...prev, userMessage]);
    setAdditionalDetails(text.trim());
    setText("");
  };


  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="h-full flex flex-col">

        <div ref={listRef} className="flex-1 overflow-y-auto p-4">
          {messages.map(m => <Message
            key={m.id}
            m={m}
            showCursor={false}
            onConnectButtonClick={m.hasConnectRunnerButton ? onConnectToRunner : undefined}
          />)}
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
          <div className="mt-4 space-y-3">
            <CustomInput
              showMic={false}
              showPlus={true}
              showIcons={false}
              showEmojis={false}
              countryRestriction="us"
              stateRestriction="ny"
              setMessages={setMessages}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder=""
              searchIcon={<Search className="h-4 w-4" />}
              send={handleSendMessage}
            />


          </div>
        )}
      </div>


    </Onboarding>
  );
}
