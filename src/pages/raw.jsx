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

// --- Mock  Data ---
const contacts = [
  {
    id: 1,
    name: "Zilan",
    lastMessage: "Thank you very much, I am wai…",
    time: "12:35 PM",
    online: true,
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=200&auto=format&fit=crop",
    about: "Hello My name is Zilan …",
    media: [
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=300&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=300&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=300&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop",
    ],
  },
  {
    id: 2,
    name: "Shehnaz",
    lastMessage: "Call ended",
    time: "12:35 PM",
    online: true,
    avatar: "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?q=80&w=200&auto=format&fit=crop",
  },
  {
    id: 3,
    name: "Client",
    lastMessage: "What time are we there?",
    time: "9:12 AM",
    unread: 13,
    online: false,
    avatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?q=80&w=200&auto=format&fit=crop",
  },
  {
    id: 4,
    name: "Muhammad",
    lastMessage: "You: I will send you the work file",
    time: "9:00 AM",
    online: true,
    avatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?q=80&w=200&auto=format&fit=crop",
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

const Message = ({ m }) => {
  const isMe = m.from === "me";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`w-full flex ${isMe ? "justify-end" : "justify-start"} mb-2`}
    >
      <div className="max-w-[80%] md:max-w-[55%]">
        <div
          className={`shadow-sm backdrop-blur-sm rounded-2xl px-4 py-3 text-sm font-normal 
        ${isMe
              ? "bg-primary border-primary text-white"
              : "bg-gray-1001 dark:bg-black-100 dark:border-black-100 border-gray-1001 dark:text-gray-1002 text-black-200"}`}
        >
          <div>{m.text}</div>
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${isMe ? "text-gray-1001" : "text-primary"}`}>
            {isMe && (
              <span className="flex items-center">
                {m.status === "read" ? <CheckCheck className="w-3 h-3" /> : m.status === "delivered" ? <Check className="w-3 h-3" /> : null}
              </span>
            )}
          </div>
        </div>
        <span className="text-gray-800 text-xs font-medium">{m.time}</span>
      </div>
    </motion.div>
  );
};

export default function WhatsAppLikeChat() {
  const [dark, setDark] = useDarkMode();
  const [active, setActive] = useState(contacts[0]);
  const [messages, setMessages] = useState(initialMessages);
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile left sidebar
  const [infoOpen, setInfoOpen] = useState(false); // mobile right info panel
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const [activeModal, setActiveModal] = useState(null);
  const [runnerService, setRunnerService] = useState(null);
  const serviceTypeRef = useRef(null);
  const SOCKET_URL = "http://localhost:4001";
  const socketRef = useRef();
  const [showUserSheet, setShowUserSheet] = useState(false);
  // const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [runnerId, setRunnerId] = useState(null);

  const [runnerLocation, setRunnerLocation] = useState(null);

  const [isChatActive, setIsChatActive] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const dispatch = useDispatch();
  const searchIntervalRef = useRef(null);

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
    runnerData
  } = useCredentialFlow(serviceTypeRef, (userData) => {
    setRunnerId(userData._id || userData.id);
  });

  // useEffect(() => {
  //   if (needsOtpVerification) {
  //     showOtpVerification(setMessages);
  //   }
  // }, [needsOtpVerification]);

  useEffect(() => {
    if (registrationComplete) {
      setShowUserSheet(true);
    }
  }, [registrationComplete]);

  const displayMessages = isChatActive
    ? messages.filter(m => !m.isCredential)
    : messages;

  const pickUp = () => {
    serviceTypeRef.current = "pick-up";
    const newMsg = {
      id: Date.now(),
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
      id: Date.now(),
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

      // Poll every 10 seconds
      searchIntervalRef.current = setInterval(() => {
        searchNearbyRequests();
      }, 10000);

      return () => {
        if (searchIntervalRef.current) {
          clearInterval(searchIntervalRef.current);
        }
      };
    }
  }, [registrationComplete, runnerLocation, isChatActive, dispatch, runnerData?.fleetType]);


  // websocket logic
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current.id);
    });

    if (isChatActive && selectedUser) {
      socketRef.current = io(SOCKET_URL);

      // Join room with selected user
      socketRef.current.emit("joinChat", selectedUser.id);

      // Load chat history from server
      socketRef.current.on("chatHistory", (msgs) => {
        setMessages(msgs);
      });

      // Listen for incoming messages
      socketRef.current.on("message", (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      return () => {
        socketRef.current.disconnect();
      };
    }
  }, [isChatActive, selectedUser]);


  const send = () => {
    if (!text.trim()) return;
    if (isCollectingCredentials && credentialStep !== null) {
      // Handle credential collection
      handleCredentialAnswer(text.trim(), setText, setMessages);
    } else if (isChatActive) {
      const newMsg = {
        id: Date.now(),
        from: "me",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
      };

      // Send via socket
      if (socketRef.current) {
        socketRef.current.emit("sendMessage", {
          to: selectedUser.id,
          message: newMsg
        });
      }

      setMessages((p) => [...p, newMsg]);
      setText("");
    }
  }

  const handlePickService = (user) => {
    console.log("Runner picked service:", user);

    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
    }

    setSelectedUser(user);
    setIsChatActive(true);
    setMessages([]);

    // Send initial greeting message
    setTimeout(() => {
      const greetingMsg = {
        id: Date.now(),
        from: "me",
        text: `Hi ${user.firstName}! I'm ${runnerData?.firstName || 'your runner'}. I'll be handling your ${serviceTypeRef.current?.replace('-', ' ')}. I'm on my way!`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent"
      };

      setMessages([greetingMsg]);

      // Also send via socket
      if (socketRef.current) {
        socketRef.current.emit("sendMessage", {
          chatId: `${runnerId}-${user._id}`,
          message: greetingMsg
        });
      }
    }, 500);
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
          <section className="flex flex-col min-w-0 overflow-hidden scroll-smooth">
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
                  <Message key={m.id} m={m} />
                ))}
              </div>
            </div>

            {/* Composer */}
            <div className="bg-gray-100 dark:bg-black-200 relative">
              {!isCollectingCredentials && !registrationComplete && !isChatActive ? (
                <div className="flex gap-5 p-4">

                  <Button onClick={pickUp} className="bg-secondary rounded-lg w-full h-14 sm:text-lg">Pick Up</Button>
                  <Button onClick={runErrand} className="bg-primary rounded-lg w-full sm:text-lg">Run Errand</Button>
                </div>
              ) : isCollectingCredentials && credentialStep !== null ? (<div className="p-4 py-7">
                <CustomInput
                  showMic={false}
                  send={send}
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
              ) : isChatActive ? (
                <div className="p-4 py-7">
                  <CustomInput
                    showMic={true}
                    send={send}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message ${selectedUser?.firstName || 'user'}...`}
                  />
                </div>
              ) : null}

              {/* RunnerNotifications */}
              {registrationComplete && !isChatActive && (
                <RunnerNotifications
                  requests={nearbyUsers}
                  runnerId={runnerId}
                  darkMode={dark}
                  onPickService={handlePickService}
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
