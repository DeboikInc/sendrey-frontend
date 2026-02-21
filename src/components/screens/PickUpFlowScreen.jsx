import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@material-tailwind/react";
import { MapPin, X, Bookmark, Check, Search, ChevronLeft } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";
import Map from "../common/Map";
import { useDispatch } from "react-redux";
import { addLocation } from "../../Redux/userSlice";
import { useSelector } from "react-redux";
import debounce from "lodash/debounce";

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
  isEditing,
  editingField,
  currentOrder,
  onEditComplete
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
  const [pickupItems, setPickupItems] = useState("");
  const [pickupItemsInput, setPickupItemsInput] = useState("");

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [searchError, setSearchError] = useState(null);

  const dispatch = useDispatch();
  const listRef = useRef(null);
  const timeoutRef = useRef(null);
  const deliveryLocationRef = useRef(null);
  const pickupLocationRef = useRef(null);
  const authState = useSelector((state) => state.auth);
  const prevStepRef = useRef(null);

  // autoscroll
  useEffect(() => {
    if (listRef.current) {
      const scrollToBottom = () => {
        requestAnimationFrame(() => {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      };

      const timeoutId = setTimeout(scrollToBottom, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, showCustomInput, showPhoneInput, currentStep, predictions.length]);

  const currentUser = authState.user;

  const searchPlaces = async (query, options = {}) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!query || query.length < 2) return [];

      const mockPredictions = [
        {
          place_id: "1",
          description: `${query} Street, Lagos`,
          structured_formatting: {
            main_text: `${query} Street`,
            secondary_text: "Lagos, Nigeria"
          }
        },
        {
          place_id: "2",
          description: `${query} Market, Lagos`,
          structured_formatting: {
            main_text: `${query} Market`,
            secondary_text: "Lagos Island, Nigeria"
          }
        },
        {
          place_id: "3",
          description: `${query} Plaza, Abuja`,
          structured_formatting: {
            main_text: `${query} Plaza`,
            secondary_text: "Abuja, Nigeria"
          }
        }
      ];

      return mockPredictions;
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  };

  const debouncedSearch = useCallback(
    debounce(async (query, step) => {
      // Only search for locations, not items
      if (step !== "pickup-location" && step !== "delivery-location") {
        setPredictions([]);
        setIsSearching(false);
        return;
      }

      if (query.trim().length < 2) {
        setPredictions([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        const results = await searchPlaces(query, { countryCode: 'ng' });
        setPredictions(results || []);
      } catch (error) {
        setSearchError("Failed to search locations. Please try again.");
        setPredictions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm, currentStep);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch, currentStep]);

  useEffect(() => {
    // Clear search whenever step changes, regardless of what it changes to
    if (prevStepRef.current !== currentStep) {
      setSearchTerm("");
      setPredictions([]);
      setIsSearching(false);
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  // FIXED: Reset messages when entering edit mode
  useEffect(() => {
    if (isEditing && editingField) {
      // Reset messages to show only the relevant question
      switch (editingField) {
        case "pickup-location":
          setCurrentStep("pickup-location");
          setShowCustomInput(true);
          setShowPhoneInput(false);
          setShowLocationButtons(true);
          setMessages([
            { 
              id: Date.now(), 
              from: "them", 
              text: "Which location do you want to pickup from?", 
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
              status: "delivered" 
            }
          ]);
          break;
        case "delivery-location":
          setCurrentStep("delivery-location");
          setShowCustomInput(true);
          setShowPhoneInput(false);
          setShowLocationButtons(true);
          setMessages([
            { 
              id: Date.now(), 
              from: "them", 
              text: "Set your delivery location. Choose Delivery Location", 
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
              status: "delivered",
              hasChooseDeliveryButton: true,
              hasViewSavedLocations: true,
            }
          ]);
          break;
        case "pickup-items":
          setCurrentStep("pickup-items");
          setShowCustomInput(true);
          setShowPhoneInput(false);
          setShowLocationButtons(false);
          setMessages([
            { 
              id: Date.now(), 
              from: "them", 
              text: "What item(s) do you want to pick up?", 
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
              status: "delivered" 
            }
          ]);
          break;
        case "pickup-phone":
          setCurrentStep("pickup-phone");
          setShowPhoneInput(true);
          setShowCustomInput(false);
          setShowLocationButtons(false);
          setMessages([
            { 
              id: Date.now(), 
              from: "them", 
              text: "Please enter pick up phone number Use My Phone Number", 
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
              status: "delivered",
              hasUseMyNumberButton: true,
              phoneNumberType: "pickup",
            }
          ]);
          break;
        case "dropoff-phone":
          setCurrentStep("dropoff-phone");
          setShowPhoneInput(true);
          setShowCustomInput(false);
          setShowLocationButtons(false);
          setMessages([
            { 
              id: Date.now(), 
              from: "them", 
              text: "Kindly enter drop off phone number Use My Phone Number", 
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
              status: "delivered",
              hasUseMyNumberButton: true,
              phoneNumberType: "dropoff",
            }
          ]);
          break;
        default:
          break;
      }
    }
  }, [isEditing, editingField]);

  const handleSuggestionSelect = (prediction) => {
    const placeForMap = {
      name: prediction.structured_formatting?.main_text || prediction.description,
      address: prediction.description,
      lat: 6.5244 + (Math.random() * 0.1 - 0.05),
      lng: 3.3792 + (Math.random() * 0.1 - 0.05),
      predictionId: prediction.place_id
    };

    const locationText = prediction.description || prediction.structured_formatting?.main_text;

    if (!locationText) return;

    if (currentStep === "pickup-location") {
      send(locationText, "pickup-location");
    } else if (currentStep === "delivery-location") {
      send(locationText, "delivery");
    }

    setSelectedPlace(placeForMap);
    setSearchTerm(prediction.description);
    setPredictions([]);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setPredictions([]);
    setIsSearching(false);
    setSearchError(null);
  };

  const initialMessages = [
    { id: 1, from: "them", text: "Which location do you want to pickup from?", time: "12:25 PM", status: "delivered" },
  ];

  useEffect(() => {
    if (messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [messages, setMessages]);

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
    setSearchTerm("");
    setPredictions([]);
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

    if (source === "pickup-location") {
      pickupLocationRef.current = msgText;
      setPickupLocation(msgText);
      console.log('Stored typed pickup(s) location:', msgText);
    } else if (source === "delivery") {
      deliveryLocationRef.current = msgText;
      setDeliveryLocation(msgText);
      console.log('Stored typed delivery location pickup:', msgText);
    }

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

      //  edit
      if (isEditing) {
        if (editingField === "pickup-location" && source === "pickup-location") {
          const updatedData = {
            ...currentOrder,
            pickupLocation: msgText
          };
          onEditComplete(updatedData);
          return;
        }

        if (editingField === "delivery-location" && source === "delivery") {
          const updatedData = {
            ...currentOrder,
            deliveryLocation: msgText
          };
          onEditComplete(updatedData);
          return;
        }

        if (editingField === "pickup-phone" && source === "pickup-phone") {
          let formattedNumber = text;
          if (!text.startsWith("+234") && text.replace(/\D/g, '').length === 11) {
            formattedNumber = `+234${text.substring(1)}`;
          }
          const updatedData = {
            ...currentOrder,
            pickupPhone: formattedNumber
          };
          onEditComplete(updatedData);
          return;
        }

        if (editingField === "dropoff-phone" && source === "dropoff-phone") {
          let formattedNumber = text;
          if (!text.startsWith("+234") && text.replace(/\D/g, '').length === 11) {
            formattedNumber = `+234${text.substring(1)}`;
          }
          const updatedData = {
            ...currentOrder,
            dropoffPhone: formattedNumber
          };
          onEditComplete(updatedData);
          return;
        }

        if (editingField === "pickup-items" && source === "pickup-items") {
          const updatedData = {
            ...currentOrder,
            pickupItems: msgText
          };
          onEditComplete(updatedData);
          return;
        }
      }

      // NORMAL FLOW - Only run if not in edit mode
      if (!isEditing) {
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
        }

        if (source === "pickup-location" && !pickupItems) {
          setMessages((p) => [
            ...p,
            {
              id: Date.now() + 2,
              from: "them",
              text: "What item(s) do you want to pick up?",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
            },
          ]);
          setCurrentStep("pickup-items");
          setShowCustomInput(true);

        } else if (source === "pickup-items" && !pickupPhoneNumber) {
          setPickupItems(msgText);
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
          setShowCustomInput(false);
        } else if (source === "pickup-phone" && !deliveryLocation) {
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
              hasViewSavedLocations: true,
            },
          ]);
          setCurrentStep("delivery-location");
          setShowCustomInput(true);
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
          let formattedNumber = text;
          if (!text.startsWith("+234") && text.replace(/\D/g, '').length === 11) {
            formattedNumber = `+234${text.substring(1)}`;
          }
          setDropoffPhoneNumber(formattedNumber);

          console.log('Final pickup location ref:', pickupLocationRef.current);
          console.log('Final delivery location ref:', deliveryLocationRef.current);

          onSelectPickup({
            serviceType: "pick-up",
            pickupLocation: pickupLocationRef.current,
            deliveryLocation: deliveryLocationRef.current,
            pickupPhone: pickupPhoneNumber,
            dropoffPhone: formattedNumber,
            pickupItems: pickupItems,
            pickupCoordinates: selectedPlace ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : null,
            userId: currentUser?._id
          });
        }
      }
    }, 1200);
  };

  const handleUseMyNumber = (phoneType) => {
    const myNumber = currentUser?.phone || currentUser?.user?.phone;

    if (!myNumber) {
      console.error("Phone number not found in user data");

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
    setSelectedPlace(null);
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

    if (clean.length !== 11) return "Invalid Phone Number. Phone number must be 11 digits";
    if (!clean.startsWith('0')) return "Invalid Phone Number. Phone number must start with 0";
    if (!['080', '081', '070', '090', '091'].includes(clean.substring(0, 3))) {
      return "Invalid phone number prefix";
    }
    return null;
  };

  const getSearchPlaceholder = () => {
    if (currentStep === "pickup-location") {
      return "Search for pickup location...";
    } else if (currentStep === "delivery-location") {
      return "Search for delivery location...";
    } else if (currentStep === "pickup-items") {
      return "Enter item(s) to pick up..."
    }
    return "Search for a location...";
  };

  const handleSearchAction = () => {
    if (searchTerm.trim()) {
      if (currentStep === "pickup-location") {
        send(searchTerm, "pickup-location");
      } else if (currentStep === "delivery-location") {
        send(searchTerm, "delivery");
      } else if (currentStep === "pickup-items") {
        send(searchTerm, "pickup-items");
      }
      setSearchTerm("");
    }
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

          <Map key={currentStep} onLocationSelect={handleMapSelect} />

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
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-hidden relative">
          <div ref={listRef} className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full max-w-3xl mx-auto p-3 marketSelection">
              {messages.map((m) => (
                <p className="mx-auto" key={m.id}>
                  <Message
                    m={m}
                    showCursor={false}
                    onChooseDeliveryClick={m.hasChooseDeliveryButton ? handleChooseDeliveryClick : undefined}
                    onUseMyNumberClick={m.hasUseMyNumberButton ? () => handleUseMyNumber(m.phoneNumberType) : undefined}
                    onViewSavedLocations={m.hasViewSavedLocations ? () => onOpenSavedLocations(  // ← ADD THIS
                      true,
                      handleLocationSelectedFromSaved,
                      () => setShowLocationButtons(true)
                    ) : undefined}
                    disableContextMenu={true}
                  />
                </p>
              ))}

              <div className={`space-y-1 -mt-1 ${currentStep === "delivery-location" ? '-mt-3 pb-5' : ''}`}>
                {showLocationButtons && (currentStep === "pickup-location" || currentStep === "delivery-location") && !showPhoneInput && (
                  <div className="flex flex-col items-start">
                    {currentStep === "pickup-location" && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="text"
                          className="flex items-center py-2 px-4 text-left text-gray-800 dark:text-gray-300"
                          onClick={() => {
                            setSelectedPlace(null);
                            setShowMap(true);
                            setShowLocationButtons(false);
                          }}
                        >
                          <MapPin className="h-4 w-4 mr-2 text-gray-800 dark:text-gray-300" />
                          Find on map
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="text"
                        className="flex items-center py-2 px-4 text-left text-primary"
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
                    </div>
                  </div>
                )}
              </div>

              <div className="h-32 sm:h-32 lg:h-40 pb-32"></div>
            </div>
          </div>
        </div>

        <div className="absolute w-full bottom-8 sm:bottom-[40px] px-4 sm:px-8 lg:px-64 right-0 left-0">
          {showCustomInput && !showPhoneInput && (
            currentStep === "pickup-location" ||
            currentStep === "delivery-location" ||
            currentStep === "pickup-items"
          ) && (
              <div className="max-w-3xl mx-auto relative">
                <CustomInput
                  countryRestriction="us"
                  stateRestriction="ny"
                  showMic={false}
                  showIcons={false}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={getSearchPlaceholder()}
                  send={handleSearchAction}
                  className="placeholder:text-gray-800 dark:placeholder:text-gray-300"
                />

                {searchTerm.length >= 2 &&
                  (currentStep === "pickup-location" || currentStep === "delivery-location") &&
                  (predictions.length > 0 || isSearching) && (
                    <div className="absolute bottom-full mb-8 left-0 right-0 bg-gray-100 dark:bg-black-200 rounded-lg max-h-60 overflow-y-auto z-50">
                      {isSearching ? (
                        <div className="p-3 text-center text-sm text-gray-900 dark:text-white">Searching...</div>
                      ) : predictions.length === 0 ? (
                        <div className="p-3 text-center text-sm text-gray-900 dark:text-white">No locations found</div>
                      ) : (
                        predictions.map((p) => (
                          <button
                            key={p.place_id}
                            onClick={() => handleSuggestionSelect(p)}
                            className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-200 dark:hover:bg-black-100 border-b border-gray-300 dark:border-gray-700 last:border-0 transition-colors"
                          >
                            <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {p.structured_formatting?.main_text || p.description}
                              </p>
                              <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {p.structured_formatting?.secondary_text || p.description}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                {searchError && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-300 dark:border-red-800 z-50">
                    {searchError}
                  </div>
                )}
              </div>
            )}

          {showPhoneInput && (
            <div className="max-w-3xl mx-auto">
              <CustomInput
                value={phoneNumberInput}
                onChange={(e) => setPhoneNumberInput(e.target.value)}
                placeholder="Enter phone number"
                showMic={false}
                className="placeholder:dark:text-gray-300 placeholder:text-gray-800"
                showIcons={false}
                send={() => {
                  if (phoneNumberInput.trim()) {
                    if (currentStep === "pickup-phone") {
                      send(phoneNumberInput, "pickup-phone");
                    } else if (currentStep === "dropoff-phone") {
                      send(phoneNumberInput, "dropoff-phone");
                    }
                    setPhoneNumberInput("");
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </Onboarding>
  );
}