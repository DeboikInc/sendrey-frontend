import { useState } from "react";
import { useDispatch } from "react-redux";
import Onboarding from "../common/Onboarding";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";
import { phoneVerificationRequest, verifyPhone } from "../../Redux/authSlice";
import { useNavigate } from "react-router-dom";

export default function PhoneVerificationPrompt({ user, darkMode, toggleDarkMode }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState("");
    const [failed, setFailed] = useState(false);

    const [messages, setMessages] = useState([
        {
            id: 1,
            from: "them",
            text: `Hi ${user?.firstName} 👋 You have not verified your phone number. Click the request button below and kindly verify your number to continue using Sendrey.`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "delivered",
        }
    ]);

    const addMessage = (text, from = "them", extra = {}) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            from,
            text,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: from === "me" ? "sent" : "delivered",
            ...extra,
        }]);
    };

    const handleRequestOtp = async () => {
        setFailed(false);
        try {
            await dispatch(phoneVerificationRequest({ phone: user.phone })).unwrap();
            setOtpSent(true);
            addMessage(
                `We've sent a verification code to ${user.phone}. Enter it below — didn't get it? Resend`,
                "them",
                { hasResendLink: true }
            );
        } catch (err) {
            addMessage("Failed to send code. Please try again.");
        }
    };

    const handleResend = async () => {
        try {
            await dispatch(phoneVerificationRequest({ phone: user.phone })).unwrap();
            addMessage(
                `A new code has been sent to ${user.phone}. Kindly enter it below — didn't get it? Resend`,
                "them",
                { hasResendLink: true }
            );
            setFailed(false);
            setOtp("");
        } catch (err) {
            addMessage("Failed to resend code. Please try again.");
        }
    };

    const handleMessageClick = (m) => {
        if (m.hasResendLink) handleResend();
    };

    const handleVerify = async () => {
        if (!otp.trim()) return;
        const enteredOtp = otp.trim();
        addMessage(enteredOtp, "me");
        setOtp("");
        try {
            await dispatch(verifyPhone({ phone: user.phone, otp: enteredOtp })).unwrap();
            addMessage("Phone verified! Taking you to Sendrey... 🎉");
            setTimeout(() => navigate('/welcome', { replace: true }), 1200);
        } catch (err) {
            addMessage("Invalid or expired code. Please try again.");
            setFailed(true);
        }
    };

    return (
        <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
            <div className="w-full h-full flex flex-col overflow-hidden max-w-2xl mx-auto">
                <div className="flex-1 overflow-y-auto p-4 pb-4">
                    {messages.map((m) => (
                        <Message
                            key={m.id}
                            m={m}
                            showCursor={false}
                            canResendOtp={true}
                            onMessageClick={() => handleMessageClick(m)}
                        />
                    ))}
                </div>

                <div className="py-10 px-3">
                    {!otpSent ? (
                        <button
                            onClick={handleRequestOtp}
                            className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white"
                        >
                            Request Verification Code
                        </button>
                    ) : failed ? (
                        <button
                            onClick={handleResend}
                            className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-primary text-white"
                        >
                            Retry — Send New Code
                        </button>
                    ) : (
                        <CustomInput
                            showMic={false}
                            showIcons={false}
                            showEmojis={false}
                            send={handleVerify}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="Enter OTP code"
                            type="number"
                        />
                    )}
                </div>
            </div>
        </Onboarding>
    );
}