import React, { useState, useEffect, useRef } from "react";
import { Button } from "@material-tailwind/react";
import { Footprints, Bike, Navigation, Car, Truck, Search } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import Header from "../common/Header";
import CustomInput from "../common/CustomInput";
import { useDispatch } from "react-redux";
import { updateProfile } from '../../Redux/userSlice';
import { FaWalking, FaMotorcycle, } from "react-icons/fa";


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

export default function VehicleSelectionScreen({ onSelectVehicle, onConnectToRunner, darkMode, toggleDarkMode, service, selectedService, }) {
  const [messages, setMessages] = useState(initialMessages);
  const [searchTerm, setSearchTerm] = useState("");
  const dispatch = useDispatch();
  const timeoutRef = useRef(null);
  const [showConnectButton, setShowConnectButton] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

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

      setTimeout(async () => {
        setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));


        if (onSelectVehicle) {
          onSelectVehicle(type);
        }

        // Update profile with serviceType and fleetType
        try {
          await dispatch(updateProfile({
            serviceType: selectedService,
            fleetType: type
          })).unwrap();
          console.log('User profile updated with service and fleet type');
        } catch (error) {
          console.error('Failed to update profile:', error);
        }

        const connectMessage = {
          id: Date.now() + 3,
          from: "them",
          text: `Make your request detailed enough for your runner to understand (Type a message or record a voice note). Press the Connect To Runner button when you are done. Connect To Runner`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          hasConnectRunnerButton: true,
        };
        setMessages(prev => [...prev, connectMessage]);
        setShowConnectButton(true);

      }, 2000);
    },);
  };


  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="h-full flex flex-col">

        <div ref={listRef} className="flex-1 overflow-y-auto p-4">
          {messages.map(m => <Message
            key={m.id}
            m={m}
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
              showMic={true}
              showPlus={true}
              showIcons={false}
              // showEmojis={false}
              countryRestriction="us"
              stateRestriction="ny"
              setMessages={setMessages}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder=""
              searchIcon={<Search className="h-4 w-4" />}
            />


          </div>
        )}
      </div>

      
    </Onboarding>
  );
}
