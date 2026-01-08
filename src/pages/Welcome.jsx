import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import useDarkMode from "../hooks/useDarkMode";
import { useNavigate, useLocation, } from "react-router-dom";

import MarketSelectionScreen from "../components/screens/MarketSelectionScreen";
import ServiceSelectionScreen from "../components/screens/ServiceSelectionScreen";
import VehicleSelectionScreen from "../components/screens/VehicleSelectionScreen";
import RunnerSelectionScreen from "../components/screens/RunnerSelectionScreen";
import RunnerDashboardScreen from "../components/screens/RunnerDashboardScreen";
import SavedLocationScreen from "../components/screens/SavedLocationScreen";

import ChatScreen from "../components/screens/ChatScreen";
import { useDispatch } from "react-redux";
import BarLoader from "../components/common/BarLoader";


export const Welcome = () => {
    const [dark, setDark] = useDarkMode();
    const [userData, setUserData] = useState({});
    const [currentScreen, setCurrentScreen] = useState("service_selection");
    const location = useLocation();
    const [selectedRunner, setSelectedRunner] = useState(null);
    const [userType, setUserType] = useState(null);
    const [showRunnerSheet, setShowRunnerSheet] = useState(false);
    const [selectedService, setSelectedService] = useState("");
    const dispatch = useDispatch();

    const [selectedMarket, setSelectedMarket] = useState("");
    const [selectedFleetType, setSelectedFleetType] = useState("");
    const [showConnecting, setShowConnecting] = useState(false);

    // FIXED: Use single state variable for saved locations modal
    const [isSavedLocationsOpen, setIsSavedLocationsOpen] = useState(false);
    const [selectCallback, setSelectCallback] = useState(null);
    const [dismissCallback, setDismissCallback] = useState(null);

    // state declarations for marketscreen
    const [marketScreenMessages, setMarketScreenMessages] = useState([]);
    const [pickupLocation, setPickupLocation] = useState(null);
    const [deliveryLocation, setDeliveryLocation] = useState(null);

    const authState = useSelector((state) => state.auth);

    // Use authState.user for user data
    const currentUser = authState.user;
    const token = authState.token;
    console.log("token at welcome page:", token ? 'token exists' : 'no token');


    const updateUserData = (newData) => {
        setUserData({ ...userData, ...newData });
    };

    const navigateTo = (screen) => {
        setCurrentScreen(screen);
    };

    const handleClose = () => {
        setShowRunnerSheet(false);
    };

    const serviceType = location.state?.serviceType || "";

    const handleLocationSelectionFromSheet = (selectedLocation, locationType) => {
        console.log("Location selected from sheet:", selectedLocation, locationType);

        // ONLY call the callback - don't duplicate the logic
        if (selectCallback) {
            selectCallback(selectedLocation, locationType);
        }

        // Close the sheet
        setIsSavedLocationsOpen(false);

        // Clear the callback to prevent double-sending
        setSelectCallback(null);
    };

    const handleOpenSavedLocations = (
        open,
        onSelectCallback = null,
        onDismissCallback = null
    ) => {
        console.log("Opening saved locations:", open);
        setIsSavedLocationsOpen(open);

        // Store callbacks properly
        if (onSelectCallback) {
            setSelectCallback(() => onSelectCallback);
        }
        if (onDismissCallback) {
            setDismissCallback(() => onDismissCallback);
        }
    };


    const renderScreen = () => {
        switch (currentScreen) {
            case "service_selection":
                return (
                    <ServiceSelectionScreen
                        onSelectService={(service) => {
                            setSelectedService(service);
                            updateUserData({ service });
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        onNavigateToPickup={() => {
                            navigateTo("pickup_screen");
                        }}
                        onNavigateToErrand={() => {
                            navigateTo("market_selection"); // errand flow
                        }}
                    />
                );

            case "market_selection":
                return (
                    <MarketSelectionScreen
                        onOpenSavedLocations={handleOpenSavedLocations}
                        service={userData}
                        messages={marketScreenMessages}
                        setMessages={setMarketScreenMessages}
                        pickupLocation={pickupLocation}
                        setPickupLocation={setPickupLocation}
                        deliveryLocation={deliveryLocation}
                        setDeliveryLocation={setDeliveryLocation}
                        onSelectMarket={(location) => {
                            console.log('MARKET SELECTION - selectedService:', selectedService);

                            // clear state on successful navigation
                            setMarketScreenMessages([]);

                            setSelectedMarket(location);
                            navigateTo("vehicle_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );
            case "pickup_screen":
                return (
                    <MarketSelectionScreen
                        onOpenSavedLocations={handleOpenSavedLocations}
                        service={{ service: "pick-up" }}
                        messages={marketScreenMessages}
                        setMessages={setMarketScreenMessages}
                        pickupLocation={pickupLocation}
                        setPickupLocation={setPickupLocation}
                        deliveryLocation={deliveryLocation}
                        setDeliveryLocation={setDeliveryLocation}
                        onSelectMarket={(location) => {
                            console.log('PICKUP SCREEN - selectedService:', selectedService);

                            setMarketScreenMessages([]);
                            setSelectedMarket(location);
                            navigateTo("vehicle_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );

            case "vehicle_selection":
                return (
                    <VehicleSelectionScreen
                        service={selectedMarket}
                        selectedService={selectedService}
                        onSelectVehicle={(fleetType) => {
                            setSelectedFleetType(fleetType);
                        }}
                        onConnectToRunner={() => {
                            setShowConnecting(true);

                            setTimeout(() => {
                                setShowConnecting(false);
                                setShowRunnerSheet(true);
                            }, 10000);
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );

            case "chat":
                // chat with runner
                return (
                    <ChatScreen
                        runner={selectedRunner}
                        market={selectedMarket}
                        userData={currentUser || { _id: 'temp-user' }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );

            case "runner_dashboard":
                return (
                    <RunnerDashboardScreen
                        runner={selectedRunner}
                        market={selectedMarket}
                        userData={userData}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        onBack={() => navigateTo("runner_selection")}
                        onClose={handleClose}
                    />
                );

            default:
                return (
                    <ServiceSelectionScreen
                        onSelectRole={setUserType}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );
        }
    };

    return (
        <>
            <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
                <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                    {renderScreen()}
                </div>
            </div>

            {showConnecting && (
                <div className="fixed inset-0 flex flex-col justify-end items-center bg-black bg-opacity-80 z-50 pb-6 px-4 sm:pb-10">
                    <div className="flex flex-col lg:flex-row items-center justify-center gap-3 w-full max-w-md">
                        <div className="flex items-center justify-center mb-2 sm:mb-0">
                            <BarLoader />
                        </div>
                        <p className="text-base sm:text-lg font-medium dark:text-gray-200 text-center break-words">
                            Please wait while we connect you to a runner…
                        </p>
                    </div>
                </div>
            )}

            {/*  where runners are selected */}
            <RunnerSelectionScreen
                selectedVehicle={selectedFleetType}
                selectedLocation={selectedMarket}
                selectedService={selectedService}
                userData={currentUser}
                onSelectRunner={(runner) => {
                    setSelectedRunner(runner);
                    setShowRunnerSheet(false);
                    navigateTo("chat");
                }}
                darkMode={dark}
                isOpen={showRunnerSheet}
                onClose={() => setShowRunnerSheet(false)}
                className="overflow-visible"
            />


            <SavedLocationScreen
                isOpen={isSavedLocationsOpen}
                onDismiss={() => {
                    if (dismissCallback) {
                        dismissCallback();
                    }
                    setIsSavedLocationsOpen(false);
                }}
                onClose={() => setIsSavedLocationsOpen(false)}
                onSelectLocation={handleLocationSelectionFromSheet}
                isSelectingDelivery={
                    marketScreenMessages.some(m => m.hasChooseDeliveryButton) && !deliveryLocation
                }
                darkMode={dark}
            />
        </>
    );
};