import { useEffect, useRef, useState } from "react";
import { Button } from "@material-tailwind/react";
import { User, Navigation } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Message from "../common/Message";
import Onboarding from "../common/Onboarding";


const initialMessages = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text: "Are you looking for errand services or want to become a runner? did",
    time: "12:25 PM",
    status: "delivered",
  }
];

export default function RoleSelectionScreen({ onSelectRole, darkMode, toggleDarkMode }) {
  const [messages, setMessages] = useState(initialMessages);
  const listRef = useRef(null);
  const timeoutRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const send = (type, text) => {
    if (!text.trim()) return;

    // Clear any existing timeout to prevent memory leaks
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const newMsg = {
      id: Date.now(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((p) => [...p, newMsg]);

    // Add the bot response first
    const botResponse = {
      id: Date.now() + 1,
      from: "them",
      text: "In progress...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    // Store timeout reference for cleanup
    timeoutRef.current = setTimeout(() => {
      // First update the messages to show the bot response
      setMessages((p) => [...p, botResponse]);


      timeoutRef.current = setTimeout(() => {
        if (type === 'runner') {
          // Navigate to /raw for runners
          navigate('/raw', { state: { darkMode } });
        } else {
          // Continue with normal flow for users
          onSelectRole(type);
        }
      }, 800); // Short delay to ensure the UI updates
    }, 1200);
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full h-full flex flex-col relative overflow-hidden max-w-2xl mx-auto">

        <div ref={listRef} className="flex-1 overflow-y-auto p-4">
          {messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => send('user', 'I need a runner')}
              className="bg-secondary rounded-lg sm:text-sm flex items-center gap-3 justify-center py-4"
            >
              <User className="h-5 w-5" />
              <span>I need a runner</span>
            </Button>

            <Button
              onClick={() => send('runner', 'I want to be a runner')}
              className="bg-primary rounded-lg sm:text-sm flex items-center gap-3 justify-center py-4"
            >
              <Navigation className="h-5 w-5" />
              <span>I want to be a runner</span>
            </Button>
          </div>
        </div>
      </div>
    </Onboarding>
  );
}