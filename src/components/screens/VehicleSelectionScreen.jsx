import React, { useState, useEffect, useRef } from "react";
import { Button } from "@material-tailwind/react";
import { Footprints, Bike, Navigation, Car, Truck, Search } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import Header from "../common/Header";
import CustomInput from "../common/CustomInput";



const vehicleTypes = [
  { type: "pedestrian", icon: Footprints, label: "Walking" },
  { type: "cycling", icon: Bike, label: "Bicycle" },
  { type: "motorcycle", icon: Navigation, label: "Motorcycle" },
  { type: "car", icon: Car, label: "Car" },
  { type: "van", icon: Truck, label: "Van" },
];

const initialMessages = [
  { id: 1, from: "them", text: "What Transport Medium do you want to handle your errand? Select from the options below: ", time: "12:26 PM", status: "delivered" },
];

export default function VehicleSelectionScreen({ onSelectVehicle, darkMode, toggleDarkMode, service }) {
  const [messages, setMessages] = useState(initialMessages);
  const [searchTerm, setSearchTerm] = useState("");
  
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelect = (type) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now(), from: "me", text: type, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "sent" }
    ]);

    setTimeout(() => onSelectVehicle(type), 1000);
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="h-full flex flex-col">

        <div ref={listRef} className="flex-1 overflow-y-auto p-4">
          {messages.map(m => <Message key={m.id} m={m} />)}
        </div>

        <div className="mb-4 mt-2">
          <CustomInput
            countryRestriction="us"
            stateRestriction="ny"
            setMessages={setMessages}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search for a ${service?.service?.toLowerCase() === 'run errend' ? 'location' : 'market'}...`}
            searchIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {vehicleTypes.map(({ type, icon: Icon, label }) => (
            <Button key={type} variant="outlined" className="flex flex-col h-20 p-2" onClick={() => handleSelect(label)}>
              <Icon className="h-4 w-4 mb-1" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </Onboarding>
  );
}
