import { useState } from "react";
import ChatScreen from "../components/screens/ChatScreen";
import OnboardingScreen from "../components/screens/OnboardingScreen";
import RoleSelectionScreen from "../components/screens/RoleSelectionScreen";
import MarketSelectionScreen from "../components/screens/MarketSelectionScreen";
import RunnerSelectionScreen from "../components/screens/RunnerSelectionScreen";
import RunnerDashboardScreen from "../components/screens/RunnerDashboardScreen";
import useDarkMode from "../hooks/useDarkMode";
import { useNavigate } from "react-router-dom";



export const Home = () => {
    const [dark, setDark] = useDarkMode();
    const [userType, setUserType] = useState(null);
    const navigate = useNavigate();

    return (
        <>
            <div className={`min-h-screen ${dark ? "dark" : ""}`}>
                <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                    <RoleSelectionScreen
                        onSelectRole={(type) => {
                            setUserType(type);
                            navigate("/auth", { state: { userType: "user" } });
                        }}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                </div>
            </div>
        </>
    )
}

