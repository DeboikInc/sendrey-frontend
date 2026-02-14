import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import useDarkMode from "../../hooks/useDarkMode";
import { useNavigate, useLocation, } from "react-router-dom";


import ServiceSelectionScreen from "../../components/screens/ServiceSelectionScreen";
import VehicleSelectionScreen from "../../components/screens/VehicleSelectionScreen";
import RunnerSelectionScreen from "../../components/screens/RunnerSelectionScreen";
import SavedLocationScreen from "../../components/screens/SavedLocationScreen";
import ErrandFlowScreen from "../../components/screens/ErrandFlowScreen";
import PickupFlowScreen from "../../components/screens/PickUpFlowScreen";
import ConfirmOrderScreen from "../../components/screens/ConfirmOrderScreen";

import ChatScreen from "../../components/screens/ChatScreen";
import { useDispatch } from "react-redux";
import BarLoader from "../../components/common/BarLoader";

import { fetchNearbyRunners } from "../../Redux/runnerSlice";
import { startEditing, finishEditing, updateOrder } from "../../Redux/orderSlice";


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
    const [serverUpdated, setServerUpdated] = useState(false); // NEW STATE

    // FIXED: Use single state variable for saved locations modal
    const [isSavedLocationsOpen, setIsSavedLocationsOpen] = useState(false);
    const [selectCallback, setSelectCallback] = useState(null);
    const [dismissCallback, setDismissCallback] = useState(null);

    // state declarations for marketscreen
    const [marketScreenMessages, setMarketScreenMessages] = useState([]);
    const [pickupLocation, setPickupLocation] = useState(null);
    const [deliveryLocation, setDeliveryLocation] = useState(null);

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmOrderData, setConfirmOrderData] = useState(null);

    const authState = useSelector((state) => state.auth);
    const orderState = useSelector((state) => state.order);

    const [runnerResponseData, setRunnerResponseData] = useState(null);

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

    const handleShowConfirmOrder = (orderData) => {
        setConfirmOrderData(orderData);
        setShowConfirmModal(true);
    };

    const handleConfirmOrderEdit = (field) => {
        // Store what we're editing
        dispatch(startEditing({ field }));

        // Close the modal
        setShowConfirmModal(false);

        // Navigate to the specific screen based on field
        setTimeout(() => {
            // Market/Pickup Location
            if (field === "market-location" || field === "pickup-location") {
                setCurrentScreen(selectedService === "pick-up" ? "pickup_screen" : "market_selection");
            }
            // Delivery Location
            else if (field === "delivery-location") {
                setCurrentScreen(selectedService === "pick-up" ? "pickup_screen" : "market_selection");
            }
            // Vehicle/Fleet Type
            else if (field === "fleet-type") {
                setCurrentScreen("vehicle_selection");
            }
            // Special Instructions
            else if (field === "special-instructions") {
                setCurrentScreen("vehicle_selection"); // Special instructions is in VehicleSelectionScreen
            }
            // Run Errand specific fields
            else if (field === "market-items" || field === "market-budget") {
                setCurrentScreen("market_selection");
            }
            // Pickup specific fields
            else if (field === "pickup-phone" || field === "dropoff-phone") {
                setCurrentScreen("pickup_screen");
            } else if (field === "pickup-items") {
                setCurrentScreen("pickup_screen");
            }
        }, 300);
    };

    // handle returning from edit
    const handleEditComplete = (updatedData) => {
        dispatch(updateOrder(updatedData));
        dispatch(finishEditing());

        // Navigate back to vehicle_selection first, then show modal
        setCurrentScreen("vehicle_selection");
        setTimeout(() => {
            setConfirmOrderData(updatedData);  
            setShowConfirmModal(true);
        }, 100);
    };

    const handleConfirmContinue = async () => {
        setShowConfirmModal(false);
        setShowConnecting(true);

        // fetch runners here
        const { userLocation, fleetType, serviceType } = confirmOrderData;

        try {
            const response = await dispatch(fetchNearbyRunners({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                serviceType: serviceType,
                fleetType: fleetType
            })).unwrap();

            // Set serverUpdated to true after successful fetch
            setServerUpdated(true);
            handleConnectToRunner(response);
        } catch (error) {
            setShowConnecting(false);
            console.error('Error fetching nearby runners:', error);
            alert('Failed to find nearby runners. Please try again.');
        }
    };

    const handleConnectToRunner = (runnersData) => {
        setRunnerResponseData(runnersData);
        setShowConnecting(true);

        setTimeout(() => {
            setShowConnecting(false);

            if (runnersData.error || !runnersData.runners || runnersData.runners.length === 0) {
                // No runners found - user stays on vehicle_selection to retry
                setShowRunnerSheet(true);
                // alert("No runners matching your service type found")
                setRunnerResponseData(null);
                // DON'T navigate away - user can retry
            } else {
                setShowRunnerSheet(true);
            }
        }, 3000);
    };

    // Pass this to child screens
    const screenProps = {
        isEditing: orderState.isEditing,
        editingField: orderState.editingField,
        currentOrder: orderState.currentOrder,
        onEditComplete: handleEditComplete
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
                            setSelectedService('pick-up');
                            updateUserData({ serviceType: 'pick-up' });
                            navigateTo("pickup_screen");
                        }}
                        onNavigateToErrand={() => {
                            setSelectedService('run-errand');
                            updateUserData({ serviceType: 'run-errand' });
                            navigateTo("market_selection"); // errand flow
                        }}
                    />
                );

            case "market_selection":
                return (
                    <ErrandFlowScreen
                        {...screenProps}
                        onOpenSavedLocations={handleOpenSavedLocations}
                        messages={marketScreenMessages}
                        setMessages={setMarketScreenMessages}
                        pickupLocation={pickupLocation}
                        setPickupLocation={setPickupLocation}
                        deliveryLocation={deliveryLocation}
                        setDeliveryLocation={setDeliveryLocation}
                        service={selectedMarket}
                        onSelectErrand={(data) => {
                            console.log('Errand data:', data);
                            console.log('marketCoordinates in received data:', data.marketCoordinates);
                            setSelectedMarket(data);
                            navigateTo("vehicle_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );
            case "pickup_screen":
                return (
                    <PickupFlowScreen
                        {...screenProps}
                        onOpenSavedLocations={handleOpenSavedLocations}
                        messages={marketScreenMessages}
                        setMessages={setMarketScreenMessages}
                        pickupLocation={pickupLocation}
                        setPickupLocation={setPickupLocation}
                        deliveryLocation={deliveryLocation}
                        setDeliveryLocation={setDeliveryLocation}
                        onSelectPickup={(data) => {
                            console.log('Pickup data:', data);
                            setSelectedMarket(data);
                            navigateTo("vehicle_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );

            case "vehicle_selection":
                return (
                    <VehicleSelectionScreen
                        {...screenProps}
                        service={selectedMarket}
                        selectedService={selectedService}
                        serverUpdated={serverUpdated}
                        onSelectVehicle={(fleetType) => {
                            setSelectedFleetType(fleetType);
                        }}
                        onConnectToRunner={handleConnectToRunner}
                        onShowConfirmOrder={handleShowConfirmOrder}
                        onFetchRunners={async (orderData) => {
                            setShowConnecting(true);
                            try {
                                const response = await dispatch(fetchNearbyRunners({
                                    latitude: orderData.userLocation.latitude,
                                    longitude: orderData.userLocation.longitude,
                                    serviceType: orderData.serviceType,
                                    fleetType: orderData.fleetType
                                })).unwrap();
                                handleConnectToRunner(response);
                            } catch (error) {
                                setShowConnecting(false);
                                console.error('Error fetching nearby runners:', error);
                                alert('Failed to find nearby runners. Please try again.');
                            }
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
                        userData={{
                            ...currentUser,
                            serviceType: selectedService,
                            _id: currentUser?._id || 'temp-user'
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}

                    // onBack={() => {

                    //     setShowRunnerSheet(true);
                    //     navigateTo("vehicle_selection");
                    // }}
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
                userData={{
                    ...currentUser,
                    serviceType: selectedService
                }}
                runnerResponseData={runnerResponseData}
                specialInstructions={confirmOrderData?.specialInstructions || null}
                onSelectRunner={(runner) => {
                    setSelectedRunner(runner);
                    setShowRunnerSheet(false);
                    navigateTo("chat");
                }}
                darkMode={dark}
                isOpen={showRunnerSheet}
                onClose={() => {
                    setShowRunnerSheet(false);
                    setRunnerResponseData(null); // Clear data when closed
                }}
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

            <ConfirmOrderScreen
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onContinue={handleConfirmContinue}
                orderData={confirmOrderData}
                onEdit={handleConfirmOrderEdit}
                onServerUpdated={() => setServerUpdated(true)}
                darkMode={dark}
            />
        </>
    );
};