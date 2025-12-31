// /raw
import React, { useState, useEffect, useRef } from "react";
import {
  Avatar,
  IconButton,
  Button,
  Badge,
  Drawer,
} from "@material-tailwind/react";
import {
  Search,
  MoreVertical,
  ChevronLeft,
  Menu,
  MoreHorizontal,
  X,
  Sun,
  Moon
} from "lucide-react";
import useDarkMode from "../hooks/useDarkMode";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/common/Modal";
import { useCredentialFlow } from "../hooks/useCredentialFlow";
import { useDispatch, useSelector } from "react-redux";
import { fetchNearbyUserRequests } from "../Redux/userSlice";
import { useSocket } from "../hooks/useSocket";
import { InitialRunnerMessage } from "../components/common/InitialRunnerMessage";
import { sendOrderStatusMessage } from "../components/common/OrderStatusSystemMessages";
import RunnerChatScreen from "../components/screens/RunnerChatScreen";

import { Profile } from './Profile';
import { Location } from './Location';
import { Wallet } from './Wallet';
import { OngoingOrders } from './OngoingOrders';


const initialMessages = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text: "Would you like like to run a pickup or run an errand?",
    time: "12:25 PM",
    status: "delivered",
  },
];

const HeaderIcon = ({ children, tooltip }) => (
  <IconButton variant="text" size="sm" className="rounded-full">
    {children}
  </IconButton>
);

