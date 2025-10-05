import { useState } from "react";
import ChatScreen from "../components/screens/ChatScreen";
import OnboardingScreen from "../components/screens/OnboardingScreen";
import RoleSelectionScreen from "../components/screens/RoleSelectionScreen";
import ServiceSelectionScreen from "../components/screens/ServiceSelectionScreen";
import MarketSelectionScreen from "../components/screens/MarketSelectionScreen";
import RunnerSelectionScreen from "../components/screens/RunnerSelectionScreen";
import RunnerDashboardScreen from "../components/screens/RunnerDashboardScreen";
import useDarkMode from "../hooks/useDarkMode";

export default function ErrandServiceApp() {
  const [dark, setDark] = useDarkMode();
  const [currentScreen, setCurrentScreen] = useState("role_selection");
  const [userData, setUserData] = useState({});
  const [selectedMarket, setSelectedMarket] = useState("");
  const [selectedRunner, setSelectedRunner] = useState(null);
  const [userType, setUserType] = useState(null);

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
  };

  const updateUserData = (newData) => {
    setUserData({ ...userData, ...newData });
  };

  // Screen rendering
  const renderScreen = () => {
    switch (currentScreen) {
      case "role_selection":
        return (
          <RoleSelectionScreen
            onSelectRole={(type) => {
              setUserType(type);
              navigateTo("onboarding");
            }}
            darkMode={dark}
            toggleDarkMode={() => setDark(!dark)}
          />
        );

      case "onboarding":
        return (
          <OnboardingScreen
            userType={userType}
            onComplete={(data) => {
              updateUserData(data);
              if (userType === "user") {
                navigateTo("service_selection");
              } else {
                navigateTo("runner_dashboard"); // Runners go to dashboard
              }
            }}
            darkMode={dark}
            toggleDarkMode={() => setDark(!dark)}
          />
        );

      case "service_selection":
        return (
          <ServiceSelectionScreen
            onSelectService={(service) => {
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
            onSelectMarket={(market) => {
              setSelectedMarket(market);
              navigateTo("runner_selection");
            }}
            darkMode={dark}
            toggleDarkMode={() => setDark(!dark)}
          />
        );

      case "runner_selection":
        return (
          <RunnerSelectionScreen
            selectedMarket={selectedMarket}
            onSelectRunner={(runner) => {
              setSelectedRunner(runner);
              navigateTo("chat");
            }}
            darkMode={dark}
          />
        );

      case "chat":
        return (
          <ChatScreen
            runner={selectedRunner}
            market={selectedMarket}
            userData={userData}
            darkMode={dark}
            toggleDarkMode={() => setDark(!dark)}
            onBack={() => navigateTo("runner_selection")}
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
          />
        );

      default:
        return (
          <RoleSelectionScreen
            onSelectRole={setUserType}
            darkMode={dark}
            toggleDarkMode={() => setDark(!dark)}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen ${dark ? "dark" : ""}`}>
      <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
        {renderScreen()}
      </div>
    </div>
  );
}
