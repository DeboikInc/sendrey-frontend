import { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import useDarkMode from "../../hooks/useDarkMode";
import { useNavigate } from "react-router-dom";

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
import UserDisputes from "../../components/screens/UserDisputes";

import ChatScreen from "../../components/screens/ChatScreen";
import { useDispatch } from "react-redux";

import { fetchNearbyRunners } from "../../Redux/runnerSlice";
import { updateScheduleStatus } from "../../Redux/businessSlice";
import { startEditing, finishEditing, updateOrder } from "../../Redux/orderSlice";

import { useCredentialFlow } from "../../hooks/useCredentialFlow";
import { useSocket } from "../../hooks/useSocket";
import { usePushNotifications, USER_ORDER_TYPES, } from "../../hooks/usePushNotifications";

import chatStorage from '../../utils/chatStorage';
import api from '../../utils/api';

import useUserOrderStore from '../../store/userOrderStore';

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
    const navigate = useNavigate();

    const { socket, joinUserRoom } = useSocket();
    const [schedulePrompt, setSchedulePrompt] = useState(null);

    const [chatReady, setChatReady] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState("");
    const [selectedFleetType, setSelectedFleetType] = useState("");
    const [showConnecting, setShowConnecting] = useState(false);
    const [serverUpdated, setServerUpdated] = useState(false);

    const [settingsEditScheduleId, setSettingsEditScheduleId] = useState(null);

    // Use single state variable for saved locations modal
    const [isSavedLocationsOpen, setIsSavedLocationsOpen] = useState(false);
    const [selectCallback, setSelectCallback] = useState(null);
    const [dismissCallback, setDismissCallback] = useState(null);


    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showDisputes, setShowDisputes] = useState(false);

    // state declarations for marketscreen
    const [marketScreenMessages, setMarketScreenMessages] = useState([]);
    const [pickupLocation, setPickupLocation] = useState(null);
    const [deliveryLocation, setDeliveryLocation] = useState(null);

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmOrderData, setConfirmOrderData] = useState(null);
    const [chatMounted, setChatMounted] = useState(false);

    const currentUser = useSelector(s => s.auth.user);
    // const token = useSelector(s => s.auth.token);
    const activeChatId = useSelector(s => s.order.activeChatId);
    const isEditing = useSelector(s => s.order.isEditing);
    const editingField = useSelector(s => s.order.editingField);
    const currentOrder = useSelector(s => s.order.currentOrder);
    const { clearOrder } = useUserOrderStore();

    const [runnerResponseData, setRunnerResponseData] = useState(null);
    const [settingsInitialTab, setSettingsInitialTab] = useState(null);
    const [chatSessionCounter, setChatSessionCounter] = useState(
        () => parseInt(sessionStorage.getItem('chatSessionCounter') || '0', 10)
    ); // eslint-disable-line no-unused-vars
    const chatSessionIdRef = useRef(0);
    const specialInstructionsRef = useRef(confirmOrderData?.specialInstructions || null)

    const { permission, requestPermission } = usePushNotifications({
        userId: currentUser?._id,
        userType: 'user',
        socket,
        onIncomingCall: () => { }, // calls only happen while ChatScreen is active
        onNotificationTap: (data) => {
            if (data?.type === 'team_invite' || data?.type === 'team_notify') {
                setShowMoreMenu(false);
                setShowSettings(true);
                return;
            }

            if (data?.type === 'dispute_raised' ||
                data?.type === 'dispute_resolved' ||
                data?.type === 'dispute_lock') {
                setShowMoreMenu(false);
                setShowDisputes(true);
                return;
            }

            if ((data?.type === 'schedule_reminder' || data?.type === 'schedule_warning')) {
                setShowMoreMenu(false);
                setSettingsInitialTab('schedule');
                setSettingsEditScheduleId(data?.scheduleId || null);
                setShowSettings(true);
                return;
            }

            if (USER_ORDER_TYPES.includes(data?.type)) {
                // Notification arrived late — no active chat, do nothing
                if (!chatMounted) return;

                // Close everything else and surface the chat
                setShowMoreMenu(false);
                setShowWallet(false);
                setShowSettings(false);
                setShowDisputes(false);
                setChatReady(true);
                setShowConnecting(false);
                setCurrentScreen('chat');
                return;
            }

        },
    });

    useEffect(() => {
        if (currentUser?._id && socket && permission !== 'denied') {
            requestPermission();
        }
    }, [currentUser?._id, socket, permission, requestPermission]);

    useEffect(() => {
        if (!socket) return;
        const handler = (event, ...args) => {
            if (['proceedToChat', 'enterPreRoom', 'chatHistory', 'orderCreated'].includes(event)) {
                console.log('[Welcome onAny]', event, 'socket:', socket?.id);
            }

            socket.on('proceedToChat', (data) => {
                console.log('[Welcome raw proceedToChat]', JSON.stringify({
                    chatId: data.chatId,
                    runnerId: data.runnerId,
                    chatReady: data.chatReady,
                    attemptToken: data.attemptToken,
                }));
            });
        };
        socket.onAny(handler);
        return () => socket.offAny(handler);
    }, [socket]);

    useEffect(() => {
        specialInstructionsRef.current = confirmOrderData?.specialInstructions || null;
    }, [confirmOrderData?.specialInstructions]);

    useEffect(() => {
        if (!socket || !currentUser?._id) return;
        console.log('joining user room:', currentUser._id);
        joinUserRoom(currentUser._id);

        socket.on('scheduleReminder', (data) => setSchedulePrompt(data));
        socket.on('runnerTimeout', () => setShowConnecting(false));
        return () => {
            socket.off('scheduleReminder')
            socket.off('runnerTimeout');
        }
    }, [socket, currentUser?._id, joinUserRoom]);

    // restore chat session if valid, or clear it if not
    const restoreIfActive = useCallback(async () => {
        const { chatId: storedChatId } = await chatStorage.getActiveChat();
        console.log('[restore] storedChatId:', storedChatId);
        if (!storedChatId) return;

        const status = await chatStorage.getChatStatus(storedChatId);
        console.log('[restore] status:', status);

        // Only bail on definitive local terminal states — let server validate everything else
        if (status?.taskCompleted || status?.orderCancelled) {
            console.log('[restore] local state is terminal, bailing');
            return;
        }

        const runner = await chatStorage.getRunnerData();
        console.log('[restore] runner:', runner?._id);
        if (!runner) return;

        // Always hit the server — don't trust local currentOrder being null/present
        try {
            console.log('[restore] calling /validate for chatId:', storedChatId);
            const response = await api.post('/sessions/validate',
                { chatId: storedChatId },
                { _skipInterceptor: true }
            );
            console.log('[restore] validate response:', response.data);
            const { isValid, hasActiveOrder } = response.data.data;
            console.log('[restore] isValid:', isValid, 'hasActiveOrder:', hasActiveOrder);

            if (!isValid || !hasActiveOrder) {
                console.log('[restore] server says invalid/no active order — clearing');
                setShowConnecting(false);
                setChatMounted(false);
                setSelectedRunner(null);
                chatStorage.clearActiveChat();
                chatStorage.clearDeliveryConfirmations(storedChatId);
                chatStorage.clearRunnerData();
                chatStorage.clearChatStatus(storedChatId);
                return;
            }
        } catch (err) {
            console.log('[restore] validate error:', err.response?.status, err.message);
            if (err.response?.status === 404) {
                console.log('[restore] 404 — clearing storage');
                setShowConnecting(false);
                setChatMounted(false);
                setSelectedRunner(null);
                chatStorage.clearActiveChat();
                chatStorage.clearDeliveryConfirmations(storedChatId);
                chatStorage.clearRunnerData();
                chatStorage.clearChatStatus(storedChatId);
                return;
            }
            console.warn('[restore] validate failed, proceeding anyway:', err.message);
        }

        // Server confirmed active — restore
        console.log('[restore] server confirmed active, restoring session');
        if (status?.currentOrder?.serviceType) setSelectedService(status.currentOrder.serviceType);
        setSelectedRunner(runner);
        setShowConnecting(true);
        setChatMounted(true);

    }, []);

    useEffect(() => {
        if (!currentUser?._id) return;
        const timer = setTimeout(restoreIfActive, socket?.connected);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?._id]);

    useEffect(() => {
        if (!socket || !currentUser?._id) return;
        const handleReconnect = async () => {
            if (chatMounted) return; // ChatScreen handles its own reconnect
            await restoreIfActive();
        };
        socket.on('connect', handleReconnect);
        return () => socket.off('connect', handleReconnect);
    }, [socket, currentUser?._id, chatMounted, restoreIfActive]);

    useEffect(() => {
        if (!socket || !currentUser?._id) return;

        const handleEnterPreRoom = (data) => {
            console.log('[Welcome] enterPreRoom received:', data);
        };

        socket.on('enterPreRoom', handleEnterPreRoom);
        return () => socket.off('enterPreRoom', handleEnterPreRoom);

    }, [socket, currentUser?._id]);


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
        const mergedData = { ...confirmOrderData, ...updatedData };

        dispatch(updateOrder(mergedData));
        dispatch(finishEditing());

        // Navigate back to vehicle_selection first, then show modal
        setCurrentScreen("vehicle_selection");
        setTimeout(() => {
            setConfirmOrderData(mergedData);
            setShowConfirmModal(true);
        }, 100);
    };

    const handleConfirmContinue = async () => {
        setShowConfirmModal(false);
        setShowConnecting(true);

        const fleetType = confirmOrderData?.fleetType;
        const serviceType = confirmOrderData?.serviceType;

        // Try to get location silently if missing
        let userLocation = confirmOrderData?.userLocation;
        if (!userLocation?.latitude || !userLocation?.longitude) {
            try {
                userLocation = await new Promise((resolve, reject) => {
                    if (!navigator.geolocation) return reject(new Error('no geolocation'));
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                        (err) => reject(err),
                        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                    );
                });
                // persist it back into confirmOrderData so retries also have it
                setConfirmOrderData(prev => ({ ...prev, userLocation }));
            } catch {
                setShowConnecting(false);
                alert('Unable to get your location. Please enable location access and try again.');
                return;
            }
        }

        try {
            const response = await dispatch(fetchNearbyRunners({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                serviceType,
                fleetType,
            })).unwrap();
            setServerUpdated(true);
            console.log('[Welcome] FULL RESPONSE from fetchNearbyRunners:', JSON.stringify(response, null, 2));

            handleConnectToRunner(response);
        } catch (error) {
            setShowConnecting(false);
            console.error('Error fetching nearby runners:', error);
            alert('Failed to find nearby runners. Please try again.');
        }
    };

    const handleConnectToRunner = (runnersData) => {
        console.log('[Welcome] handleConnectToRunner received:', runnersData);
        console.log('[Welcome] runners array:', runnersData?.runners);
        console.log('[Welcome] runners count:', runnersData?.count);

        setRunnerResponseData(runnersData);
        setShowConnecting(true);

        setTimeout(() => {
            setShowConnecting(false);

            if (runnersData.error || !runnersData.runners || runnersData.runners.length === 0) {
                console.log('[Welcome] No runners found, showing sheet with null');
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
        isEditing,
        editingField,
        currentOrder,
        onEditComplete: handleEditComplete
    };


    const renderScreen = () => {
        if (currentScreen === 'chat') return null; // ChatScreen is rendered separately below so it can mount/unmount without affecting this entire tree
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
                            console.log('onNavigateToPickup fired');
                            setSelectedService('pick-up');
                            updateUserData({ serviceType: 'pick-up' });
                            setMarketScreenMessages([]);
                            navigateTo("pickup_screen");
                        }}
                        onNavigateToErrand={() => {
                            console.log('onNavigateToErrand fired');
                            setSelectedService('run-errand');
                            updateUserData({ serviceType: 'run-errand' });
                            setMarketScreenMessages([]);
                            navigateTo("market_selection"); // errand flow
                        }}
                        onMore={() => setShowMoreMenu(true)}
                        showBack={true}
                        onBack={() => navigate('/auth')}
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
                        showBack={true}
                        onBack={() => navigateTo('service_selection')}
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
                        showBack={true}
                        onBack={() => navigateTo('service_selection')}
                    />
                );

            case "vehicle_selection":
                return (
                    <VehicleSelectionScreen
                        key={`vehicle-${selectedService}`}
                        {...screenProps}
                        service={selectedMarket}
                        selectedService={selectedService}
                        serverUpdated={serverUpdated}
                        onSelectVehicle={(fleetType) => {
                            setSelectedFleetType(fleetType);
                        }}
                        onConnectToRunner={handleConnectToRunner}
                        onShowConfirmOrder={handleShowConfirmOrder}
                        confirmModalOpen={showConfirmModal}
                        onFetchRunners={async (orderData) => {
                            setShowConnecting(true);
                            try {
                                let userLocation = orderData.userLocation;
                                if (!userLocation?.latitude || !userLocation?.longitude) {
                                    userLocation = await new Promise((resolve, reject) => {
                                        if (!navigator.geolocation) return reject(new Error('no geolocation'));
                                        navigator.geolocation.getCurrentPosition(
                                            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                                            (err) => reject(err),
                                            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                                        );
                                    });
                                }
                                const response = await dispatch(fetchNearbyRunners({
                                    latitude: userLocation.latitude,
                                    longitude: userLocation.longitude,
                                    // serviceType: orderData.serviceType,
                                    fleetType: orderData.fleetType
                                })).unwrap();
                                handleConnectToRunner(response);
                            } catch (error) {
                                setShowConnecting(false);
                                console.error('Error fetching nearby runners:', error);
                                alert('No runners found Nearby. Please try again in a few moments.');
                            }
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        onMore={() => setShowMoreMenu(true)}
                        showBack={true}
                        onBack={() => {
                            setMarketScreenMessages([]); // ← clear messages on back
                            setPickupLocation(null);
                            setDeliveryLocation(null);
                            setServerUpdated(false);
                            navigateTo('service_selection');
                        }}
                    />
                );

            default:
                return null
        }
    };

    return (
        <>
            <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
                <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                    {renderScreen()}
                </div>
            </div>

            {/* ChatScreen — lives outside renderScreen, mounts when runner selected */}
            {chatMounted && (
                <>
                    {console.log('[Welcome render] ChatScreen key:', `chat-session-${chatSessionCounter}`, {
                        chatMounted,
                        chatReady,
                        selectedRunner: selectedRunner?._id,
                    })}
                    <div
                        className="fixed inset-0 z-[10000]"
                        style={{ visibility: chatReady ? 'visible' : 'hidden' }}
                    >
                        <ChatScreen
                            key={`chat-session-${chatSessionCounter}`}
                            runner={selectedRunner}
                            userData={{
                                ...currentUser,
                                serviceType: selectedService,
                                _id: currentUser?._id || 'temp-user'
                            }}
                            darkMode={dark}
                            toggleDarkMode={() => setDark(!dark)}
                            onReady={() => {
                                console.log('[Welcome onReady] fired — setting chatReady=true, showConnecting=false');
                                setChatReady(true);
                                setShowConnecting(false);
                                setCurrentScreen('chat');
                            }}
                            onOrderComplete={() => {
                                console.log('[onOrderComplete] FIRED', {
                                    chatMounted,
                                    chatReady,
                                    chatSessionCounter,
                                    activeChatId,
                                });

                                // Clear session validation flag
                                if (activeChatId) {
                                    sessionStorage.removeItem(`session_validated_${activeChatId}`);
                                }

                                chatStorage.clearActiveChat();
                                chatStorage.clearDeliveryConfirmations(activeChatId);
                                chatStorage.clearRunnerData();
                                chatStorage.clearChatStatus?.(activeChatId);

                                setChatReady(false);
                                setChatMounted(false);
                                setCurrentScreen("service_selection");
                                setSelectedMarket("");
                                setSelectedFleetType("");
                                setServerUpdated(false);
                                setSelectedService("");
                                setSelectedRunner(null);
                                setRunnerResponseData(null);
                                setShowRunnerSheet(false);
                                setConfirmOrderData(null);
                                setShowConfirmModal(false);
                                setMarketScreenMessages([]);
                                setPickupLocation(null);
                                setDeliveryLocation(null);

                                setTimeout(() => clearOrder(), 500);
                            }}
                        />
                    </div>
                </>
            )}

            <MoreMenu
                isOpen={showMoreMenu}
                onClose={() => setShowMoreMenu(false)}
                darkMode={dark}
                userId={currentUser?._id}
                onWallet={() => setShowWallet(true)}
                onSettings={() => setShowSettings(true)}
                onDisputes={() => setShowDisputes(true)}
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
                        onBack={() => { setShowSettings(false); setSettingsInitialTab(null); }}
                        onToggleDarkMode={() => setDark(!dark)}
                        userData={currentUser}
                        initialTab={settingsInitialTab}
                        editScheduleId={settingsEditScheduleId}
                    />
                </div>
            )}

            {showDisputes && currentScreen !== 'chat' && (
                <div className="fixed inset-0 z-[10001]">
                    <UserDisputes
                        darkMode={dark}
                        userId={currentUser._id}
                        onBack={() => setShowDisputes(false)}
                    />
                </div>
            )}


            {showConnecting && (
                <div className="fixed inset-0 flex flex-col justify-end items-center bg-black-100 bg-opacity-80 z-[10001] pb-6 px-4 sm:pb-10"
                    style={{ pointerEvents: 'all' }}
                >
                    <div className="flex flex-col items-center justify-center gap-2 w-full max-w-md">
                        <div className="relative w-10 h-10">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <span key={i} className="absolute w-2 h-2 bg-primary rounded-full animate-fade-dot"
                                    style={{ left: "50%", top: "50%", transform: `rotate(${i * 30}deg) translate(0, -16px)`, animationDelay: `${i * 0.1}s` }}
                                />
                            ))}
                        </div>
                        <p className="text-base sm:text-lg font-medium dark:text-gray-200 text-center break-words">
                            {chatMounted
                                ? 'Getting your chat order ready…'
                                : 'Please wait while we connect you to a runner…'}
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

                onSelectRunner={(runner, orderData) => {
                    console.log('[Welcome onSelectRunner] runner:', runner?._id, 'chatMounted:', chatMounted, 'chatReady:', chatReady);
                    console.log('[onSelectRunner] FIRED', {
                        runnerId: runner?._id,
                        chatMounted,
                        chatReady,
                        chatSessionCounter,
                        chatSessionIdRef: chatSessionIdRef.current,
                    });

                    setSelectedRunner(runner);
                    chatStorage.saveRunnerData(runner);
                    setChatSessionCounter(c => {
                        const next = c + 1;
                        console.log('[onSelectRunner] chatSessionCounter:', c, '→', c + 1);
                        sessionStorage.setItem('chatSessionCounter', next);
                        return next
                    });
                    chatSessionIdRef.current += 1;

                    if (orderData?.orderId) {
                        dispatch(updateOrder(orderData));
                    }
                    setShowRunnerSheet(false);
                    setChatReady(false);      // hide chat until onReady fires
                    setShowConnecting(true);  // show overlay
                    setChatMounted(true);
                    console.log('[Welcome onSelectRunner] chatMounted set true');
                }}
                darkMode={dark}
                isOpen={showRunnerSheet}
                onClose={() => {
                    setShowRunnerSheet(false);
                    setRunnerResponseData(null); // Clear data when closed
                }}

                className="overflow-visible"

                onFindMore={async () => {
                    const { userLocation, fleetType,
                        //  serviceType
                    } = confirmOrderData;
                    try {
                        const response = await dispatch(fetchNearbyRunners({
                            latitude: userLocation.latitude,
                            longitude: userLocation.longitude,
                            // serviceType,
                            fleetType
                        })).unwrap();
                        setRunnerResponseData(response);
                    } catch (error) {
                        console.error('Find more runners error:', error);
                    }
                }}

                onFetchTopRated={async () => {
                    const { userLocation, fleetType,
                        // serviceType
                    } = confirmOrderData;
                    const response = await dispatch(fetchNearbyRunners({
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        // serviceType,
                        fleetType,
                        sortBy: 'rating',
                    })).unwrap(); // ← unwrap() already throws on failure, so catch will fire

                    setRunnerResponseData(prev => ({
                        ...prev,
                        runners: [
                            ...response.runners,
                            ...(prev?.runners || []).slice(response.runners.length),
                        ]
                    }));
                }}
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
                onClose={() => {
                    console.log('CONFIRM ORDER CANCELLED - setting serverUpdated to false');
                    setShowConfirmModal(false);
                    setServerUpdated(false);
                }}
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
                <div className="fixed inset-0 bg-black/60 z-[99999] flex items-end">
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
                                    setShowSettings(false);  // ← close settings if open
                                    setShowMoreMenu(false);
                                    setShowWallet(false);
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
                                    setSettingsInitialTab("schedules");
                                    setSettingsEditScheduleId(schedulePrompt.scheduleId);
                                    // set schedule in edit mode
                                }}
                                className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${dark ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200"}`}
                            >
                                Modify Schedule
                            </button>

                            {/* local storage ke? */}
                            <button
                                className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${dark ? "border-white/10 text-gray-300" : "border-gray-200 text-black-200"}`}
                                onClick={() => {
                                    dispatch(updateScheduleStatus({
                                        scheduleId: schedulePrompt.scheduleId,
                                        status: 'skipped'
                                    }));
                                    setSchedulePrompt(null);
                                }}
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