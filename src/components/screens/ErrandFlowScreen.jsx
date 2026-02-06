// components/screens/ErrandFlow.jsx
import { useEffect, useRef, useState,  } from "react";
import { Button } from "@material-tailwind/react";
import { MapPin, X, Bookmark, Check } from "lucide-react";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";
import Map from "../common/Map";
import { useDispatch } from "react-redux";
import { addLocation } from "../../Redux/userSlice";
import { useSelector } from "react-redux";

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
    service
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showMap, setShowMap] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [showLocationButtons, setShowLocationButtons] = useState(true);
    const [currentStep, setCurrentStep] = useState("market-location");
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [pendingPlace, setPendingPlace] = useState(null);
    const [showCustomInput, setShowCustomInput] = useState(true);

    // NEW STATES FOR MARKET RUN
    const [marketItems, setMarketItems] = useState("");
    const [budget, setBudget] = useState("");
    const [budgetFlexibility, setBudgetFlexibility] = useState("stay within budget");

    const dispatch = useDispatch();
    const listRef = useRef(null);
    const timeoutRef = useRef(null);
    const deliveryLocationRef = useRef(null);
    const pickupLocationRef = useRef(null);
    const authState = useSelector((state) => state.auth);

    // Use authState.user for user data
    const currentUser = authState.user;

    useEffect(() => {
        if (messages.length === 0) {
            setMessages(initialMessages);
        }
    }, [messages, setMessages,]);

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
        setSelectedPlace(null);
        setPendingPlace(null);
    };

    const handleLocationSelectedFromSaved = (location, type) => {
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

                // ERRAND FLOW LOGIC
                if (source === "market-location") {
                    setPickupLocation(text);

                    // Ask for items
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
                    setMarketItems(text);

                    // Ask for budget
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
                    const budgetNum = parseFloat(text.replace(/[^0-9.]/g, ""));
                    if (!isNaN(budgetNum)) {
                        setBudget(budgetNum);

                        // Ask about budget flexibility
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

                    // Ask for delivery location
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

                } else if (source === "delivery") {
                    setDeliveryLocation(text);

                    // Pass ALL data to parent
                    onSelectErrand({
                        serviceType: "run-errand",
                        pickupLocation: pickupLocationRef.current,
                        deliveryLocation: text,
                        marketItems,
                        budget,
                        budgetFlexibility,
                        userId: currentUser?._id
                    });
                }
            }, 900);
        }, 1200);
    };

    const handleChooseDeliveryClick = () => {
        setShowMap(true);
        setShowLocationButtons(true);
    };

    const handleBudgetFlexibility = (choice) => {
        send(choice, "budget-flexibility");
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
                                onBudgetFlexibilityClick={m.hasBudgetFlexibilityButtons ? handleBudgetFlexibility : undefined}
                            />
                        </p>
                    ))}

                    <div className={`space-y-1 -mt-1 ${currentStep === "delivery-location" ? '-mt-6 pb-5' : ''}`}>
                        {showLocationButtons && currentStep === "market-location" && !showCustomInput && (
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

            <div className="fixed inset-x-0 bottom-0 h-10 bg-white dark:bg-black z-10"></div>
            <div className="fixed bottom-0 left-0 right-0 p-4 z-20">
                {/* // Update the CustomInput section: */}
                {showCustomInput && (
                    <CustomInput
                        showMic={false}
                        showIcons={false}
                        value={
                            currentStep === "market-location" ? searchTerm :
                                currentStep === "market-items" ? marketItems :
                                // validate budget > 10m
                                    currentStep === "market-budget" ? budget : ""
                        }
                        onChange={(e) => {
                            const value = e.target.value;
                            if (currentStep === "market-location") setSearchTerm(value);
                            else if (currentStep === "market-items") setMarketItems(value);
                            else if (currentStep === "market-budget") setBudget(value);
                        }}
                        placeholder={
                            currentStep === "market-location" ? "Search for a market..." :
                                currentStep === "market-items" ? "List the items you need..." :
                                    currentStep === "market-budget" ? "Enter your budget (e.g., ₦15,000)..." : ""
                        }
                        // FIX: Add the send function prop
                        send={() => {
                            const textToSend =
                                currentStep === "market-location" ? searchTerm :
                                    currentStep === "market-items" ? marketItems :
                                        currentStep === "market-budget" ? budget : "";

                            if (textToSend.trim()) {
                                send(textToSend, currentStep);

                                // Clear input after sending
                                if (currentStep === "market-location") setSearchTerm("");
                                else if (currentStep === "market-items") setMarketItems("");
                                else if (currentStep === "market-budget") setBudget("");
                            }
                        }}
                    />
                )}
            </div>
        </Onboarding>
    );
}