export default function WhatsAppLikeChat() {
  const [dark, setDark] = useDarkMode();

  // users chat histort
  const [chatHistory, setChatHistory] = useState([]);
  const [active, setActive] = useState(null);

  const [messages, setMessages] = useState(initialMessages);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [text, setText] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const serviceTypeRef = useRef(null);

  // for contactInfo
  const [currentView, setCurrentView] = useState('chat');

  // flows
  const [showOrderFlow, setShowOrderFlow] = useState(false);
  const [isAttachFlowOpen, setIsAttachFlowOpen] = useState(false);
  
  const { socket, joinRunnerRoom, joinChat, sendMessage, isConnected } = useSocket();

  const [showUserSheet, setShowUserSheet] = useState(false);
  const [runnerId, setRunnerId] = useState(null);
  const [runnerLocation, setRunnerLocation] = useState(null);

  const [isChatActive, setIsChatActive] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [initialMessageSent, setInitialMessageSent] = useState(false);

  const [completedOrderStatuses, setCompletedOrderStatuses] = useState([]);

  const dispatch = useDispatch();
  const searchIntervalRef = useRef(null);

  const [canResendOtp, setCanResendOtp] = useState(false);

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
      setCanResendOtp(false);
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

    setTimeout(() => {
      startCredentialFlow('run-errand', setMessages);
    }, 1000);
  }

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
            setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
          }
        );
      } else {
        setRunnerLocation({ latitude: 6.5244, longitude: 3.3792 });
      }
    }
  }, [registrationComplete]);

  // Silent search for nearby service requests, polling
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

      dispatch(
        fetchNearbyUserRequests(searchParams)
      );
    };

    if (registrationComplete && runnerLocation && serviceTypeRef.current && !isChatActive) {
      searchNearbyRequests();

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
    if (isChatActive && selectedUser && socket && !initialMessageSent) {
      const chatId = `user-${selectedUser._id}-runner-${runnerId}`;

      joinChat(
        chatId,
        (msgs) => {
          const formattedMsgs = msgs.map(msg => ({
            ...msg,
            from: msg.from === 'system' || msg.messageType === 'system' || msg.type === 'system' || msg.messageType === 'profile-card'
              ? 'system'
              : (msg.senderId === runnerId ? "me" : "them")
          }));
          setMessages(formattedMsgs);

          // only send initial message if chat is empty
          if (!msgs || msgs.length === 0) {
            InitialRunnerMessage({
              user: selectedUser,
              runnerData,
              serviceType: serviceTypeRef.current,
              runnerId,
              socket,
              chatId,
              sendMessage
            });
          }
        },
        (msg) => {
          if (msg.senderId !== runnerId) {
            const formattedMsg = {
              ...msg,
              from: msg.from === 'system' || msg.messageType === 'system' || msg.type === 'system' || msg.messageType === 'profile-card'
                ? 'system'
                : "them"
            };
            setMessages((prev) => [...prev, formattedMsg]);

            if (msg.text && selectedUser?._id) {
              updateLastMessage(selectedUser._id, msg.text);
            }
          }
        }
      );

      setInitialMessageSent(true);
      console.log(`Joined chat: ${chatId}`);
    }
  }, [isChatActive, selectedUser, socket, runnerId, joinChat, initialMessageSent, sendMessage, runnerData]);


  useEffect(() => {
    if (registrationComplete && runnerId && serviceTypeRef.current && socket) {
      joinRunnerRoom(runnerId, serviceTypeRef.current);
    }
  }, [registrationComplete, runnerId, socket, joinRunnerRoom]);

  const send = () => {
    if (!text.trim()) return;

    if (needsOtpVerification) {
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
      handleCredentialAnswer(text.trim(), setText, setMessages);
    } else if (isChatActive) {
      const newMsg = {
        id: Date.now().toString(),
        from: "me",
        type: "text",
        text: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "sent",
        senderId: runnerId,
        senderType: "runner"
      };

      setMessages((p) => [...p, newMsg]);
      setText("");

      if (socket) {
        sendMessage(`user-${selectedUser._id}-runner-${runnerId}`, newMsg);
        updateLastMessage(selectedUser._id, text.trim());
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
    setInitialMessageSent(false);

    // Add user to chat history
    const newChatEntry = {
      id: user._id,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      lastMessage: "", // Will update as messages come
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      online: true,
      avatar: user.profilePicture || user.avatar || "https://via.placeholder.com/128",
      userId: user._id,
      serviceType: user.serviceType,
      unread: 0
    };

    setChatHistory(prev => {
      // Check if user already exists in history
      const exists = prev.find(chat => chat.id === user._id);
      if (exists) {
        return prev; // Don't duplicate
      }
      return [newChatEntry, ...prev]; // Add to top
    });

    setActive(newChatEntry);
  };

  // helper function to update messages
  const updateLastMessage = (userId, messageText) => {
    setChatHistory(prev =>
      prev.map(chat =>
        chat.id === userId
          ? {
            ...chat,
            lastMessage: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
          : chat
      )
    );
  };

  const handleLocationClick = () => {
    setShowOrderFlow(true);
  };

  const handleAttachClick = () => {
    setIsAttachFlowOpen(true);
  }

  const handleOrderStatusClick = (statusKey) => {

    setCompletedOrderStatuses(prev =>
      prev.includes(statusKey) ? prev : [...prev, statusKey]
    );

    // handled by sendOrderStatusMessage
    if (statusKey === "send_price") {
      return;
    }

    if (statusKey === "on_way_to_delivery" || statusKey === 5) {
      console.log("RUNNER: Attempting to emit startTrackRunner");

      if (socket && isConnected) {
        // Emit the event to the server
        const trackingPayload = {
          chatId: `user-${selectedUser._id}-runner-${runnerId}`,
          runnerId: runnerId,
          userId: selectedUser._id
        };

        console.log("FRONTEND SENDING:", trackingPayload);
        socket.emit("startTrackRunner", trackingPayload); // Sending the object directly
        return;
      } else {
        console.error("RUNNER: Socket not connected, emit failed!");
      }
      return;
    }

    // Skip "send_invoice" as it has special logic
    if (statusKey === "send_invoice") {
      console.log("Send invoice - handle separately");
      return;
    }

    // Send system message for all other statuses
    sendOrderStatusMessage({
      statusKey,
      runnerId,
      userId: selectedUser._id,
      socket,
      chatId: `user-${selectedUser._id}-runner-${runnerId}`,
      sendMessage,
      setMessages,
      runnerData
    });

    // Special handling for "delivered" status
    if (statusKey === "delivered") {
      console.log("Order delivered - redirect to stats page");
      // TODO: Redirect to statistics/earnings page
    }
  };

  const renderView = () => {
    const handleBack = () => setCurrentView('chat');

    switch (currentView) {
      case 'profile':
        return <Profile darkMode={dark} onBack={handleBack} />;
      case 'location':
        return <Location darkMode={dark} onBack={handleBack} />;
      case 'wallet':
        return <Wallet darkMode={dark} onBack={handleBack} />;
      case 'ongoing-orders':
        return <OngoingOrders darkMode={dark} onBack={handleBack} />;
      case 'chat':
      default:
        return (
          <div className="mx-auto max-w-[1400px] h-[calc(100vh-0px)] lg:h-screen grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
            {/* Left Sidebar */}
            <aside className="hidden lg:flex flex-col border-r dark:border-white/10 border-gray-200 bg-white/5/10 backdrop-blur-xl">
              <SidebarContent active={active} setActive={setActive} chatHistory={chatHistory} />
            </aside>

            {/* Main Chat Area - RunnerChatScreen component */}
            <RunnerChatScreen
              active={active}
              selectedUser={selectedUser}
              isChatActive={isChatActive}
              messages={messages}
              text={text}
              setText={setText}
              dark={dark}
              setDark={setDark}
              isCollectingCredentials={isCollectingCredentials}
              credentialStep={credentialStep}
              credentialQuestions={credentialQuestions}
              needsOtpVerification={needsOtpVerification}
              registrationComplete={registrationComplete}
              canResendOtp={canResendOtp}
              send={send}
              handleMessageClick={handleMessageClick}
              pickUp={pickUp}
              runErrand={runErrand}
              setDrawerOpen={setDrawerOpen}
              setInfoOpen={setInfoOpen}
              nearbyUsers={nearbyUsers}
              runnerId={runnerId}
              onPickService={handlePickService}
              socket={socket}
              isConnected={isConnected}
              runnerData={runnerData}
              showOrderFlow={showOrderFlow}
              setShowOrderFlow={setShowOrderFlow}
              handleOrderStatusClick={handleOrderStatusClick}
              isAttachFlowOpen={isAttachFlowOpen}
              setIsAttachFlowOpen={setIsAttachFlowOpen}
              handleLocationClick={handleLocationClick}
              handleAttachClick={handleAttachClick}
              completedOrderStatuses={completedOrderStatuses}
              setCompletedOrderStatuses={setCompletedOrderStatuses}
            />

            {/* Right Info Panel */}
            <aside className="hidden lg:block border-l dark:border-white/10 border-gray-200">
              <ContactInfo
                contact={active}
                onClose={() => setInfoOpen(false)}
                setActiveModal={setActiveModal}
                onNavigate={setCurrentView}
              />
            </aside>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-black-100">
      <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
        {/* Top Bar (mobile) */}
        <div className="lg:hidden flex items-center justify-between px-3 py-3 border-b dark:border-white/10 border-gray-200">
          <div className="flex items-center gap-2">
            <IconButton variant="text" className="rounded-full" onClick={() => setDrawerOpen(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>
          </div>

          <div className="flex gap-3">
            <span className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
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

        {renderView()}

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
          <ContactInfo
            contact={active}
            onClose={() => setInfoOpen(false)}
            setActiveModal={setActiveModal}
            onNavigate={setCurrentView}
          />
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

function SidebarContent({ active, setActive, onClose, chatHistory = [] }) {
  return (
    <div className="h-full flex flex-col">
      {/* Close button */}
      <div className="ml-auto text-lg p-3">
        {onClose && (
          <IconButton variant="text" size="sm" className="rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        )}
      </div>

      {/* Search bar */}
      <div className="px-3 py-4 border-b dark:border-white/10 border-gray-200">
        <div className="flex items-center gap-2 bg-gray-200 dark:bg-black-200 rounded-full px-3 py-2 border dark:border-white/10 border-gray-200">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            placeholder="Search errand or pickup history"
            className="bg-transparent outline-none text-sm w-full placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Chat history list */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="font-bold px-4 text-md text-black-200 dark:text-gray-300 my-3">
          {chatHistory.length > 0 ? "Recent Chats" : "Pickup or Errand History"}
        </h3>

        {chatHistory.length === 0 ? (
          // Empty state
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No recent chats. Pick a service to start!
            </p>
          </div>
        ) : (
          // Show all chat history
          chatHistory.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-black-200 transition-colors border-b border-white/5 ${active?.id === c.id ? "dark:bg-black-200 bg-gray-200" : ""
                }`}
            >
              {/* Avatar */}
              <div className="relative">
                <Avatar src={c.avatar} alt={c.name} size="md" />
                {c.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-black-100 rounded-full" />
                )}
              </div>

              {/* Name, time, last message */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold text-[16px] truncate ${active?.id === c.id
                    ? "dark:text-white text-black-200"
                    : "text-black-200 dark:text-gray-400"
                    }`}>
                    {c.name}
                  </span>
                  <span className="font-medium text-gray-800 text-xs">{c.time}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-normal truncate ${active?.id === c.id
                    ? "text-gray-500"
                    : "text-gray-700 dark:text-gray-600"
                    }`}>
                    {c.lastMessage || "No messages yet"}
                  </span>

                  {c.unread > 0 && (
                    <Badge content={c.unread} className="bg-emerald-600 text-[10px]" />
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ContactInfo({ contact, onClose, setActiveModal, onNavigate, onBack }) {
  const [dark] = useDarkMode();

  const handleModalClick = (modalType) => {
    onClose?.();
    if (setActiveModal) {
      setActiveModal(modalType);
    }
  };

  const handleNavigation = (view) => {
    onClose?.();
    if (onNavigate) {
      onNavigate(view);
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
        onClick={() => handleNavigation('profile')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Profile</h3>
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
        onClick={() => handleNavigation('location')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Locations</h3>
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
        onClick={() => handleNavigation('wallet')}>
        <h3 className="px-4 py-5 font-bold text-md text-black-200 dark:text-gray-300">Wallet</h3>
      </div>

      <div className="cursor-pointer hover:bg-gray-200 dark:hover:bg-black-200 transition-colors"
        onClick={() => handleNavigation('ongoing-orders')}>
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
        <p className="px-4 py-5 text-md font-medium text-red-400 dark:text-red-400">Cancel order</p>
      </div>
    </div>
  );
}