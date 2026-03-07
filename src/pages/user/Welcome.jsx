import { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import useDarkMode from "../../hooks/useDarkMode";

import ServiceSelectionScreen from "../../components/screens/ServiceSelectionScreen";
import VehicleSelectionScreen from "../../components/screens/VehicleSelectionScreen";
import RunnerSelectionScreen from "../../components/screens/RunnerSelectionScreen";
import SavedLocationScreen from "../../components/screens/SavedLocationScreen";
import ErrandFlowScreen from "../../components/screens/ErrandFlowScreen";
import PickupFlowScreen from "../../components/screens/PickUpFlowScreen";
import ConfirmOrderScreen from "../../components/screens/ConfirmOrderScreen";

import Settings from "./settings/Settings";
import UserWallet from "../../components/screens/UserWallet";
import MoreMenu from "../../components/screens/MoreMenu";

import ChatScreen from "../../components/screens/ChatScreen";
import { useDispatch } from "react-redux";
import BarLoader from "../../components/common/BarLoader";

import { fetchNearbyRunners } from "../../Redux/runnerSlice";
import { startEditing, finishEditing, updateOrder } from "../../Redux/orderSlice";

import { useCredentialFlow } from "../../hooks/useCredentialFlow";

import { useSocket } from "../../hooks/useSocket";

export const Welcome = () => {
    const [dark, setDark] = useDarkMode();
    const serviceTypeRef = useRef(null);
    const [runnerId, setRunnerId] = useState(null); // eslint-disable-line no-unused-vars

    const { runnerLocation } = useCredentialFlow(serviceTypeRef, (runnerData) => {
        setRunnerId(runnerData._id || runnerData.id);
    });

    const [userData, setUserData] = useState({});
    const [currentScreen, setCurrentScreen] = useState("service_selection");
    const [selectedRunner, setSelectedRunner] = useState(null);
    const [showRunnerSheet, setShowRunnerSheet] = useState(false);
    const [selectedService, setSelectedService] = useState("");
    const dispatch = useDispatch();

    const { socket, joinUserRoom } = useSocket();
    const [schedulePrompt, setSchedulePrompt] = useState(null);


    const [selectedMarket, setSelectedMarket] = useState("");
    const [selectedFleetType, setSelectedFleetType] = useState("");
    const [showConnecting, setShowConnecting] = useState(false);
    const [serverUpdated, setServerUpdated] = useState(false);

    // Use single state variable for saved locations modal
    const [isSavedLocationsOpen, setIsSavedLocationsOpen] = useState(false);
    const [selectCallback, setSelectCallback] = useState(null);
    const [dismissCallback, setDismissCallback] = useState(null);

    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

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


    useEffect(() => {
        if (!socket || !currentUser?._id) return;
        joinUserRoom(currentUser._id);
        socket.on('scheduleReminder', (data) => setSchedulePrompt(data));
        return () => socket.off('scheduleReminder');
    }, [socket, currentUser?._id, joinUserRoom]);


    const updateUserData = (newData) => {
        setUserData({ ...userData, ...newData });
    };

    const navigateTo = (screen) => {
        setCurrentScreen(screen);
    };

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
        // console.log("Opening saved locations:", open);
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
                        onMore={() => setShowMoreMenu(true)}
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
                            // console.log('Errand data:', data);
                            // console.log('marketCoordinates in received data:', data.marketCoordinates);
                            setSelectedMarket(data);
                            navigateTo("vehicle_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        onMore={() => setShowMoreMenu(true)}
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
                            // console.log('Pickup data:', data);
                            setSelectedMarket(data);
                            navigateTo("vehicle_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        onMore={() => setShowMoreMenu(true)}
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
                        onMore={() => setShowMoreMenu(true)}
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

                        onOrderComplete={() => {
                            setCurrentScreen("service_selection");
                            // reset other states
                            setSelectedMarket("");
                            setSelectedFleetType("");
                            setServerUpdated(false);
                        }}

                    // onBack={() => {

                    //     setShowRunnerSheet(true);
                    //     navigateTo("vehicle_selection");
                    // }}
                    />
                );

            default:
                return (
                    <ServiceSelectionScreen
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

            <MoreMenu
                isOpen={showMoreMenu}
                onClose={() => setShowMoreMenu(false)}
                darkMode={dark}
                userId={currentUser?._id}
                onWallet={() => setShowWallet(true)}
                onSettings={() => setShowSettings(true)}
            // others
            />

            {showWallet && currentScreen !== 'chat' && (
                <div className="fixed inset-0 z-[10001]">
                    <UserWallet darkMode={dark} onBack={() => setShowWallet(false)} userData={currentUser} />
                </div>
            )}
            {showSettings && currentScreen !== 'chat' && (
                <div className="fixed inset-0 z-[10001]">
                    <Settings darkMode={dark}
                        onBack={() => setShowSettings(false)}
                        onToggleDarkMode={() => setDark(!dark)}
                        userData={currentUser} />
                </div>
            )}

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
                    // handleSelectRunner()
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
                runnerCoords={runnerLocation ? {
                    lat: runnerLocation.latitude,
                    lng: runnerLocation.longitude
                } : null}
            />


            {schedulePrompt && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-end">
                    <div className={`w-full rounded-t-3xl p-6 ${dark ? "bg-black-100" : "bg-white"}`}>
                        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-6" />
                        <p className={`text-base font-bold mb-2 ${dark ? "text-white" : "text-black-200"}`}>
                            Scheduled Delivery
                        </p>
                        <p className="text-sm text-gray-400 mb-6">{schedulePrompt.message}</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setSchedulePrompt(null);
                                    setCurrentScreen("service_selection");
                                }}
                                className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white"
                            >
                                Proceed
                            </button>
                            <button
                                onClick={() => {
                                    setSchedulePrompt(null);
                                    setShowSettings(true);
                                }}
                                className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${dark ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200"}`}
                            >
                                Modify Schedule
                            </button>
                            <button
                                onClick={() => setSchedulePrompt(null)}
                                className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-400"
                            >
                                Skip This Time
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};