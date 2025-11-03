import useDarkMode from "../hooks/useDarkMode";
import { useNavigate, useLocation } from "react-router-dom";
import OnboardingScreen from "../components/screens/OnboardingScreen";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { register } from "../Redux/authSlice";



export const Auth = () => {
    const [dark, setDark] = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState({});
    const [error, setError] = useState(null);
    const userType = location.state?.userType;
    const dispatch = useDispatch();

    const updateUserData = (newData) => {
        setUserData({ ...userData, ...newData });
    };

    const handleOnboardingComplete = async (data) => {
        const { name, phone } = data;
        const payload = {
            role: userType,     // 'user' or 'runner'
            fullName: name,
            phone,
            // send these if value are provided
            ...(data.password && { password: data.password }),
            ...(data.email && { email: data.email }),
        };

        try {
            const result = await dispatch(register(payload)).unwrap();
            console.log("Registration successful:", result);
            // maybe navigate to dashboard or verification screen
            if (userType === "user") {
                navigate("/welcome", { state: { serviceType: data.serviceType } });
            } else {
                navigate("/runner_dashboard");
            }
        } catch (error) {
            console.error("Registration failed:", error);
            setError(error)
        }
    };

    return (
        <>
            <div className={`min-h-screen ${dark ? "dark" : ""}`}>
                <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                    <OnboardingScreen
                        userType={userType}
                        onComplete={handleOnboardingComplete}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        error={error} // 
                        onErrorClose={() => setError(null)} // clear error
                    />
                </div>
            </div>

            {/* error modal */}
            {error && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">
                            Invalid credentials
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            {error || "Something went wrong. Please try again."}
                        </p>
                        <button
                            onClick={() => setError(null)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}