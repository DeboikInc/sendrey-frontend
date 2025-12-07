// /raw
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import {
  Avatar,
  IconButton,
  Button,
  Badge,
  Tooltip,
  Drawer,
} from "@material-tailwind/react";
import {
  Search,
  MoreVertical,
  Phone,
  Video,
  Paperclip,
  Smile,
  Mic,
  Ellipsis,
  ChevronLeft,
  Menu,
  Plus,
  Camera,
  Check,
  CheckCheck,
  MoreHorizontal,
  X,
  Sun,
  Moon
} from "lucide-react";
import { motion, } from "framer-motion";
import useDarkMode from "../hooks/useDarkMode";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/common/Modal";
import CustomInput from "../components/common/CustomInput";
import { useCredentialFlow } from "../hooks/useCredentialFlow";
import RunnerNotifications from "../components/common/RunnerNotifications";
import { useDispatch, useSelector } from "react-redux";
import { fetchNearbyUserRequests } from "../Redux/userSlice";
import Message from "../components/common/Message";
import { useSocket } from "../hooks/useSocket";
import { InitialRunnerMessage } from "../components/common/InitialRunnerMessage";
import OrderStatusFlow from "../components/common/OrderStatusFlow";

// --- Mock  Data ---
const contacts = [
  {
    id: 1,
    name: "Zilan",
    lastMessage: "Thank you very much, I am wai…",
    time: "12:35 PM",
    online: true,
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=200&auto=format&fit=crop",
    about: "Hello My name is Zilan",
    media: [
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=300&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop",
    ],
  },
];

const initialMessages = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text:
      "Would you like like to run a pickup or run an errand?",
    time: "12:25 PM",
    status: "delivered",
  },

];

const HeaderIcon = ({ children, tooltip }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full">
      {children}
    </IconButton>
  </Tooltip>
);

