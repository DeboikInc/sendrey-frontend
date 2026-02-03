
import useDarkMode from "../../hooks/useDarkMode";
import { useNavigate, useLocation } from "react-router-dom";
import OnboardingScreen from "../../components/screens/OnboardingScreen";
import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
    register,
    verifyPhone,
    phoneVerificationRequest
} from "../../Redux/authSlice";

export const Auth = () => {
    const [dark, setDark] = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState({});
    const [allErrors, setAllErrors] = useState([]);
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
                    timeout: 5000,
                    maximumAge: 600000
                }
            );
        } else {
            setLocationError('Geolocation is not supported by your browser');
            setUserLocation({
                latitude: 6.5244,
                longitude: 3.3792
            });
        }
    }, []);

    const updateUserData = (newData) => {
        setUserData({ ...userData, ...newData });
    };

    // Helper to extract all error messages
    const extractAllErrors = (error) => {
        const errors = [];
        
        // Handle array of errors
        if (Array.isArray(error)) {
            error.forEach(err => {
                const msg = err?.message || err || '';
                if (msg) errors.push(msg);
            });
        }
        // Handle error object with multiple fields
        else if (error && typeof error === 'object') {
            // Check for validation errors structure
            if (error.errors) {
                Object.values(error.errors).forEach(err => {
                    const msg = err?.message || err || '';
                    if (msg) errors.push(msg);
                });
            }
            // Check for message field
            else if (error.message) {
                errors.push(error.message);
            }
            // Check for data.message
            else if (error.data?.message) {
                errors.push(error.data.message);
            }
        }
        // Handle string error
        else if (typeof error === 'string' && error) {
            errors.push(error);
        }

        // Format each error message
        return errors.map(errorMsg => {
            const lowerError = errorMsg.toLowerCase();
            
            // Check for name-related errors
            if (lowerError.includes('name') || lowerError.includes('first') || lowerError.includes('last')) {
                return errorMsg;
            }
            
            // Check for phone-related errors
            if (lowerError.includes('phone') || lowerError.includes('number') || lowerError.includes('mobile')) {
                return errorMsg;
            }
            
            // For all other errors
            return "Please try again later, something went wrong";
        });
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
                setAllErrors([]);

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
                const errors = extractAllErrors(error);
                setAllErrors(errors);
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
            setTempUserData({ phone, name });
            setNeedsOtpVerification(true);
            setAllErrors([]);

        } catch (error) {
            console.error("Registration failed:", error);
            const errors = extractAllErrors(error);
            setAllErrors(errors);
        }
    };

    const handleResendOtp = async () => {
        if (!tempUserData?.phone) return;

        try {
            const payload = { phone: tempUserData.phone };
            await dispatch(phoneVerificationRequest(payload)).unwrap();
        } catch (error) {
            console.error("Failed to resend OTP:", error);
            const errors = extractAllErrors(error);
            setAllErrors(errors);
        }
    };

    return (
        <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
            <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
                <OnboardingScreen
                    userType={userType}
                    registrationSuccess={registrationSuccess}
                    onComplete={handleOnboardingComplete}
                    darkMode={dark}
                    toggleDarkMode={() => setDark(!dark)}
                    errors={allErrors}
                    onErrorClose={() => setAllErrors([])}
                    locationError={locationError}
                    userPhone={tempUserData?.phone}
                    onResendOtp={handleResendOtp}
                    needsOtpVerification={needsOtpVerification}
                />
            </div>
        </div>
    );
};