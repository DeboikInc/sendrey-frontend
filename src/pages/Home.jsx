import { useState } from "react";
import RoleSelectionScreen from "../components/screens/RoleSelectionScreen";
import useDarkMode from "../hooks/useDarkMode";
import { useNavigate } from "react-router-dom";


export const Home = () => {
    const [dark, setDark] = useDarkMode();
    const [userType, setUserType] = useState(null);
    const navigate = useNavigate();

    return (
        <>
            <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
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

