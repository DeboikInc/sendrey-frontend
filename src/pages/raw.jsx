import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Avatar,
  IconButton,
  Button,
  Input,
  Switch,
  Badge,
  Tooltip,
  Chip,
  Drawer,
  Card,
  CardBody,
  Radio,
  Rating,
} from "@material-tailwind/react";
import {
  Search,
  MoreVertical,
  Phone,
  Video,
  Paperclip,
  Smile,
  Mic,
  Send,
  Ellipsis,
  ChevronLeft,
  Menu,
  Plus,
  Camera,
  Check,
  CheckCheck,
  MoreHorizontal,
  X,
  StarHalf,
  StarHalfIcon,
  Star,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useDarkMode from "../hooks/useDarkMode";

// --- Mock Data ---
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
  { id: 1, from: "them", text: "Hi there, How are you?", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text:
      "Waiting for your reply. As I have to go back soon. I have to travel long distance.",
    time: "12:25 PM",
    status: "delivered",
  },
  {
    id: 3,
    from: "me",
    text:
      "Hi, I am coming there in few minutes. Please wait!! I am in taxi right now.",
    time: "12:28 PM",
    status: "read",
  },
  {
    id: 4,
    from: "them",
    text: "Thank you very much, I am waiting here at StarBuck cafe.",
    time: "12:35 PM",
    status: "sent",
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
  const [deliveryMethods, setDeliveryMethods] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const [more, setMore] = useState(false);

  const pickUp = () => {
    setText('Pick Up')
    send()
  }

  const runErrand = () => {
    setText('Run Errand');
    send();
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


  const send = () => {
    if (!text.trim()) return;
    const newMsg = {
      id: Date.now(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages((p) => [...p, newMsg]);
    setText("");
    // Fake reply
    setTimeout(() => {
      setMessages((p) => [
        ...p,
        {
          id: Date.now() + 1,
          from: "them",
          text: "Got it! See you soon.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "delivered",
        },
      ]);
    }, 1200);
  };

  const handleClickMore = () => {
    // setMore(true)
    alert("view available errands")
  }

  const AppShell = useMemo(
    () => (
      <div className={` bg-white dark:bg-black-100`}>
        <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
          {/* Top Bar (mobile) */}
          <div className="lg:hidden flex items-center justify-between px-3 py-3 border-b dark:border-white/10 border-gray-200">
            <div className="flex items-center gap-2">
              <IconButton variant="text" className="rounded-full" onClick={() => setDrawerOpen(true)}>
                <Menu className="h-5 w-5" />
              </IconButton>
            </div>
            <div
              onClick={() => setDark(!dark)}
              className="cursor-pointer flex items-center gap-2 p-2 rounded-full bg-gray-200 dark:bg-gray-800"
            >
              {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-900" strokeWidth={3.0} />}
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
                  <Avatar src={active.avatar} alt={active.name} size="sm" />
                  <div className="truncate">
                    <div className={`font-bold text-[16px] truncate dark:text-white text-black-200`}>{active.name}</div>
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
                  <span onClick={() => handleClickMore()}
                   className="bg-gray-1000 dark:bg-black-200 rounded-full w-10 h-10 flex items-center justify-center">
                    <HeaderIcon tooltip="More"><MoreHorizontal className="h-6 w-6" /></HeaderIcon>
                  </span> 
                  <div className="hidden lg:block pl-2">
                    {/* <Switch checked={dark} onChange={() => setDark(!dark)} className="scale-90" /> */}
                    <div
                      onClick={() => setDark(!dark)}
                      className="cursor-pointer flex items-center gap-2 p-2 rounded-full bg-gray-200 dark:bg-gray-800"
                    >
                      {dark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
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
                <div className="flex gap-5 p-4">
                  <Button onClick={pickUp} className="bg-secondary rounded-lg w-full h-14 sm:text-lg">Pick Up</Button>
                  <Button onClick={runErrand} className="bg-primary rounded-lg w-full sm:text-lg">Run Errand</Button>
                </div>

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
              <ContactInfo contact={active} />
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
            <ContactInfo contact={active} onClose={() => setInfoOpen(false)} />
          </Drawer>
        </div>
      </div>
    ),
    [dark, active, messages, drawerOpen, infoOpen, text,]
  );

  return AppShell;
}

function SidebarContent({ active, setActive, onClose }) {
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

function ContactInfo({ contact, onClose }) {
  const [dark, setDark] = useDarkMode();

  return (
    <div className="h-screen flex flex-col overflow-y-auto">
      <div className="px-4 py-5 border-b dark:border-white/10 border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-sm text-black-200 dark:text-gray-300">Status</h3>
        {onClose ? (
          <IconButton variant="text" size="sm" className="rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
        ) : null}
      </div>

        {/* radio status btn */}
      {/* <div className="flex flex-col py-3 p-2">
        <div className="flex items-center justify-between">
          <Radio name="type" label="Online" defaultChecked />
          <div className="rounded-full bg-green-500 w-5 h-5" />
        </div>
        <div className="flex items-center justify-between">
          <Radio name="type" label="Offline" />
          <div className="rounded-full bg-red-500 w-5 h-5" />
        </div>
      </div> */}

      <div className="flex px-6 py-4 justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex">
          {contact.offline ? "Online" : "Offline"}
        </p>
        <div className={`rounded-full w-4 h-4 ${contact.offline ? "bg-green-500" : "bg-red-500"}`} />
      </div>


      {/* initial place of status bar light/darkmode */}
      {/* <div className="sm:hidden flex justify-start px-6 py-3"> */}
      {/* <Switch checked={dark} onChange={() => setDark(!dark)} className="scale-90" /> */}
      {/* <div
          onClick={() => setDark(!dark)}
          className="cursor-pointer flex items-center gap-2 p-2 rounded-full bg-gray-200 dark:bg-gray-800"
        >
          {dark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-900" strokeWidth={3.0} />}
        </div> */}
      {/* </div> */}

      <div className="px-4 py-3 text-sm border-t border-b dark:border-white/10 border-gray-200">
        <h3 className="font-bold text-sm text-black-200 dark:text-gray-300">Statistics</h3>

        <div className="flex text-black dark:text-gray-300 justify-center items-center py-5 gap-10">
          <div className="flex flex-col items-center">
            <h3 className="text-secondary dark:text-gray-300 text-2xl font-bold">24</h3>
            <div className="text-gray-700">Total Runs</div>
          </div>

          <div className="px-4 py-3 border-l-2 dark:border-white/10 border-gray-200">
            <div className="flex">
              <Rating value={Math.round(4.2)} readonly />
            </div>

            <div className="flex items-center gap-2">
              <h3 className="text-secondary dark:text-gray-300 text-2xl font-bold">4.2</h3>
              <p>Total Ratings</p>
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="flex-1 flex flex-col overflow-y-auto px-6 py-4 space-y-3">
        <div className="text-gray-400 text-sm">Media, links and docs</div>
        <div className="grid grid-cols-4 gap-2">
          {contact.media?.map((src, i) => (
            <motion.img
              key={i}
              src={src}
              alt="media"
              className="h-20 w-full object-cover rounded-xl"
              whileHover={{ scale: 1.03 }}
            />
          ))}
        </div>

        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Mute notifications</span>
            <Switch className="scale-90" />
          </div>
          <div className="text-gray-400 text-sm">Disappearing messages</div>
          <div className="text-gray-200">Off</div>
        </div>
      </div>

      <div className="sm:hidden px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-black-100">
        <Button
          variant="text"
          className="justify-start text-red-400 w-full text-md"
        // onClick={() => console.log("Logout clicked")}
        >
          LogOut
        </Button>
      </div>

      <div className="hidden sm:block px-6 py-4 pt-6">
        <Button variant="text" className="justify-start text-red-400 w-full text-md">
          LogOut
        </Button>
      </div>


    </div>
  );
}

