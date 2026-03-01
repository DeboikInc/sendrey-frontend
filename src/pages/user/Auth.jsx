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
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const userType = location.state?.userType;
    const dispatch = useDispatch();

    // Get user's location - NO FALLBACKS, explicit permission request
    const requestLocation = () => {
        if (!('geolocation' in navigator)) {
            setLocationError('Geolocation is not supported by your browser. Please use a different browser.');
            setLocationPermissionDenied(true);
            return;
        }

        setIsGettingLocation(true);
        setLocationError(null);
        setLocationPermissionDenied(false);

        // Show permission prompt with clear message
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // console.log('📍 Location obtained:', position.coords);
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setLocationError(null);
                setIsGettingLocation(false);
            },
            (error) => {
                console.warn('Location error:', error.code, error.message);
                setIsGettingLocation(false);
                
                // Handle specific error cases with user-friendly messages
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError(
                            'Sendrey needs your location to connect you with nearby runners. ' +
                            'Please enable location access in your browser settings and try again.'
                        );
                        setLocationPermissionDenied(true);
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError(
                            'Location information is unavailable. ' +
                            'Please check your device settings and try again.'
                        );
                        break;
                    case error.TIMEOUT:
                        setLocationError(
                            'Location request timed out. ' +
                            'Please check your connection and try again.'
                        );
                        break;
                    default:
                        setLocationError(
                            'An unknown error occurred while getting your location. ' +
                            'Please try again.'
                        );
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 30000, // 30 seconds - give it time
                maximumAge: 0
            }
        );
    };

    // Request location on mount
    useEffect(() => {
        requestLocation();
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

        return errors;
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

        // Check if we have location
        if (!userLocation) {
            setAllErrors(['Waiting for location access. Please allow location to continue.']);
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
            latitude: userLocation.latitude,
            longitude: userLocation.longitude, // REQUIRED - no fallback
        };

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

        // console.log("Registration payload with location:", payload);

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

    const handleRetryLocation = () => {
        setLocationPermissionDenied(false);
        setLocationError(null);
        requestLocation();
    };

    return (
        <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
            <div className="h-full w-full text-white">
                <OnboardingScreen
                    userType={userType}
                    registrationSuccess={registrationSuccess}
                    onComplete={handleOnboardingComplete}
                    darkMode={dark}
                    toggleDarkMode={() => setDark(!dark)}
                    errors={allErrors}
                    onErrorClose={() => setAllErrors([])}
                    locationError={locationError}
                    locationPermissionDenied={locationPermissionDenied}
                    onRetryLocation={handleRetryLocation}
                    isGettingLocation={isGettingLocation}
                    userPhone={tempUserData?.phone}
                    onResendOtp={handleResendOtp}
                    needsOtpVerification={needsOtpVerification}
                />
            </div>
        </div>
    );
};