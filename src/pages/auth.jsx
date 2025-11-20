import useDarkMode from "../hooks/useDarkMode";
import { useNavigate, useLocation } from "react-router-dom";
import OnboardingScreen from "../components/screens/OnboardingScreen";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { register, verifyPhone } from "../Redux/authSlice";

export const Auth = () => {
    const [dark, setDark] = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState({});
    const [error, setError] = useState(null);
    const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
    const [tempUserData, setTempUserData] = useState(null);
    const userType = location.state?.userType;
    const dispatch = useDispatch();

    const updateUserData = (newData) => {
        setUserData({ ...userData, ...newData });
    };

    const handleOnboardingComplete = async (data) => {
        // console.log("Onboarding complete data:", data);

        // If OTP is provided, verify it
        if (data.otp && tempUserData) {
            try {
                const verifyPayload = {
                    phone: tempUserData.phone,
                    otp: data.otp
                };
                // console.log("Verifying OTP:", verifyPayload);

                const result = await dispatch(verifyPhone(verifyPayload)).unwrap();
                // console.log("OTP verification successful:", result);

                // Navigate based on user type after successful verification
                if (userType === "user") {
                    navigate("/welcome", { state: { serviceType: data.serviceType } });
                } else {
                    navigate("/raw", { state: { serviceType: data.serviceType } });
                }
            } catch (error) {
                console.error("OTP verification failed:", error);
                setError(error);
            }
            return;
        }

        // Initial registration (phone and name collection)
        const { name, phone } = data;

        // Parse the name into firstName and lastName
        const nameParts = name ? name.trim().split(" ") : [];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ");

        // Build base payload
        const payload = {
            role: userType,
            phone,
        };

        if (firstName) {
            payload.firstName = firstName;
        }

        if (lastName) {
            payload.lastName = lastName;
        }

        if (data.password) {
            payload.password = data.password;
        }
        if (data.email) {
            payload.email = data.email;
        }

        // console.log("Registration payload:", payload);

        try {
            const result = await dispatch(register(payload)).unwrap();
            // console.log("Registration response:", result);

            // Store temp data for OTP verification
            // setTempUserData(payload);
            // setNeedsOtpVerification(true);

            if (userType === "user") {
                navigate("/welcome", { state: { serviceType: data.serviceType } });
            } else {
                navigate("/raw", { state: { serviceType: data.serviceType } });
            }

            // Backend sends OTP automatically during registration
        } catch (error) {
            console.error("Registration failed:", error);
            setError(error);
        }
    };

    const handleResendOtp = async () => {
        if (!tempUserData?.phone) return;

        try {
            // Resend by calling register again or a dedicated resend endpoint
            const payload = { phone: tempUserData.phone };
            // await dispatch(register(tempUserData)).unwrap();
            // console.log("OTP resent to:", tempUserData.phone);
        } catch (error) {
            console.error("Failed to resend OTP:", error);
            setError(error);
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
                        error={error}
                        onErrorClose={() => setError(null)}
                        // needsOtpVerification={needsOtpVerification}
                        userPhone={tempUserData?.phone}
                        onResendOtp={handleResendOtp}
                    />
                </div>
            </div>

            {/* Error modal */}
            {error && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">
                            Error
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
    );
};