import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@material-tailwind/react";
import { Search, MapPin, X, Bookmark, Check } from "lucide-react";

import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";
import Map from "../common/Map";
import { useDispatch } from "react-redux";

import { addLocation } from "../../Redux/userSlice";


const markets = [];

export default function MarketSelectionScreen({
  service,
  onSelectMarket,
  darkMode,
  toggleDarkMode,
  messages,
  setMessages,
  pickupLocation,
  setPickupLocation,
  deliveryLocation,
  setDeliveryLocation,
  onOpenSavedLocations,
}) {
  // Determine if this is pick-up or run-errand service
  const isPickupService = service?.service === "pick-up";
  const isErrandService = service?.service === "run-errand";

  const getInitialMessages = useCallback(() => {
    const baseMessages = [
      { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
      {
        id: 2,
        from: "them",
        text: "Would you like to schedule a pickup or run an errand?",
        time: "12:25 PM",
        status: "delivered",
      },
      {
        id: 3,
        from: "me",
        text: isPickupService ? "Pick Up" : "Run Errand",
        time: "12:25 PM",
        status: "send",
      },
    ];

    // Different flow for each service
    if (isPickupService) {
      return [
        ...baseMessages,
        {
          id: 4,
          from: "them",
          text: "Which location do you want to pickup from?",
          time: "12:25 PM",
          status: "delivered",
        },
      ];
    } else {
      return [
        ...baseMessages,
        {
          id: 4,
          from: "them",
          text: "Which market would you like us to go to?",
          time: "12:25 PM",
          status: "delivered",
        },
      ];
    }
  }, [isPickupService]);

  useEffect(() => {
    if (messages && messages.length === 0) {
      setMessages(getInitialMessages());
    }
  }, [getInitialMessages, messages, setMessages]);


  const [searchTerm, setSearchTerm] = useState("");
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showLocationButtons, setShowLocationButtons] = useState(true);
  const [pickupPhoneNumber, setPickupPhoneNumber] = useState("");
  const [dropoffPhoneNumber, setDropoffPhoneNumber] = useState("");
  const [currentStep, setCurrentStep] = useState(isPickupService ? "pickup-location" : "market-location");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingPlace, setPendingPlace] = useState(null);

  const dispatch = useDispatch();

  const listRef = useRef(null);
  const timeoutRef = useRef(null);
  const [showCustomInput, setShowCustomInput] = useState(true);
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const deliveryLocationRef = useRef(null);
  const pickupLocationRef = useRef(null);


  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleMapSelect = (place) => {
    setSelectedPlace(place);
  };

  const handleMapSelection = () => {
    if (!selectedPlace) return;

    // Instead of processing immediately, open the modal
    setPendingPlace(selectedPlace);
    setShowSaveConfirm(true);
  };

  const finalizeSelection = async (shouldSave) => {
    const place = pendingPlace;
    const locationText = place.name || place.address;

    console.log('🎯 finalizeSelection called - step:', currentStep, 'location:', locationText);

    if (shouldSave) {
      try {

        await dispatch(addLocation({
          name: place.name || "Mapped Location",
          address: place.address,
          lat: place.lat,
          lng: place.lng
        })).unwrap();
      } catch (err) {
        console.error("Failed to save location:", err);
      }
    }

    // Proceed with your original logic
    if (currentStep === "delivery-location") {
      setDeliveryLocation(locationText);
      deliveryLocationRef.current = locationText;
      send("map", locationText, "delivery");

    } else if (currentStep === "pickup-location") {
      setPickupLocation(locationText);
      pickupLocationRef.current = locationText;
      send("map", locationText, "pickup-location");

    } else {
      setPickupLocation(locationText);
      pickupLocationRef.current = locationText;
      send("map", locationText, "market-location");
    }

    // Reset all UI states
    setShowSaveConfirm(false);
    setShowMap(false);
    setSelectedPlace(null);
    setPendingPlace(null);
  };

  const handleLocationSelectedFromSaved = (location, type) => {
    const locationText = location.address || location.name;

    if (type === 'delivery' || currentStep === "delivery-location") {
      setDeliveryLocation(locationText);
      send("saved_location", locationText, "delivery");
    } else if (currentStep === "pickup-location") {
      setPickupLocation(locationText);
      send("saved_location", locationText, "pickup-location");
    } else {
      // For market location
      setPickupLocation(locationText);
      send("saved_location", locationText, "market-location");
    }
  };

  const send = (type, text, source) => {
    if (!text || typeof text !== "string") return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const msgText = text.trim();
    setShowLocationButtons(false);

    const newMsg = {
      id: Date.now(),
      from: "me",
      text: msgText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((prev) => [...prev, newMsg]);
    setShowCustomInput(false);
    setShowPhoneInput(false);

    // Fake bot "processing"
    const botResponse = {
      id: Date.now() + 1,
      from: "them",
      text: "In progress...",
      status: "delivered",
    };

    timeoutRef.current = setTimeout(() => {
      setMessages((p) => [...p, botResponse]);

      setTimeout(() => {
        setMessages((prev) => prev.filter((msg) => msg.text !== "In progress..."));

        // Handle different flows based on service type
        if (isPickupService) {
          handlePickupFlow(source, msgText);
        } else if (isErrandService) {
          handleErrandFlow(source, msgText);
        }
      }, 900);
    }, 1200);
  };

  const handlePickupFlow = (source, text) => {
    if (source === "pickup-location" && !pickupPhoneNumber) {
      // After pickup location, ask for pickup phone number
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 2,
          from: "them",
          text: "Please enter pick up phone number Use My Phone Number",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          hasUseMyNumberButton: true,
          phoneNumberType: "pickup",
        },
      ]);
      setCurrentStep("pickup-phone");
      setShowPhoneInput(true);
    } else if (source === "pickup-phone" && !deliveryLocation) {
      console.log('deliveryLocation STATE:', deliveryLocation);
      console.log('deliveryLocation REF:', deliveryLocationRef.current)

      // After pickup phone, ask for delivery location
      setPickupPhoneNumber(text);
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 2,
          from: "them",
          text: "Set your delivery location. Choose Delivery Location",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          hasChooseDeliveryButton: true,
        },
      ]);
      setCurrentStep("delivery-location");
      setTimeout(() => setShowLocationButtons(true), 200);
    } else if (source === "delivery" && !dropoffPhoneNumber) {
      // After delivery location, ask for dropoff phone number
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 2,
          from: "them",
          text: "Kindly enter drop off phone number Use My Phone Number",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          hasUseMyNumberButton: true,
          phoneNumberType: "dropoff",
        },
      ]);
      setCurrentStep("dropoff-phone");
      setShowPhoneInput(true);
    } else if (source === "dropoff-phone") {
      // Complete - navigate to next screen
      setDropoffPhoneNumber(text);

      console.log('deliveryLocation STATE:', deliveryLocation);

      onSelectMarket({
        serviceType: "pick-up",
        pickupLocation: pickupLocationRef.current,
        deliveryLocation: deliveryLocationRef.current,
        pickupPhone: pickupPhoneNumber,
        dropoffPhone: text,
        pickupCoordinates: selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : null
      });
    }
  };

  const handleErrandFlow = (source, text) => {
    if (source === "market-location" && !deliveryLocation) {
      // After market selection, ask for delivery location
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 2,
          from: "them",
          text: "Set your delivery location. Choose Delivery Location",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
          hasChooseDeliveryButton: true,
        },
      ]);
      setCurrentStep("delivery-location");
      setTimeout(() => setShowLocationButtons(true), 200);
    } else if (source === "delivery") {

      console.log('deliveryLocation REF:', deliveryLocationRef.current);
      console.log('pickupLocation REF:', pickupLocationRef.current);

      // Complete - navigate to next screen
      onSelectMarket({
        serviceType: "run-errand",
        pickupLocation: pickupLocationRef.current,
        deliveryLocation: deliveryLocationRef.current,
        pickupCoordinates: selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : null
      });
    }
  };

  const handleUseMyNumber = (phoneType) => {
    const myNumber = "+234 801 234 5678"; // Replace with actual user's number
    if (phoneType === "pickup") {
      send("text", myNumber, "pickup-phone");
    } else {
      send("text", myNumber, "dropoff-phone");
    }
  };

  const handleChooseDeliveryClick = () => {
    setShowMap(true);
    setShowLocationButtons(true);
  };

  const filteredMarkets = markets.filter((market) =>
    market.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isDeliveryMode = currentStep === "delivery-location";
  const isProcessing = messages.some(m => m.text === "In progress...");

  if (showMap) {
    return (
      <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="w-full h-full flex flex-col mx-auto flex flex-col overflow-hidden max-w-2xl">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b">
            <Button
              variant="text"
              onClick={() => {
                setShowMap(false);
                setShowLocationButtons(true);
                setSelectedPlace(null);
              }}
              className="flex items-center"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              onClick={handleMapSelection}
              disabled={!selectedPlace}
              className={`${!selectedPlace ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Select Location
            </Button>
          </div>

          <Map onLocationSelect={handleMapSelect} />

          {selectedPlace && (
            <div className="p-4 bg-white dark:bg-gray-800 border-t">
              <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                <p className="font-semibold text-blue-800 dark:text-blue-200">Selected Location:</p>
                <p className="text-blue-600 dark:text-blue-300">
                  {selectedPlace.name || selectedPlace.address}
                </p>
                <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">
                  Coordinates: {selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}
                </p>
              </div>
            </div>
          )}

          {showSaveConfirm && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
              <div className={`w-full max-w-xs p-6 rounded-2xl shadow-xl ${darkMode ? 'bg-black-100 text-white' : 'bg-white text-gray-800'}`}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Bookmark className="text-primary" size={24} />
                  </div>
                  <h4 className="font-bold text-lg mb-2">Save to Favourites?</h4>
                  <p className="text-sm opacity-70 mb-6">
                    Would you like to keep this location for your next request?
                  </p>
                  <div className="flex flex-col w-full gap-2">
                    <Button
                      size="sm"
                      onClick={() => finalizeSelection(true)}
                      className="bg-primary flex items-center justify-center gap-2"
                    >
                      <Check size={16} /> Save & Select
                    </Button>
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => finalizeSelection(false)}
                      className={darkMode ? 'text-gray-400' : 'text-gray-600'}
                    >
                      Just Select
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Onboarding>
    );
  }

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div
        className="w-full h-screen max-w-2xl mx-auto flex flex-col overflow-hidden"
      >
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-3 marketSelection scroll-smooth "
        >
          {messages.map((m) => (
            <p className="mx-auto" key={m.id}>
              <Message
                m={m}
                showCursor={false}
                onChooseDeliveryClick={m.hasChooseDeliveryButton ? handleChooseDeliveryClick : undefined}
                onUseMyNumberClick={m.hasUseMyNumberButton ? () => handleUseMyNumber(m.phoneNumberType) : undefined}
              />
            </p>
          ))}

          <div className={`space-y-1 -mt-1 max-h-96 overflow-y-auto ${isDeliveryMode ? '-mt-6 pb-5' : ''}`}>
            {searchTerm &&
              filteredMarkets.map((market) => (
                <Button
                  key={market}
                  variant="outlined"
                  className="w-full justify-start py-3"
                  onClick={() => {
                    if (currentStep === "market-location") {
                      send("text", market, "market-location");
                    } else if (currentStep === "pickup-location") {
                      send("text", market, "pickup-location");
                    }
                  }}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {market}
                </Button>
              ))}

            {/* Find on map - only for location selection, no number */}
            {showLocationButtons && !isDeliveryMode && !isProcessing && !showPhoneInput && (
              <Button
                variant="text"
                className="w-full flex items-center py-2"
                onClick={() => {
                  setShowMap(true);
                  setShowLocationButtons(false);
                }}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Find on map
              </Button>
            )}

            {/* View saved locations for location selection */}
            {showLocationButtons && !isProcessing && !showPhoneInput && (
              <Button
                variant="text"
                className="w-full text-primary flex items-center py-2"
                onClick={() => {
                  onOpenSavedLocations(
                    true,
                    handleLocationSelectedFromSaved,
                    () => setShowLocationButtons(true)
                  );
                }}
              >
                View saved locations
              </Button>
            )}
          </div>

          <div className="h-60"></div>
        </div>
      </div>

      {/* Location Search Input */}
      <div className="fixed inset-x-0 bottom-0 h-10 bg-white dark:bg-black z-10"></div>
      <div className="fixed bottom-0 left-0 right-0 p-4 z-20">
        {showCustomInput && !showPhoneInput && (
          <CustomInput
            countryRestriction="us"
            stateRestriction="ny"
            showMic={false}
            showIcons={false}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search for a ${isErrandService ? "market" : "location"}...`}
            send={(type, text) => {
              if (currentStep === "pickup-location") send(type, text, "pickup-location");
              else if (currentStep === "market-location") send(type, text, "market-location");
            }}
          />
        )}

        {showPhoneInput && (
          <CustomInput
            value={phoneNumberInput}
            onChange={(e) => setPhoneNumberInput(e.target.value)}
            placeholder="Enter phone number"
            showMic={false}
            showIcons={false}
            send={(type, text) => {
              if (currentStep === "pickup-phone") send(type, text, "pickup-phone");
              else if (currentStep === "dropoff-phone") send(type, text, "dropoff-phone");
            }}
          />
        )}
      </div>
    </Onboarding>
  );
}