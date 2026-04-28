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

import { getSuggestionStatus } from "../../Redux/businessSlice";
import BusinessConversionFlow from "./BusinessConversionFlow";

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
    onEditComplete,
    onMore,
    onBack,
    showBack
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
    const authState = useSelector(s => s.auth.user);
    const prevStepRef = useRef(null);
    const isSubmittingRef = useRef(false);

    const [showConversionFlow, setShowConversionFlow] = useState(false);

    // location coordinates
    const marketCoordinatesRef = useRef(null);
    const deliveryCoordinatesRef = useRef(null);

    const currentUser = authState?.user ?? authState;

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

    const searchPlaces = useCallback((query, step) => {
        if (!query || query.length < 2 || !window.google) {
            setPredictions([]);
            return;
        }
        if (step !== "market-location" && step !== "delivery-location") {
            setPredictions([]);
            return;
        }

        setIsSearching(true);
        setSearchError(null);

        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions(
            {
                input: query,
                componentRestrictions: { country: 'ng' },
                locationBias: {
                    center: new window.google.maps.LatLng(6.5244, 3.3792),
                    radius: 50000,
                },
            },
            (results, status) => {
                if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
                    setPredictions([]);
                    setIsSearching(false);
                    return;
                }
                setPredictions(results.map((p) => ({
                    place_id: p.place_id,
                    description: p.description,
                    structured_formatting: {
                        main_text: p.structured_formatting.main_text,
                        secondary_text: p.structured_formatting.secondary_text,
                    },
                    lat: null, // resolved on select via getDetails
                    lng: null,
                })));
                setIsSearching(false);
            }
        );
    }, []);

    // Fixed debounce using useCallback (like PickupFlow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSearch = useCallback(
        debounce(async (query, step) => {
            // Only search during location steps
            if (step !== "market-location" && step !== "delivery-location") {
                setPredictions([]);
                setIsSearching(false);
                return;
            }
            searchPlaces(query, step)
        }, 400),
        []
    );

    // budget parsing and formatting
    const parseBudgetInput = (text) => {
        const trimmed = text.trim().toLowerCase();
        let cleaned = trimmed.replace(/[₦,]/g, '').trim();

        const kMatch = cleaned.match(/^(\d+\.?\d*)\s*k$/);
        if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

        const thousandMatch = cleaned.match(/^(\d+\.?\d*)\s*thousand(\s*naira)?$/);
        if (thousandMatch) return Math.round(parseFloat(thousandMatch[1]) * 1000);

        const millionMatch = cleaned.match(/^(\d+\.?\d*)\s*(million|m)(\s*naira)?$/);
        if (millionMatch) return Math.round(parseFloat(millionMatch[1]) * 1000000);

        const plainMatch = cleaned.match(/^(\d+\.?\d*)(\s*naira)?$/);
        if (plainMatch) return Math.round(parseFloat(plainMatch[1])); // ← round decimals silently

        // Negative numbers — catch "-5000"
        if (cleaned.startsWith('-')) return -1;

        return null;
    };

    const formatBudgetDisplay = (amount) => {
        return `₦${amount.toLocaleString('en-NG')}`;
    };

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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, editingField]);

    useEffect(() => {
        if (messages.length === 0) {
            setMessages(initialMessages);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            marketCoordinatesRef.current = { lat: place.lat, lng: place.lng };
            setPickupLocation(locationText);
            pickupLocationRef.current = locationText;
            send(locationText, "market-location");
        } else if (currentStep === "delivery-location") {
            deliveryCoordinatesRef.current = { lat: place.lat, lng: place.lng };
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
            if (location.lat && location.lng) marketCoordinatesRef.current = { lat: location.lat, lng: location.lng };
            setPickupLocation(locationText);
            pickupLocationRef.current = locationText;
            send(locationText, "market-location");
        } else if (currentStep === "delivery-location") {
            if (location.lat && location.lng) deliveryCoordinatesRef.current = { lat: location.lat, lng: location.lng };
            setDeliveryLocation(locationText);
            deliveryLocationRef.current = locationText;
            send(locationText, "delivery");
        }
    };

    const handleSuggestionSelect = (prediction) => {
        if (!window.google || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setShowCustomInput(false);

        const service = new window.google.maps.places.PlacesService(
            document.createElement('div')
        );
        service.getDetails(
            { placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'name'] },
            (result, status) => {
                if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
                    isSubmittingRef.current = false;
                    setShowCustomInput(true);
                    return;
                };

                const lat = result.geometry.location.lat();
                const lng = result.geometry.location.lng();
                const locationText = prediction.description;

                if (currentStep === "market-location") {
                    marketCoordinatesRef.current = { lat, lng };
                    send(locationText, "market-location");
                } else if (currentStep === "delivery-location") {
                    deliveryCoordinatesRef.current = { lat, lng };
                    send(locationText, "delivery");
                }

                setSelectedPlace({ name: result.name, address: result.formatted_address, lat, lng });
                setSearchTerm(result.name);
                setPredictions([]);
            }
        );
    };

    const handleSearchAction = async () => {
        if (!searchTerm.trim() || isSubmittingRef.current) return;

        const text = searchTerm.trim();

        // For non-location steps, just send directly
        if (currentStep !== 'market-location' && currentStep !== 'delivery-location') {
            send(text, currentStep === 'market-items' ? 'market-items' : 'market-budget');
            setSearchTerm('');
            isSubmittingRef.current = false;
            return;
        }

        if (!window.google) {
            setSearchError('Maps not ready yet. Please wait a moment and try again.');
            return;
        }

        isSubmittingRef.current = true;
        setShowCustomInput(false);

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
            {
                address: text + ', Lagos, Nigeria',
                componentRestrictions: { country: 'ng' },
            },
            (results, status) => {
                if (status === 'OK' && results[0]) {
                    const lat = results[0].geometry.location.lat();
                    const lng = results[0].geometry.location.lng();

                    // use the user's original text, not Google's formatted address
                    if (currentStep === 'market-location') {
                        marketCoordinatesRef.current = { lat, lng };
                        setPickupLocation(text);
                        pickupLocationRef.current = text;
                        send(text, 'market-location');
                    } else if (currentStep === 'delivery-location') {
                        deliveryCoordinatesRef.current = { lat, lng };
                        setDeliveryLocation(text);
                        deliveryLocationRef.current = text;
                        send(text, 'delivery');
                    }

                    setSearchTerm('');
                    setPredictions([]);
                    setSearchError(null);
                } else {
                    // Don't send — coordinates are required
                    setSearchError('Could not find that location. Try being more specific or use the map/suggestions.');
                    setShowCustomInput(true);
                    isSubmittingRef.current = false;
                }
            }
        );
    };

    const getSearchPlaceholder = () => {
        if (currentStep === "market-location") return "Search for market location...";
        if (currentStep === "delivery-location") return "Search for delivery location...";
        if (currentStep === "market-items") return "Enter items you need...";
        if (currentStep === "market-budget") return "Enter your budget...";
        return "Type here...";
    };


    const checkAndShowSuggestion = async () => {
        try {
            const suggestionResult = await dispatch(getSuggestionStatus()).unwrap();
            if (suggestionResult?.shouldSuggest) {
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: Date.now() + 10,
                        from: "them",
                        text: `🚀 You've used Sendrey ${suggestionResult.monthlyTaskCount} times this month! Upgrade to a Business Account to unlock team access, expense reports & scheduled deliveries.`,
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered",
                        isBusinessSuggestion: true,
                        onBusinessSuggestionAccept: () => setShowConversionFlow(true),
                    }]);
                }, 2000);
            }
        } catch (err) {
            // fail silently — suggestion is non-critical
        }
    };

    const validateField = (text, source) => {
        const trimmed = text.trim();

        if (source === "market-location" || source === "delivery") {
            if (!trimmed || trimmed.length < 3)
                return "Invalid answer. Input must be a valid location (at least 3 characters).";
            if (!/[a-zA-Z]/.test(trimmed))
                return "Invalid answer. Input must be a text location.";
            if (!/[a-zA-Z]{2,}/.test(trimmed))
                return "Invalid answer. Input must be a valid location name.";
            return null;
        }

        if (source === "market-items") {
            if (!trimmed || trimmed.length < 2)
                return "Invalid answer. Input must be a text description of your item(s).";
            if (/^\d+$/.test(trimmed))
                return "Invalid answer. Input must be text describing the item(s), not just a number.";
            return null;
        }

        if (source === "market-budget") {
            const parsed = parseBudgetInput(text);

            if (parsed === null || isNaN(parsed))
                return "Invalid budget. Enter a number like 5000, 5k, or 5 thousand.";
            if (parsed < 0)
                return "Budget cannot be negative. Please enter a valid amount.";
            if (parsed === 0)
                return "Budget must be greater than zero.";
            if (parsed < 1000)
                return "Budget seems too low. Minimum budget is ₦1000.";
            if (parsed > 500_000) {
                return "Budget cannot exceed ₦500,000 per order. Please enter a realistic amount.";
            }
            return null;
        }

        return null;
    };

    const send = (text, source) => {
        if (!text || typeof text !== "string") return;
        isSubmittingRef.current = false;

        // ── Field validation ──────────────────────────────────────
        const validationError = validateField(text, source);
        if (validationError) {
            const newMsg = {
                id: Date.now(),
                from: "me",
                text: text.trim(),
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "sent",
            };
            setMessages((prev) => [...prev, newMsg]);

            const inProgress = { id: Date.now() + 1, from: "them", text: "In progress...", status: "delivered" };
            setMessages((p) => [...p, inProgress]);

            setTimeout(() => {
                setMessages((prev) => prev.filter((m) => m.text !== "In progress..."));
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now() + 2,
                        from: "them",
                        text: validationError,
                        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        status: "delivered",
                    },
                ]);

                // Re-show the correct input for the failed step
                if (source === "market-location" || source === "delivery") {
                    setShowCustomInput(true);
                    setShowLocationButtons(true);
                } else if (source === "market-items" || source === "market-budget") {
                    setShowCustomInput(true);
                }
            }, 1200);

            return;
        }

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
            if (isEditing && onEditComplete) {
                if (editingField === "market-location" && source === "market-location") {
                    onEditComplete({
                        ...currentOrder,
                        marketLocation: msgText,
                        marketCoordinates: marketCoordinatesRef.current
                    });
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
                    onEditComplete({
                        ...currentOrder,
                        deliveryLocation: msgText,
                        deliveryCoordinates: deliveryCoordinatesRef.current
                    });
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
                    const parsedBudget = parseBudgetInput(msgText);

                    if (!isNaN(parsedBudget) && parsedBudget > 0) {
                        setBudget(parsedBudget);

                        const needsConfirmation = /[k]|thousand|million/i.test(msgText) || parsedBudget <= 500_000;

                        const confirmText = `Please confirm your budget is ${formatBudgetDisplay(parsedBudget)}. Does that look right?`;

                        if (needsConfirmation) {
                            setMessages(prev => [...prev, {
                                id: Date.now() + 2,
                                from: "them",
                                text: confirmText,
                                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                status: "delivered",
                                hasBudgetConfirmButtons: true,
                                confirmedBudget: parsedBudget,
                            }]);
                            setCurrentStep("budget-confirm");
                            setShowCustomInput(false);
                        } else {
                            setMessages(prev => [...prev, {
                                id: Date.now() + 2,
                                from: "them",
                                text: `Should the runner stay strictly within ${formatBudgetDisplay(parsedBudget)}, or can they adjust slightly if needed?`,
                                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                status: "delivered",
                                hasBudgetFlexibilityButtons: true,
                            }]);
                            setCurrentStep("budget-flexibility");
                            setShowCustomInput(false);
                        }
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
                        userId: currentUser?._id,
                        marketCoordinates: marketCoordinatesRef.current,
                        deliveryCoordinates: deliveryCoordinatesRef.current
                    });

                    // call business status
                    checkAndShowSuggestion();
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


    const handleBudgetConfirm = (confirmed, confirmedBudget) => {
        if (confirmed) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                from: "me",
                text: "Yes, that's correct",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "sent",
            }]);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                from: "them",
                text: `Should the runner stay strictly within ${formatBudgetDisplay(confirmedBudget)}, or can they adjust slightly if needed?`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
                hasBudgetFlexibilityButtons: true,
            }]);
            setCurrentStep("budget-flexibility");
        } else {
            setMessages(prev => [...prev, {
                id: Date.now(),
                from: "me",
                text: "No, let me re-enter",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "sent",
            }]);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                from: "them",
                text: "What's your total budget for these items?",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "delivered",
            }]);
            setCurrentStep("market-budget");
            setBudget("");
            setShowCustomInput(true);
        }
    };

    if (showMap) {
        return (
            <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode} onMore={onMore}>
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

                    <Map onLocationSelect={handleMapSelect} />

                    {selectedPlace && (
                        <div className="p-4 bg-white dark:bg-gray-800 border-t">
                            <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                                <p className="font-semibold text-blue-800 dark:text-blue-200">Selected Location:</p>
                                <p className="text-blue-600 dark:text-blue-300">
                                    {selectedPlace.name || selectedPlace.address}
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

    if (showConversionFlow) {
        return (
            <BusinessConversionFlow
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                onMore={onMore}
                onComplete={() => setShowConversionFlow(false)}
            />
        );
    }

    return (
        <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode} onMore={onMore} showBack={showBack} onBack={onBack}>
            <div className="flex flex-col h-screen">
                <div className="flex-1 overflow-y-auto marketSelection" ref={listRef}>
                    <div>
                        <div className="min-h-full max-w-3xl mx-auto p-3">
                            {messages.map((m) => (
                                <p className="mx-auto" key={m.id}>
                                    <Message
                                        m={m}
                                        showCursor={false}
                                        showStatusIcons={false}
                                        onChooseDeliveryClick={m.hasChooseDeliveryButton ? handleChooseDeliveryClick : undefined}
                                        onBudgetFlexibilityClick={m.hasBudgetFlexibilityButtons ? handleBudgetFlexibility : undefined}
                                        onBudgetConfirmClick={m.hasBudgetConfirmButtons ? handleBudgetConfirm : undefined}
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

                            <div className="h-48 sm:h-40 lg:h-40 pb-48"></div>
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 w-full px-4 sm:px-8 lg:px-28 py-3 bg-gray-100 dark:bg-black-200 z-10">
                    {showCustomInput && (
                        <div className="w-full mx-auto relative">
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