import useDarkMode from "../../hooks/useDarkMode";
import { useNavigate, useLocation } from "react-router-dom";
import OnboardingScreen from "../../components/screens/OnboardingScreen";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import PhoneVerificationPrompt from "../../components/common/PhoneVerificationPrompt";
import {
    register,
    verifyPhone, resendPhoneVerification, // eslint-disable-line no-unused-vars
    verifyEmailOTP,
    resendEmailVerification,
    sendReturningUserEmailOTP,
    // verifyReturningUserPhone,
} from "../../Redux/authSlice";
import { authStorage } from '../../utils/authStorage';
import { isCapacitor } from "../../utils/api";

// ─── Geolocation config
const GEO_OPTIONS = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 60000,
};

const MAX_WATCH_DURATION = 20000; // ms — hard cap on total watch time

export const Auth = () => {
    const [dark, setDark] = useDarkMode();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    const userType = location.state?.userType;
    const isFromEmail = location.state?.isFromEmail;
    const emailUser = location.state?.user;

    const [allErrors, setAllErrors] = useState([]);
    const [needsOtpVerification, setNeedsOtpVerification] = useState(false);
    const [tempUserData, setTempUserData] = useState(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [pendingServiceType, setPendingServiceType] = useState(null); // eslint-disable-line no-unused-vars
    const [returningUser, setReturningUser] = useState(null);

    // Location state
    const [userLocation, setUserLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
    const [isReturningUserSuccess, setIsReturningUserSuccess] = useState(false);

    // Internal refs — survive re-renders, no stale closure issues
    const bestPositionRef = useRef(null); // { latitude, longitude, accuracy }
    const watchIdRef = useRef(null);
    const watchTimerRef = useRef(null);
    const attemptCountRef = useRef(0);
    const resolvedRef = useRef(false);

    // ── Finalise: commit the best fix we have and clean up ────────────────
    const finaliseLocation = useCallback((errorCode = null) => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (watchTimerRef.current !== null) {
            clearTimeout(watchTimerRef.current);
            watchTimerRef.current = null;
        }

        setIsGettingLocation(false);

        if (errorCode !== null) {
            // Explicit permission / unavailability error
            switch (errorCode) {
                case 1: // PERMISSION_DENIED
                    setLocationError(
                        'Sendrey needs your location to connect you with nearby runners. ' +
                        'Please enable location access in your browser settings and try again.'
                    );
                    setLocationPermissionDenied(true);
                    break;
                case 2: // POSITION_UNAVAILABLE
                    setLocationError(
                        'Location information is unavailable. ' +
                        'Please check your device settings and try again.'
                    );
                    break;
                case 3: // TIMEOUT (per-attempt) — we may still have a best fix
                    if (!bestPositionRef.current) {
                        setLocationError(
                            'Location request timed out. ' +
                            'Please check your connection and try again.'
                        );
                    }
                    break;
                default:
                    if (!bestPositionRef.current) {
                        setLocationError(
                            'An unknown error occurred while getting your location. ' +
                            'Please try again.'
                        );
                    }
            }
        }

        if (bestPositionRef.current) {
            setUserLocation({
                latitude: bestPositionRef.current.latitude,
                longitude: bestPositionRef.current.longitude,
            });
            setLocationError(null);
            console.log(
                `[geo] Settled — accuracy: ${bestPositionRef.current.accuracy?.toFixed(1)}m`
            );
        } else if (errorCode === null) {
            // Timed out with no fix and no specific error code
            setLocationError(
                'Could not determine your location. ' +
                'Please check your device settings and try again.'
            );
        }
    }, []);

    // ── Start acquisition ─────────────────────────────────────────────────
    const requestLocation = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setLocationError('Geolocation is not supported by your browser. Please use a different browser.');
            setLocationPermissionDenied(true);
            return;
        }

        // Reset everything for a fresh attempt
        resolvedRef.current = false;
        bestPositionRef.current = null;
        attemptCountRef.current = 0;

        setIsGettingLocation(true);
        setLocationError(null);
        setLocationPermissionDenied(false);
        setUserLocation(null);

        const onSuccess = (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            bestPositionRef.current = { latitude, longitude, accuracy };
            finaliseLocation();
        };

        const onError = (err) => {
            console.warn(`[geo] Error (code ${err.code}): ${err.message}`);
            finaliseLocation(err.code);
        };

        watchIdRef.current = navigator.geolocation.watchPosition(
            onSuccess,
            onError,
            GEO_OPTIONS
        );

        // Hard time cap — always resolve eventually
        watchTimerRef.current = setTimeout(() => {
            console.log('[geo] Watch duration exceeded — settling');
            finaliseLocation();
        }, MAX_WATCH_DURATION);
    }, [finaliseLocation]);

    // ── Run on mount; clean up on unmount ─────────────────────────────────
    useEffect(() => {
        requestLocation();

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (watchTimerRef.current !== null) {
                clearTimeout(watchTimerRef.current);
                watchTimerRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Retry (called from UI button) ─────────────────────────────────────
    const handleRetryLocation = () => {
        requestLocation();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Error helpers
    // ─────────────────────────────────────────────────────────────────────────

    const extractAllErrors = (error) => {
        const errors = [];

        if (Array.isArray(error)) {
            error.forEach(err => {
                const msg = err?.message || err || '';
                if (msg) errors.push(msg);
            });
        } else if (error && typeof error === 'object') {
            if (error.errors) {
                Object.values(error.errors).forEach(err => {
                    const msg = err?.message || err || '';
                    if (msg) errors.push(msg);
                });
            } else if (error.message) {
                errors.push(error.message);
            } else if (error.data?.message) {
                errors.push(error.data.message);
            }
        } else if (typeof error === 'string' && error) {
            errors.push(error);
        }

        return errors;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Registration / OTP handlers
    // ─────────────────────────────────────────────────────────────────────────

    const handleOnboardingComplete = async (data) => {
        // Returning user — confirmed "yes, that's me", send OTP
        if (data.returningUserConfirmed && returningUser) {
            try {
                await dispatch(sendReturningUserEmailOTP({
                    email: returningUser.email,
                    userType: 'user'
                }

                )).unwrap();
                // await dispatch(sendReturningUserPhoneOTP({ phone: returningUser.phone })).unwrap(); // phone path
                setTempUserData({ email: returningUser.email, phone: returningUser.phone, name: returningUser.name });
                setNeedsOtpVerification(true);
                setAllErrors([]);
            } catch (error) {
                setAllErrors(extractAllErrors(error));
            }
            return;
        }


        // OTP verification step
        if (data.otp && tempUserData) {
            try {
                // const result = await dispatch(verifyPhone({ phone: tempUserData.phone, otp: data.otp })).unwrap();
                const result = await dispatch(verifyEmailOTP({
                    email: tempUserData.email,
                    otp: data.otp,
                    userType: 'user'
                })).unwrap();
                console.log('verifyEmailOTP result:', result);

                if (isCapacitor) {
                    const token = result.token || result.data?.token;
                    const refreshToken = result.refreshToken || result.data?.refreshToken;
                    if (token) await authStorage.setTokens(token, refreshToken);
                }

                const user = result.user || result.data?.user;
                const hasAcceptedTerms = user?.termsAccepted?.version;

                if (returningUser) {
                    setIsReturningUserSuccess(true);
                    if (hasAcceptedTerms) {
                        navigate("/welcome", { replace: true });
                    }
                    // terms modal will handle navigation for returning user without terms
                } else {
                    if (hasAcceptedTerms) {
                        navigate("/welcome", { replace: true });
                    } else {
                        setRegistrationSuccess(true); // triggers terms modal
                    }
                }


                setNeedsOtpVerification(false);
                setAllErrors([]);
                setPendingServiceType(data.serviceType);
            } catch (error) {
                console.error("OTP verification failed:", error);
                setAllErrors(extractAllErrors(error));
            }
            return;
        }

        // Block registration until we have a location
        if (!userLocation) {
            setAllErrors(['Waiting for location access. Please allow location to continue.']);
            return;
        }

        const { name, phone, email } = data;
        const nameParts = name ? name.trim().split(" ") : [];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ");

        const payload = {
            role: userType,
            phone,
            email,
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(data.password && { password: data.password }),
            ...(data.email && { email: data.email }),
        };

        console.log("Registration payload with location:", payload);

        try {
            const result = await dispatch(register(payload)).unwrap();

            // set token
            const token = result.token;
            const refreshToken = result.refreshToken;
            if (token) await authStorage.setTokens(token, refreshToken);

            console.log('register result:', result);
            console.log('token:', result.token);

            setTempUserData({ phone, name, email });
            setNeedsOtpVerification(true);
            setAllErrors([]);
        } catch (error) {
            console.error("Registration failed:", error);
            const raw = error?.errors
                ? Object.values(error.errors).map(e => e?.message || e).join(" ")
                : error?.message || error?.data?.message || String(error);

            const isAlreadyExists = error?.status === 409 || error?.statusCode === 409 ||
                /already exist|already registered/i.test(raw);

            if (isAlreadyExists) {
                // Extract name from error payload if server returns it, else fall back to what user typed
                const existingName = error?.data?.userName || error?.userName || "";
                setReturningUser({
                    name: existingName,
                    email: payload.email,
                    phone: payload.phone,
                });
                setAllErrors([]);
            } else {
                setAllErrors(extractAllErrors(error));
            }
        }
    };

    const handleResendOtp = async () => {
        // if (!tempUserData?.phone) return;
        if (!tempUserData?.email) return;
        try {
            // await dispatch(resendPhoneVerification({ phone: tempUserData.phone })).unwrap();
            if (returningUser) {
                await dispatch(sendReturningUserEmailOTP({
                    email: tempUserData.email,
                    userType: 'user'
                })).unwrap();
            } else {
                await dispatch(resendEmailVerification({
                    email: tempUserData.email,
                    userType: 'user'
                })).unwrap();
            }
        } catch (error) {
            setAllErrors(extractAllErrors(error));
        }
    };

    // Email link flow — user is logged in but not phone verified
    if (isFromEmail && emailUser) {
        return (
            <div className={`fixed inset-0 overflow-hidden ${dark ? "dark" : ""}`}>
                <div className="h-full w-full text-white">
                    <PhoneVerificationPrompt
                        user={emailUser}
                        darkMode={dark}
                        toggleDarkMode={() => setDark(!dark)}
                    />
                </div>
            </div>
        );
    }

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
                    userEmail={tempUserData?.email}

                    onResendOtp={handleResendOtp}
                    needsOtpVerification={needsOtpVerification}
                    returningUser={returningUser}
                    onReturningUserConfirm={() => handleOnboardingComplete({ returningUserConfirmed: true })}
                    onReturningUserDecline={() => setReturningUser(null)}
                    isReturningUserSuccess={isReturningUserSuccess}
                    returningUserName={returningUser?.name}
                    showBack={true}
                    onBack={() => navigate("/")}
                    onTermsAccepted={(serviceType) => {
                        navigate("/welcome", {
                            state: { serviceType },
                            replace: true
                        });
                    }}
                />
            </div>
        </div>
    );
};