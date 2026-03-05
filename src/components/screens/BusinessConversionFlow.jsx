// components/screens/BusinessConversionFlow.jsx
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Onboarding from "../common/Onboarding";
import Message from "../common/Message";
import CustomInput from "../common/CustomInput";
import { convertToBusiness, inviteMember } from "../../Redux/businessSlice";
import { updateUser } from "../../Redux/authSlice";

const STEPS = {
  CONFIRM:      "confirm",
  BUSINESS_NAME: "business_name",
  INVITE:       "invite",
  INVITE_INPUT: "invite_input",
  DONE:         "done",
};

export default function BusinessConversionFlow({
  darkMode,
  toggleDarkMode,
  onMore,
  onComplete, // called when flow is done or skipped
}) {
  const dispatch  = useDispatch();
  const { user }  = useSelector((s) => s.auth); // eslint-disable-line no-unused-vars
  const { status } = useSelector((s) => s.business); // eslint-disable-line no-unused-vars

  const [messages, setMessages]     = useState([]);
  const [step, setStep]             = useState(STEPS.CONFIRM);
  const [text, setText]             = useState("");
  const [businessName, setBusinessName] = useState(""); // eslint-disable-line no-unused-vars
  const [showInput, setShowInput]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const listRef    = useRef(null);
  const timeoutRef = useRef(null);

  // autoscroll
  useEffect(() => {
    if (listRef.current) {
      const t = setTimeout(() => {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 150);
      return () => clearTimeout(t);
    }
  }, [messages]);

  // cleanup
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // kick off the conversation
  useEffect(() => {
    addThemMessage(
      "I see you'd like to use Sendrey for business. Would you like to convert your account to a business account to add team members, track expenses, and schedule deliveries?",
      { hasYesNo: true }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addThemMessage = (text, extra = {}) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      from: "them",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
      ...extra,
    }]);
  };

  const addMeMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      from: "me",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    }]);
  };

  const addProgress = () => {
    setMessages(prev => [...prev, {
      id: "progress",
      from: "them",
      text: "In progress...",
      status: "delivered",
    }]);
  };

  const removeProgress = () => {
    setMessages(prev => prev.filter(m => m.id !== "progress"));
  };

  const handleYes = () => {
    addMeMessage("Yes");
    setShowInput(false);
    timeoutRef.current = setTimeout(() => {
      addThemMessage("Great! What's your business name?");
      setStep(STEPS.BUSINESS_NAME);
      setShowInput(true);
    }, 1000);
  };

  const handleNo = () => {
    addMeMessage("No thanks");
    timeoutRef.current = setTimeout(() => {
      addThemMessage("No problem! You can always upgrade later from Settings.");
      timeoutRef.current = setTimeout(() => onComplete?.(), 1500);
    }, 1000);
  };

  const handleBusinessNameSubmit = async () => {
    const name = text.trim();
    if (!name) return;

    addMeMessage(name);
    setBusinessName(name);
    setText("");
    setShowInput(false);
    addProgress();
    setIsProcessing(true);

    try {
      const result = await dispatch(convertToBusiness({ businessName: name })).unwrap();
      const updatedUser = result?.data?.user;
      if (updatedUser) dispatch(updateUser(updatedUser));

      removeProgress();
      setIsProcessing(false);

      timeoutRef.current = setTimeout(() => {
        addThemMessage(
          "You'll be the admin. Would you like to invite team members now?",
          { hasInviteChoice: true }
        );
        setStep(STEPS.INVITE);
      }, 800);
    } catch (err) {
      removeProgress();
      setIsProcessing(false);
      addThemMessage("Something went wrong. Please try again from Settings.");
      timeoutRef.current = setTimeout(() => onComplete?.(), 2000);
    }
  };

  const handleInviteYes = () => {
    addMeMessage("Yes, invite members");
    timeoutRef.current = setTimeout(() => {
      addThemMessage("Enter their email or phone number to invite them to your team.");
      setStep(STEPS.INVITE_INPUT);
      setShowInput(true);
    }, 1000);
  };

  const handleInviteSkip = () => {
    addMeMessage("Skip for now");
    timeoutRef.current = setTimeout(() => {
      addThemMessage("Business account activated! You can now access team features and expense reports in settings.");
      setStep(STEPS.DONE);
      timeoutRef.current = setTimeout(() => onComplete?.(), 2500);
    }, 1000);
  };

  const handleInviteSubmit = async () => {
    const identifier = text.trim();
    if (!identifier) return;

    addMeMessage(identifier);
    setText("");
    setShowInput(false);
    addProgress();

    try {
      await dispatch(inviteMember({ identifier, role: "staff" })).unwrap();
      removeProgress();
      timeoutRef.current = setTimeout(() => {
        addThemMessage(`Invited! Would you like to invite another member?`, { hasInviteAnother: true });
      }, 800);
    } catch (err) {
      removeProgress();
      addThemMessage(
        err?.message || "Could not find a Sendrey account with that contact. Try another?"
      );
      timeoutRef.current = setTimeout(() => {
        setShowInput(true);
      }, 800);
    }
  };

  const handleInviteAnother = () => {
    addMeMessage("Yes, invite another");
    timeoutRef.current = setTimeout(() => {
      addThemMessage("Enter their email or phone number.");
      setShowInput(true);
    }, 800);
  };

  const handleDoneInviting = () => {
    addMeMessage("Done inviting");
    setShowInput(false);
    timeoutRef.current = setTimeout(() => {
      addThemMessage("Business account activated! You can now access team features and expense reports in settings.");
      setStep(STEPS.DONE);
      timeoutRef.current = setTimeout(() => onComplete?.(), 2500);
    }, 1000);
  };

  const handleSend = () => {
    if (!text.trim() || isProcessing) return;
    if (step === STEPS.BUSINESS_NAME) handleBusinessNameSubmit();
    if (step === STEPS.INVITE_INPUT)  handleInviteSubmit();
  };

  const getPlaceholder = () => {
    if (step === STEPS.BUSINESS_NAME) return "Enter your business name...";
    if (step === STEPS.INVITE_INPUT)  return "Email or phone number...";
    return "Type here...";
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode} onMore={onMore}>
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-hidden relative">
          <div ref={listRef} className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full max-w-3xl mx-auto p-3">

              {messages.map((m) => (
                <p className="mx-auto" key={m.id}>
                  <Message
                    m={m}
                    showCursor={false}
                    darkMode={darkMode}
                    disableContextMenu
                  />

                  {/* Yes / No buttons — confirm step */}
                  {m.hasYesNo && (
                    <div className="flex gap-2 mb-3 px-1">
                      <button
                        onClick={handleYes}
                        className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-primary text-white active:scale-95 transition-all"
                      >
                        Yes, convert
                      </button>
                      <button
                        onClick={handleNo}
                        className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${
                          darkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
                        }`}
                      >
                        Not now
                      </button>
                    </div>
                  )}

                  {/* Invite choice */}
                  {m.hasInviteChoice && (
                    <div className="flex gap-2 mb-3 px-1">
                      <button
                        onClick={handleInviteYes}
                        className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-primary text-white active:scale-95 transition-all"
                      >
                        Invite members
                      </button>
                      <button
                        onClick={handleInviteSkip}
                        className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${
                          darkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
                        }`}
                      >
                        Skip for now
                      </button>
                    </div>
                  )}

                  {/* Invite another / done */}
                  {m.hasInviteAnother && (
                    <div className="flex gap-2 mb-3 px-1">
                      <button
                        onClick={handleInviteAnother}
                        className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-primary text-white active:scale-95 transition-all"
                      >
                        Invite another
                      </button>
                      <button
                        onClick={handleDoneInviting}
                        className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${
                          darkMode ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"
                        }`}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </p>
              ))}

              <div className="h-32 pb-32" />
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="absolute w-full bottom-8 sm:bottom-[40px] px-4 sm:px-8 lg:px-64 right-0 left-0">
          {showInput && (
            <div className="max-w-3xl mx-auto">
              <CustomInput
                showMic={false}
                showIcons={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={getPlaceholder()}
                send={handleSend}
              />
            </div>
          )}
        </div>
      </div>
    </Onboarding>
  );
}