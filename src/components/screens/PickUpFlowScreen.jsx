// components/screens/PickupFlow.jsx
import { useEffect, useRef, useState } from "react";
import { Button } from "@material-tailwind/react";
import { MapPin, X, Bookmark, Check } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";
import Map from "../common/Map";
import { useDispatch } from "react-redux";
import { addLocation } from "../../Redux/userSlice";
import { useSelector } from "react-redux";

export default function PickupFlowScreen({
  onOpenSavedLocations,
  messages,
  setMessages,
  pickupLocation,
  setPickupLocation,
  deliveryLocation,
  setDeliveryLocation,
  onSelectPickup,
  darkMode,
  toggleDarkMode,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showLocationButtons, setShowLocationButtons] = useState(true);
  const [pickupPhoneNumber, setPickupPhoneNumber] = useState("");
  const [dropoffPhoneNumber, setDropoffPhoneNumber] = useState("");
  const [currentStep, setCurrentStep] = useState("pickup-location");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [showCustomInput, setShowCustomInput] = useState(true);
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const dispatch = useDispatch();
  const listRef = useRef(null);
  const timeoutRef = useRef(null);
  const deliveryLocationRef = useRef(null);
  const pickupLocationRef = useRef(null);
  const authState = useSelector((state) => state.auth);

  // Use authState.user for user data
  const currentUser = authState.user;

  const initialMessages = [
    { id: 1, from: "them", text: "Which location do you want to pickup from?", time: "12:25 PM", status: "delivered" },
  ];

  useEffect(() => {
    if (messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [messages, setMessages]);

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
    setPendingPlace(selectedPlace);
    setShowSaveConfirm(true);
  };

  const finalizeSelection = async (shouldSave) => {
    const place = pendingPlace;
    const locationText = place.name || place.address;

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

    if (currentStep === "pickup-location") {

      setPickupLocation(locationText);
      pickupLocationRef.current = locationText;
      send(locationText, "pickup-location");

    } else if (currentStep === "delivery-location") {

      setDeliveryLocation(locationText);
      deliveryLocationRef.current = locationText;
      send(locationText, "delivery");

    }

    setShowSaveConfirm(false);
    setShowMap(false);
    setSelectedPlace(null);
    setPendingPlace(null);
  };

  const handleLocationSelectedFromSaved = (location, type) => {
    const locationText = location.address || location.name;

    if (currentStep === "pickup-location") {
      setPickupLocation(locationText);
      pickupLocationRef.current = locationText;
      send(locationText, "pickup-location");

    } else if (currentStep === "delivery-location") {

      setDeliveryLocation(locationText);
      deliveryLocationRef.current = locationText;
      send(locationText, "delivery");
    }
  };

  const send = (text, source) => {
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

    const botResponse = {
      id: Date.now() + 1,
      from: "them",
      text: "In progress...",
      status: "delivered",
    };
    setMessages((p) => [...p, botResponse]);

    timeoutRef.current = setTimeout(() => {

      setMessages((prev) => prev.filter((msg) => msg.text !== "In progress..."));


      if ((source === "pickup-phone" || source === "dropoff-phone")) {
        const isUseMyNumber = text.startsWith('+234');

        if (!isUseMyNumber) {

          const error = validatePhone(text);
          if (error) {
            setMessages((p) => [
              ...p,
              {
                id: Date.now() + 2,
                from: "them",
                text: error,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
              },
            ]);

            setPhoneNumberInput("");
            setShowPhoneInput(true);
            return;
          }
        }
        // continue
      }

      if (source === "pickup-location" && !pickupPhoneNumber) {
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
        // Format number with +234
        let formattedNumber = text;
        if (!text.startsWith("+234") && text.replace(/\D/g, '').length === 11) {
          formattedNumber = `+234${text.substring(1)}`;
        }
        setPickupPhoneNumber(formattedNumber);

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
        // Format number with +234
        let formattedNumber = text;
        if (!text.startsWith("+234") && text.replace(/\D/g, '').length === 11) {
          formattedNumber = `+234${text.substring(1)}`;
        }
        setDropoffPhoneNumber(formattedNumber);

        onSelectPickup({
          serviceType: "pick-up",
          pickupLocation: pickupLocationRef.current,
          deliveryLocation: deliveryLocationRef.current,
          pickupPhone: pickupPhoneNumber,
          dropoffPhone: formattedNumber,
          pickupCoordinates: selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : null,
          userId: currentUser?._id

        });
      }
    }, 1200); // 1.2 second delay
  };

  const handleUseMyNumber = (phoneType) => {
    const myNumber = currentUser?.phone || currentUser?.user?.phone;

    if (!myNumber) {
      console.error("Phone number not found in user data");

      // Add error message to chat
      const errorMessage = {
        id: Date.now(),
        from: "them",
        text: "Oops! Something went wrong. seems you aren't authenticated. Try logging out and logging in again",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    if (phoneType === "pickup") {
      send(myNumber, "pickup-phone");
    } else {
      send(myNumber, "dropoff-phone");
    }
  };

  const handleChooseDeliveryClick = () => {
    setShowMap(true);
    setShowLocationButtons(true);
  };

  const validatePhone = (phone) => {
    const clean = phone.replace(/\D/g, '');
    if (phone.startsWith('+234')) {
      if (clean.length !== 13) return "Invalid +234 format number";
      if (!['80', '81', '70', '90', '91'].includes(clean.substring(3, 5))) {
        return "Invalid phone number prefix";
      }
      return null;
    }

    // Handle 0-prefix format (11 digits)
    if (clean.length !== 11) return "Invalid Phone Number. Phone number must be 11 digits";
    if (!clean.startsWith('0')) return "Invalid Phone Number. Phone number must start with 0";
    if (!['080', '081', '070', '090', '091'].includes(clean.substring(0, 3))) {
      return "Invalid phone number prefix";
    }
    return null;
  };

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
          className="flex-1 overflow-y-auto p-3 marketSelection scroll-smooth"
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

          <div className={`space-y-1 -mt-1 ${currentStep === "delivery-location" ? '-mt-6 pb-5' : ''}`}>
            {showLocationButtons && currentStep === "pickup-location" && !showPhoneInput && (
              <>
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
              </>
            )}
          </div>

          <div className="h-60"></div>
        </div>
      </div>

      <div className="fixed z-10"></div>
      <div className="fixed bottom-0 left-0 right-0 z-20">
        {showCustomInput && !showPhoneInput && currentStep === "pickup-location" && (
          <div className="px-4 py-7">
            <CustomInput
              countryRestriction="us"
              stateRestriction="ny"
              showMic={false}
              showIcons={false}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a location..."
              send={() => {
                if (searchTerm.trim()) {
                  send(searchTerm, "pickup-location");
                  setSearchTerm(""); // Clear after sending
                }
              }}
            />
          </div>

        )}

        {showPhoneInput && (
          <div className="px-10!">
            <CustomInput
              value={phoneNumberInput}
              onChange={(e) => setPhoneNumberInput(e.target.value)}
              placeholder="Enter phone number"
              showMic={false}
              showIcons={false}
              send={() => {
                if (phoneNumberInput.trim()) {
                  if (currentStep === "pickup-phone") {
                    send(phoneNumberInput, "pickup-phone");

                  } else if (currentStep === "dropoff-phone") {
                    send(phoneNumberInput, "dropoff-phone");
                  }
                  setPhoneNumberInput(""); // Clear after sending
                }
              }}
            />
          </div>

        )}
      </div>
    </Onboarding>
  );
}