export default function WhatsAppLikeChat() {
  const [dark, setDark] = useDarkMode();
  const [active, setActive] = useState(contacts[0]);
  const [messages, setMessages] = useState(initialMessages);
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile left sidebar
  const [infoOpen, setInfoOpen] = useState(false); // mobile right info panel
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const [activeModal, setActiveModal] = useState(null);
  const serviceTypeRef = useRef(null);
  const [showOrderFlow, setShowOrderFlow] = useState(false);

  const SOCKET_URL = "http://localhost:4001";
  const { socket, joinRunnerRoom, joinChat, sendMessage } = useSocket(SOCKET_URL);

  const [showUserSheet, setShowUserSheet] = useState(false);
  const [runnerId, setRunnerId] = useState(null);
  const [runnerLocation, setRunnerLocation] = useState(null);

  const [isChatActive, setIsChatActive] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const dispatch = useDispatch();
  const searchIntervalRef = useRef(null);

  const [canResendOtp, setCanResendOtp] = useState(false);

  // Redux state for nearby requests
  const { nearbyUsers, loading } = useSelector((state) => state.users);

  const {
    isCollectingCredentials,
    credentialStep,
    credentialQuestions,
    startCredentialFlow,
    needsOtpVerification,
    handleCredentialAnswer,
    showOtpVerification,
    registrationComplete,
    setRegistrationComplete,
    handleOtpVerification,
    onRegistrationSuccess,
    runnerData
  } = useCredentialFlow(serviceTypeRef, (runnerData) => {
    setRunnerId(runnerData._id || runnerData.id);
  });

  useEffect(() => {
    console.log('Runner data from hook:', runnerData);
    console.log('Runner ID:', runnerId);
  }, [runnerData, runnerId]);

  useEffect(() => {
    if (needsOtpVerification) {
      // Start disabled
      setCanResendOtp(false);

      // Enable resend after 30 seconds
      const timer = setTimeout(() => {
        setCanResendOtp(true);
      }, 15000);

      return () => clearTimeout(timer);
    }
  }, [needsOtpVerification]);

  useEffect(() => {
    if (registrationComplete) {
      setShowUserSheet(true);
    }
  }, [registrationComplete]);

  const displayMessages = isChatActive
    ? messages.filter(m => !m.isCredential)
    : messages;

  const handleResendOtp = () => {
    if (!canResendOtp) return;

    const msg1 = {
      id: Date.now(),
      from: "them",
      text: "We have sent you a new OTP",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered"
    };

    setMessages(prev => [...prev, msg1]);

    setTimeout(() => {
      const msg2 = {
        id: Date.now() + 1,
        from: "them",
        text: `Enter the OTP we sent to ${runnerData.phone}, \n \nDidn't receive OTP? Resend`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
        hasResendLink: true
      };

      setMessages(prev => [...prev, msg2]);
    }, 1200);

    // Disable resend for 40 seconds
    setCanResendOtp(false);

    setTimeout(() => {
      setCanResendOtp(true);
    }, 40000);
  };


  const handleMessageClick = (message) => {
    if (message.hasResendLink && canResendOtp) {
      handleResendOtp();
    }
  };

  const pickUp = () => {
    serviceTypeRef.current = "pick-up";
    const newMsg = {
      id: Date.now().toString(),
      from: "me",
      text: 'Pick Up',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      isCredential: true
    };
    setMessages((p) => [...p, newMsg]);

    // Start credential flow in the chat
    setTimeout(() => {
      startCredentialFlow('pick-up', setMessages);
    }, 1000);
  }

  const runErrand = () => {
    serviceTypeRef.current = "run-errand";
    const newMsg = {
      id: Date.now().toString(),
      from: "me",
      text: 'Run Errand',
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      isCredential: true
    };
    setMessages((p) => [...p, newMsg]);

    // Start credential flow in the chat
    setTimeout(() => {
      startCredentialFlow('run-errand', setMessages);
    }, 1000);
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (drawerOpen || infoOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [drawerOpen, infoOpen]);

  // Get runner location after registration
  useEffect(() => {
    if (registrationComplete) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setRunnerLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            console.error("Error getting location:", error);
            // Fallback to Lagos
            setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
          }
        );
      } else {
        setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
      }
    }
  }, [registrationComplete]);

  // Silent search for nearby service requests
  useEffect(() => {
    const searchNearbyRequests = () => {
      if (!runnerLocation || !serviceTypeRef.current) return;

      const searchParams = {
        latitude: runnerLocation.latitude,
        longitude: runnerLocation.longitude,
        serviceType: serviceTypeRef.current,
        fleetType: runnerData?.fleetType
      };

      console.log("Searching for nearby requests:", searchParams);
      dispatch(fetchNearbyUserRequests(searchParams));
    };

    if (registrationComplete && runnerLocation && serviceTypeRef.current && !isChatActive) {
      // Initial search
      searchNearbyRequests();

      // Poll every 50 seconds
      searchIntervalRef.current = setInterval(() => {
        searchNearbyRequests();
      }, 50000);

      return () => {
        if (searchIntervalRef.current) {
          clearInterval(searchIntervalRef.current);
        }
      };
    }
  }, [registrationComplete, runnerLocation, isChatActive, dispatch, runnerData?.fleetType]);

  useEffect(() => {
    if (isChatActive && selectedUser && socket) {
      const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

      joinChat(
        chatId,
        (msgs) => {
          const formattedMsgs = msgs.map(msg => ({
            ...msg,
            from: msg.senderId === runnerId ? "me" : "them"
          }));
          setMessages(formattedMsgs);
        },
        (msg) => {
          // ONLY add message if it's NOT from yourself
          if (msg.senderId !== runnerId) {
            const formattedMsg = {
              ...msg,
              from: "them"
            };
            setMessages((prev) => [...prev, formattedMsg]);
          }
        }
      );
    }
  }, [isChatActive, selectedUser, socket, runnerId, joinChat]);

  useEffect(() => {
    if (registrationComplete && runnerId && serviceTypeRef.current && socket) {
      joinRunnerRoom(runnerId, serviceTypeRef.current);
    }
  }, [registrationComplete, runnerId, socket, joinRunnerRoom]);

  const send = () => {
    if (!text.trim()) return;

    if (needsOtpVerification) {
      // Handle OTP verification
      const otpMessage = {
        id: Date.now(),
        from: "me",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      };
      setMessages((prev) => [...prev, otpMessage]);

      handleOtpVerification(text.trim(), setMessages);
      setText("");
    } else if (isCollectingCredentials && credentialStep !== null) {
      // Handle credential collection
      handleCredentialAnswer(text.trim(), setText, setMessages);
    } else if (isChatActive) {
      const newMsg = {
        id: Date.now().toString(),
        from: "me",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        senderId: runnerId,
        senderType: "runner"
      };

      setMessages((p) => [...p, newMsg]);
      setText("");

      // Send via socket
      if (socket) {
        sendMessage(`user-${selectedUser._id}-runner-${runnerId}`, newMsg);
      }
    }
  }

  const handlePickService = async (user) => {
    console.log("user service found:", user);

    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
    }

    setSelectedUser(user);
    setIsChatActive(true);
    setMessages([]);

    const chatId = `user-${user._id}-runner-${runnerId}`;

    await InitialRunnerMessage({
      user,
      runnerData,
      serviceType: serviceTypeRef.current,
      runnerId,
      socket,
      chatId,
      sendMessage
    });
  };

  const handleLocationClick = () => {
    setShowOrderFlow(true);
  };

  return (
    <div className={` bg-white dark:bg-black-100`}>
      <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
        {/* Top Bar (mobile) */}
        <div className="lg:hidden flex items-center justify-between px-3 py-3 border-b dark:border-white/10 border-gray-200">
          <div className="flex items-center gap-2">
            <IconButton variant="text" className="rounded-full" onClick={() => setDrawerOpen(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>
          </div>

          <div className="flex gap-3">
            <span
              className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
              <HeaderIcon tooltip="More"><MoreHorizontal className="h-6 w-6" /></HeaderIcon>
            </span>
            <div
              onClick={() => setDark(!dark)}
              className="cursor-pointer flex items-center gap-2 p-2"
            >
              {dark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6 text-gray-800" strokeWidth={3.0} />}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] h-[calc(100vh-0px)] lg:h-screen grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
          {/* Left Sidebar */}
          <aside className="hidden lg:flex flex-col border-r dark:border-white/10 border-gray-200 bg-white/5/10 backdrop-blur-xl">
            <SidebarContent active={active} setActive={setActive} />
          </aside>

          {/* Main Chat Area */}
          <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth relative">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
              <div className="flex items-center gap-3 min-w-0">
                <IconButton variant="text" className="rounded-full lg:hidden" onClick={() => setDrawerOpen(true)}>
                  <ChevronLeft className="h-5 w-5" />
                </IconButton>

                <Avatar src={isChatActive && selectedUser ? selectedUser.avatar : active.avatar}
                  alt={isChatActive && selectedUser ? selectedUser.firstName : active.name}
                  size="sm" />

                <div className="truncate">
                  <div className={`font-bold text-[16px] truncate dark:text-white text-black-200`}>
                    {isChatActive && selectedUser
                      ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`
                      : active.name}
                  </div>
                  <div className="text-sm font-medium text-gray-900">Online</div>
                </div>
              </div>
              <IconButton variant="text" className="rounded-full sm:hidden" onClick={() => setInfoOpen(true)}>
                <Ellipsis className="h-5 w-5" />
              </IconButton>
              <div className="items-center gap-3 hidden sm:flex">
                <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                  <HeaderIcon tooltip="Video call"><Video className="h-6 w-6" /></HeaderIcon>
                </span>
                <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                  <HeaderIcon tooltip="Voice call"><Phone className="h-6 w-6" /></HeaderIcon>
                </span>
                <span
                  className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                  <HeaderIcon tooltip="More"><MoreHorizontal className="h-6 w-6" /></HeaderIcon>
                </span>
                <div className="hidden lg:block pl-2">
                  <div
                    onClick={() => setDark(!dark)}
                    className="cursor-pointer bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center"
                  >
                    {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
                  </div>

                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200">
              <div className="mx-auto max-w-3xl">
                {messages.map((m) => (
                  <Message key={m.id} m={m}
                    canResendOtp={canResendOtp}
                    onMessageClick={() => handleMessageClick(m)}
                    showCursor={false}
                  />
                ))}
              </div>
            </div>

            {/* Composer */}
            <div className="bg-gray-100 dark:bg-black-200">
              {!isCollectingCredentials && !registrationComplete && !isChatActive ? (
                <div className="flex gap-5 p-4">

                  <Button onClick={pickUp} className="bg-secondary rounded-lg w-full h-14 sm:text-lg">Pick Up</Button>
                  <Button onClick={runErrand} className="bg-primary rounded-lg w-full sm:text-lg">Run Errand</Button>
                </div>
              ) : isCollectingCredentials && credentialStep !== null ? (<div className="p-4 py-7">
                <CustomInput
                  showMic={false}
                  send={send}
                  showIcons={false}
                  showEmojis={false}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={credentialStep === null}
                  placeholder={
                    needsOtpVerification
                      ? "OTP - 09726"
                      : credentialStep === null
                        ? "Processing..."
                        : `Your ${credentialQuestions[credentialStep]?.field}...`
                  }
                />
              </div>
              ) : registrationComplete && !isChatActive ? (
                <div className="p-4 py-7">
                  <CustomInput
                    showMic={false}
                    setLocationIcon={true}
                    showIcons={false}
                    send={send}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message..."
                  />
                </div>
              ) : isChatActive ? (
                <div className="p-4 py-7">
                  <CustomInput
                    showMic={false}
                    setLocationIcon={true} // onClick locationIcon
                    showIcons={true}
                    send={send}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message ${selectedUser?.firstName || 'user'}...`}
                    onLocationClick={handleLocationClick}
                  />
                </div>
              ) : null}
              {/* connect to runner btn */}

              {/* RunnerNotifications */}
              {registrationComplete && !isChatActive && (
                <RunnerNotifications
                  requests={nearbyUsers}
                  runnerId={runnerId}
                  darkMode={dark}
                  onPickService={handlePickService}
                />
              )}

              {showOrderFlow && (
                <OrderStatusFlow
                  isOpen={showOrderFlow}
                  onClose={() => setShowOrderFlow(false)}
                  orderData={{
                    deliveryLocation: selectedUser?.deliveryLocation || "No 90 alisquare ikeja mobolaji estate",
                    pickupLocation: selectedUser?.pickupLocation || "Pickup Location"
                  }}
                  darkMode={dark}
                />
              )}

              <div className="hidden mx-auto max-w-3xl items-center gap-3 absolute sm:left-5 sm:right-5 bottom-5 px-2">
                <div className="flex-1 flex items-center px-3 bg-white dark:bg-black-100 rounded-full h-14 shadow-lg backdrop-blur-lg">
                  <HeaderIcon tooltip="Emoji"><Smile className="h-8 w-8" /></HeaderIcon>
                  <input
                    placeholder="Type a message"
                    className="w-full bg-transparent outline-0 font-normal text-lg text-black-100 dark:text-gray-100 px-5"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                  />
                  <HeaderIcon tooltip="Attach"><Paperclip className="h-8 w-8" /></HeaderIcon>
                </div>
                <div className="flex items-center">
                  {!text && <IconButton variant="text" className="rounded-full bg-primary text-white" onClick={() => setMessages((p) => [...p, { id: Date.now() + 99, from: 'them', text: '🎙️ Voice note (0:12)', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'delivered' }])}>
                    <Mic className="h-7 w-7" />
                  </IconButton>}
                  {text && <Button onClick={send} className="rounded-full bg-primary">
                    Send
                  </Button>}
                </div>
              </div>
            </div>
          </section>

          {/* Right Info Panel */}
          <aside className="hidden lg:block border-l dark:border-white/10 border-gray-200">
            <ContactInfo contact={active}
              onClose={() => setInfoOpen(false)}
              setActiveModal={setActiveModal}
            />
          </aside>
        </div>

        {/* Drawers (mobile) */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          className="p-0 bg-white dark:bg-black-100 backdrop-blur-xl"
        >
          <SidebarContent
            active={active}
            setActive={(c) => { setActive(c); setDrawerOpen(false); }}
            onClose={() => setDrawerOpen(false)}
          />
        </Drawer>

        <Drawer
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          placement="right"
          className="p-0 bg-white dark:bg-black-100 backdrop-blur-xl"
        >
          <ContactInfo contact={active} onClose={() => setInfoOpen(false)} setActiveModal={setActiveModal} />
        </Drawer>

        {activeModal && (
          <Modal
            type={activeModal}
            onClose={() => setActiveModal(null)}
          />
        )}

      </div>
    </div>
  );
}

function SidebarContent({ active, setActive, onClose, }) {
  return (
    <div className="h-full flex flex-col">

      {/* Search */}
      <div className="ml-auto text-lg p-3">
        {onClose && (
          <IconButton variant="text" size="sm" className="rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        )}
      </div>
      <div className="px-3 py-4 border-b dark:border-white/10 border-gray-200">
        <div className="flex items-center gap-2 bg-gray-200 dark:bg-black-200 rounded-full px-3 py-2 border dark:border-white/10 border-gray-200">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            placeholder="Search errand or pickup history"
            className="bg-transparent outline-none text-sm w-full placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="font-bold px-4 text-sm text-black-200 dark:text-gray-300 my-3">Pickup or Errand History</h3>
        {contacts.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-black-200 transition-colors border-b border-white/5 ${active.id === c.id ? "dark:bg-black-200 bg-gray-200" : ""
              }`}
          >
            <div className="relative">
              <Avatar src={c.avatar} alt={c.name} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-bold text-[16px] truncate ${active.id === c.id ? "dark:text-white text-black-200" : "text-black-200 dark:text-gray-400"}`}>{c.name}</span>
                <span className={`font-medium text-gray-800 text-xs`}>{c.time}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-normal truncate ${active.id === c.id ? "text-gray-500" : "text-gray-700 dark:text-gray-600"}`}>{c.lastMessage}</span>
                {c.unread ? (
                  <Badge content={c.unread} className="bg-emerald-600 text-[10px]" />
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactInfo({ contact, onClose, setActiveModal }) {
  const [dark] = useDarkMode();
  const navigate = useNavigate();

  const handleModalClick = (modalType) => {
    onClose?.();
    if (setActiveModal) {
      setActiveModal(modalType);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-y-auto gap-6 marketSelection">
      <div className="py-3 px-2">
        {onClose ? (
          <IconButton variant="text" size="sm" className="rounded-full lg:hidden flex" onClick={onClose}>
            <X className="h-7 w-7" />
          </IconButton>
        ) : null}
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
        onClick={() => navigate('/profile', { state: { darkMode: dark } })}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Profile</h3>
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"

        onClick={() => navigate('/locations', { state: { darkMode: dark } })}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Locations</h3>
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
        onClick={() => navigate('/wallet', { state: { darkMode: dark } })}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Wallet</h3>
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
        onClick={() => navigate('/ongoing-orders', { state: { darkMode: dark } })}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Ongoing Orders</h3>
      </div>

      <div
        onClick={() => handleModalClick('newOrder')}
        className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors">
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Start new order</h3>
      </div>

      <div
        onClick={() => handleModalClick('cancelOrder')}
        className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors">
        <p className="px-4 py-5 text-md font-medium px-4 text-red-400 dark:text-red-400 ">Cancel order</p>
      </div>

    </div>
  );
}
