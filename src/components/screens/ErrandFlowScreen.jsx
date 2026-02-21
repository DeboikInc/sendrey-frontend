// components/screens/ErrandFlow.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@material-tailwind/react";
import { MapPin, X, Bookmark, Check } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";
import Map from "../common/Map";
import { useDispatch } from "react-redux";
import { addLocation } from "../../Redux/userSlice";
import { useSelector } from "react-redux";
import debounce from "lodash/debounce";

const initialMessages = [
    { id: 1, from: "them", text: "Which market would you like us to go to?", time: "12:25 PM", status: "delivered" },
];

export default function ErrandFlowScreen({
    onOpenSavedLocations,
    messages,
    setMessages,
    pickupLocation,
    setPickupLocation,
    deliveryLocation,
    setDeliveryLocation,
    onSelectErrand,
    darkMode,
    toggleDarkMode,
    service,
    isEditing,
    editingField,
    currentOrder,
    onEditComplete
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showMap, setShowMap] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [showLocationButtons, setShowLocationButtons] = useState(true);
    const [currentStep, setCurrentStep] = useState("market-location");
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [pendingPlace, setPendingPlace] = useState(null);
    const [showCustomInput, setShowCustomInput] = useState(true);

    // Market run states
    const [marketItems, setMarketItems] = useState("");
    const [budget, setBudget] = useState("");
    const [budgetFlexibility, setBudgetFlexibility] = useState("stay within budget");

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

    const currentUser = authState.user;

    // Autoscroll
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
    }, [messages, showCustomInput, currentStep, predictions.length]);

    const searchPlaces = async (query, options = {}) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            if (!query || query.length < 2) return [];

            const mockPredictions = [
                {
                    place_id: "1",
                    description: `${query} Street, Lagos`,
                    structured_formatting: { main_text: `${query} Street`, secondary_text: "Lagos, Nigeria" }
                },
                {
                    place_id: "2",
                    description: `${query} Market, Lagos`,
                    structured_formatting: { main_text: `${query} Market`, secondary_text: "Lagos Island, Nigeria" }
                },
                {
                    place_id: "3",
                    description: `${query} Plaza, Abuja`,
                    structured_formatting: { main_text: `${query} Plaza`, secondary_text: "Abuja, Nigeria" }
                }
            ];

            return mockPredictions;
        } catch (error) {
            console.error("Search error:", error);
            throw error;
        }
    };

    // Fixed debounce using useCallback (like PickupFlow)
    const debouncedSearch = useCallback(
        debounce(async (query, step) => {
            // Only search during location steps
            if (step !== "market-location" && step !== "delivery-location") {
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

    // Clear search whenever step changes
    useEffect(() => {
        if (prevStepRef.current !== currentStep) {
            setSearchTerm("");
            setPredictions([]);
            setIsSearching(false);
            prevStepRef.current = currentStep;
        }
    }, [currentStep]);

    // Edit mode support
    useEffect(() => {
        if (isEditing && editingField) {
            switch (editingField) {
                case "market-location":
                    setCurrentStep("market-location");
                    setShowCustomInput(true);
                    setShowLocationButtons(true);
                    setMessages([{
                        id: Date.now(),
                        from: "them",
                        text: "Which market would you like us to go to?",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered"
                    }]);
                    break;
                case "market-items":
                    setCurrentStep("market-items");
                    setShowCustomInput(true);
                    setShowLocationButtons(false);
                    setMessages([{
                        id: Date.now(),
                        from: "them",
                        text: "What items do you need from the market?",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered"
                    }]);
                    break;
                case "market-budget":
                    setCurrentStep("market-budget");
                    setShowCustomInput(true);
                    setShowLocationButtons(false);
                    setMessages([{
                        id: Date.now(),
                        from: "them",
                        text: "What's your total budget for these items?",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered"
                    }]);
                    break;
                case "delivery-location":
                    setCurrentStep("delivery-location");
                    setShowCustomInput(true);
                    setShowLocationButtons(true);
                    setMessages([{
                        id: Date.now(),
                        from: "them",
                        text: "Set your delivery location. Choose Delivery Location",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered",
                        hasChooseDeliveryButton: true,
                    }]);
                    break;
                default:
                    break;
            }
        }
    }, [isEditing, editingField]);

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

        if (currentStep === "market-location") {
            setPickupLocation(locationText);
            pickupLocationRef.current = locationText;
            send(locationText, "market-location");
        } else if (currentStep === "delivery-location") {
            setDeliveryLocation(locationText);
            deliveryLocationRef.current = locationText;
            send(locationText, "delivery");
        }

        setShowSaveConfirm(false);
        setShowMap(false);
        // Clear selected place after each map use
        setSelectedPlace(null);
        setPendingPlace(null);
        setSearchTerm("");
        setPredictions([]);
    };

    const handleLocationSelectedFromSaved = (location) => {
        const locationText = location.address || location.name;

        if (currentStep === "market-location") {
            setPickupLocation(locationText);
            pickupLocationRef.current = locationText;
            send(locationText, "market-location");
        } else if (currentStep === "delivery-location") {
            setDeliveryLocation(locationText);
            deliveryLocationRef.current = locationText;
            send(locationText, "delivery");
        }
    };

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

        if (currentStep === "market-location") {
            send(locationText, "market-location");
        } else if (currentStep === "delivery-location") {
            send(locationText, "delivery");
        }

        setSelectedPlace(placeForMap);
        setSearchTerm(prediction.description);
        setPredictions([]);
    };

    const handleSearchAction = () => {
        if (searchTerm.trim()) {
            if (currentStep === "market-location") {
                send(searchTerm, "market-location");
            } else if (currentStep === "delivery-location") {
                send(searchTerm, "delivery");
            } else if (currentStep === "market-items") {
                send(searchTerm, "market-items");
            } else if (currentStep === "market-budget") {
                send(searchTerm, "market-budget");
            }
            setSearchTerm("");
        }
    };

    const getSearchPlaceholder = () => {
        if (currentStep === "market-location") return "Search for market location...";
        if (currentStep === "delivery-location") return "Search for delivery location...";
        if (currentStep === "market-items") return "Enter items you need...";
        if (currentStep === "market-budget") return "Enter your budget...";
        return "Type here...";
    };

    const send = (text, source) => {
        if (!text || typeof text !== "string") return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const msgText = text.trim();
        setShowLocationButtons(false);

        if (source === "market-location") {
            pickupLocationRef.current = msgText;
            setPickupLocation(msgText);
        } else if (source === "delivery") {
            deliveryLocationRef.current = msgText;
            setDeliveryLocation(msgText);
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

        const botResponse = {
            id: Date.now() + 1,
            from: "them",
            text: "In progress...",
            status: "delivered",
        };

        setMessages((p) => [...p, botResponse]);

        timeoutRef.current = setTimeout(() => {
            setMessages((prev) => prev.filter((msg) => msg.text !== "In progress..."));

            // Edit mode handling
            if (isEditing) {
                if (editingField === "market-location" && source === "market-location") {
                    onEditComplete({ ...currentOrder, marketLocation: msgText });
                    return;
                }
                if (editingField === "market-items" && source === "market-items") {
                    onEditComplete({ ...currentOrder, marketItems: msgText });
                    return;
                }
                if (editingField === "market-budget" && source === "market-budget") {
                    const budgetNum = parseFloat(msgText.replace(/[^0-9.]/g, ""));
                    onEditComplete({ ...currentOrder, budget: isNaN(budgetNum) ? msgText : budgetNum });
                    return;
                }
                if (editingField === "delivery-location" && source === "delivery") {
                    onEditComplete({ ...currentOrder, deliveryLocation: msgText });
                    return;
                }
            }

            // Normal flow
            if (!isEditing) {
                if (source === "market-location") {
                    setPickupLocation(msgText);

                    setMessages(prev => [...prev, {
                        id: Date.now() + 2,
                        from: "them",
                        text: "What items do you need from the market?",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered",
                    }]);
                    setCurrentStep("market-items");
                    setShowCustomInput(true);

                } else if (source === "market-items") {
                    setMarketItems(msgText);

                    setMessages(prev => [...prev, {
                        id: Date.now() + 2,
                        from: "them",
                        text: "What's your total budget for these items?",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered",
                    }]);
                    setCurrentStep("market-budget");
                    setShowCustomInput(true);

                } else if (source === "market-budget") {
                    const budgetNum = parseFloat(msgText.replace(/[^0-9.]/g, ""));
                    if (!isNaN(budgetNum)) {
                        setBudget(budgetNum);

                        setMessages(prev => [...prev, {
                            id: Date.now() + 2,
                            from: "them",
                            text: `Should the runner stay strictly within ₦${budgetNum}, or can they adjust slightly if needed?`,
                            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            status: "delivered",
                            hasBudgetFlexibilityButtons: true,
                        }]);
                        setCurrentStep("budget-flexibility");
                        setShowCustomInput(false);
                    }

                } else if (source === "budget-flexibility") {
                    const isStrict = text === "stay within budget" || text.includes("stay within budget");
                    setBudgetFlexibility(isStrict ? "stay within budget" : "can adjust slightly");

                    setMessages(prev => [...prev, {
                        id: Date.now() + 2,
                        from: "them",
                        text: "Set your delivery location. Choose Delivery Location",
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered",
                        hasChooseDeliveryButton: true,
                    }]);
                    setCurrentStep("delivery-location");
                    setTimeout(() => setShowLocationButtons(true), 200);
                    setShowCustomInput(true);

                } else if (source === "delivery") {
                    setDeliveryLocation(msgText);

                    onSelectErrand({
                        serviceType: "run-errand",
                        marketLocation: pickupLocationRef.current,
                        deliveryLocation: msgText,
                        marketItems,
                        budget,
                        budgetFlexibility,
                        userId: currentUser?._id
                    });
                }
            }
        }, 1200);
    };

    const handleChooseDeliveryClick = () => {
        setSelectedPlace(null); // Clear before opening map
        setShowMap(true);
        setShowLocationButtons(true);
    };

    const handleBudgetFlexibility = (choice) => {
        send(choice, "budget-flexibility");
    };

    if (showMap) {
        return (
            <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
                <div className="w-full h-full flex flex-col mx-auto overflow-hidden max-w-2xl">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b">
                        <Button
                            variant="text"
                            onClick={() => {
                                setShowMap(false);
                                setShowLocationButtons(true);
                                setSelectedPlace(null); // Clear on close
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
                    <div
                        ref={listRef}
                        className="absolute inset-0 overflow-y-auto"
                    >
                        <div className="min-h-full max-w-3xl mx-auto p-3 marketSelection">
                            {messages.map((m) => (
                                <p className="mx-auto" key={m.id}>
                                    <Message
                                        m={m}
                                        showCursor={false}
                                        onChooseDeliveryClick={m.hasChooseDeliveryButton ? handleChooseDeliveryClick : undefined}
                                        onBudgetFlexibilityClick={m.hasBudgetFlexibilityButtons ? handleBudgetFlexibility : undefined}
                                        onViewSavedLocations={m.hasViewSavedLocations ? () => onOpenSavedLocations(
                                            true,
                                            handleLocationSelectedFromSaved,
                                            () => setShowLocationButtons(true)
                                        ) : undefined}
                                    />
                                </p>
                            ))}

                            <div className={`space-y-1 -mt-1 ${currentStep === "delivery-location" ? '-mt-6 pb-5' : ''}`}>
                                {showLocationButtons && (currentStep === "market-location" || currentStep === "delivery-location") && (
                                    <>
                                        {currentStep === "market-location" && (
                                            <Button
                                                variant="text"
                                                className="w-full flex items-center py-2"
                                                onClick={() => {
                                                    setSelectedPlace(null); // Clear before opening map
                                                    setShowMap(true);
                                                    setShowLocationButtons(false);
                                                }}
                                            >
                                                <MapPin className="h-4 w-4 mr-2" />
                                                Find on map
                                            </Button>
                                        )}

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

                            <div className="h-32 sm:h-32 lg:h-40 pb-32"></div>
                        </div>
                    </div>
                </div>

                <div className="absolute w-full bottom-8 sm:bottom-[40px] px-4 sm:px-8 lg:px-64 right-0 left-0">
                    {showCustomInput && (
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
                            />

                            {/* Location search suggestions - only for location steps */}
                            {searchTerm.length >= 2 &&
                                (currentStep === "market-location" || currentStep === "delivery-location") &&
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
                </div>
            </div>
        </Onboarding>
    );
}