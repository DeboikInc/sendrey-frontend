import useDarkMode from "../hooks/useDarkMode";
import { useNavigate, useLocation } from "react-router-dom";
import OnboardingScreen from "../components/screens/OnboardingScreen";
import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
    register,
    verifyPhone,
    phoneVerificationRequest
} from "../Redux/authSlice";

export const Auth = () => {
    const [dark, setDark] = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState({});
    const [error, setError] = useState(null);
    const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
    const [tempUserData, setTempUserData] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const userType = location.state?.userType;
    const dispatch = useDispatch();

    // Get user's location on component mount
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                    setLocationError(null);
                },
                (error) => {
                    console.warn('Location access denied or unavailable:', error);
                    setLocationError('Location access is required for registration');

                    // Set default coordinates as fallback (Lagos coordinates)
                    setUserLocation({
                        latitude: 6.5244,
                        longitude: 3.3792
                    });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000, // 5 seconds
                    maximumAge: 600000 // 10 minutes
                }
            );
        } else {
            setLocationError('Geolocation is not supported by your browser');
            // Set default coordinates as fallback
            setUserLocation({
                latitude: 6.5244,
                longitude: 3.3792
            });
        }
    }, []);

    const updateUserData = (newData) => {
        setUserData({ ...userData, ...newData });
    };

    const handleOnboardingComplete = async (data) => {
        // If OTP is provided, verify it
        if (data.otp && tempUserData) {
            try {
                const verifyPayload = {
                    phone: tempUserData.phone,
                    otp: data.otp
                };

                const result = await dispatch(verifyPhone(verifyPayload)).unwrap();


                setRegistrationSuccess(true);
                setNeedsOtpVerification(false);

                setError(null);

                setTimeout(() => {
                    navigate("/welcome", {
                        state: {
                            serviceType: data.serviceType
                        },
                        replace: true
                    });
                }, 2000);
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

        const payload = {
            role: userType,
            phone,
        };

        if (userLocation) {
            payload.latitude = userLocation.latitude;
            payload.longitude = userLocation.longitude;
        }

        // Add personal info
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

        console.log("Registration payload with location:", payload);

        try {
            const result = await dispatch(register(payload)).unwrap();
            // Store temp data for OTP verification
            setTempUserData({ phone, name });

            // Trigger OTP verification UI
            setNeedsOtpVerification(true);
            setError(null);

        } catch (error) {
            console.error("Registration failed:", error);
            setError(error);
        }
    };

    const handleResendOtp = async () => {
        if (!tempUserData?.phone) return;

        try {
            // Resend by calling phoneVerificationRequest 
            const payload = { phone: tempUserData.phone };
            await dispatch(phoneVerificationRequest(payload)).unwrap();
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
                        registrationSuccess={registrationSuccess}
                        onComplete={handleOnboardingComplete}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                        error={error}
                        onErrorClose={() => setError(null)}
                        locationError={locationError}
                        userPhone={tempUserData?.phone}
                        onResendOtp={handleResendOtp}
                        needsOtpVerification={needsOtpVerification}
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
                            {/* {error || "Something went wrong. Please try again."} */}
                            Something went wrong. Please try again.
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