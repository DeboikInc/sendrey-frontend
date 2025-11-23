import { useState } from "react";
import useDarkMode from "../hooks/useDarkMode";
import { useNavigate, useLocation, } from "react-router-dom";
import MarketSelectionScreen from "../components/screens/MarketSelectionScreen";
import ServiceSelectionScreen from "../components/screens/ServiceSelectionScreen";
import VehicleSelectionScreen from "../components/screens/VehicleSelectionScreen";
import RunnerSelectionScreen from "../components/screens/RunnerSelectionScreen";
import ChatScreen from "../components/screens/ChatScreen";
import RunnerDashboardScreen from "../components/screens/RunnerDashboardScreen";
import { useDispatch } from "react-redux";

export const Welcome = () => {
    const [dark, setDark] = useDarkMode();
    // const navigate = useNavigate();
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

    const renderScreen = () => {
        switch (currentScreen) {
            case "service_selection":
                return (
                    <ServiceSelectionScreen
                        onSelectService={(service) => {
                            setSelectedService(service);
                            updateUserData({ service });
                            navigateTo("market_selection");
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                );

            case "market_selection":
                return (

                    <MarketSelectionScreen
                        service={userData}
                        onSelectMarket={(location) => {
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
                        service={userData}
                        selectedService={selectedService}
                        onSelectVehicle={(fleetType) => {
                            setSelectedFleetType(fleetType);
                        }}
                        onConnectToRunner={() => {
                            setShowRunnerSheet(true);
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
                        userData={userData}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    // onBack={() => navigateTo("runner_selection")}
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
            <div className={`min-h-screen ${dark ? "dark" : ""}`}>
                <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                    {renderScreen()}
                </div>
            </div>


            {/*  where runners are selected */}
            <RunnerSelectionScreen
                selectedVehicle={selectedFleetType} 
                selectedLocation={selectedMarket}
                selectedService={selectedService}
                onSelectRunner={(runner) => {
                    setSelectedRunner(runner);
                    setShowRunnerSheet(false);
                    navigateTo("chat");
                }}
                darkMode={dark}
                isOpen={showRunnerSheet}
                onClose={() => setShowRunnerSheet(false)}

            />
        </>
    );
};