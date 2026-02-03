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
    text: "Hi! I'm Sendrey Assistant 👋 ",
    time: "12:25 PM",
    status: "delivered",
  },
  {
    id: 3,
    from: "them",
    text: "Are you looking for errand services, or would you like to become a runner?",
    time: "12:25 PM",
    status: "delivered",
  }
];

export default function RoleSelectionScreen({ onSelectRole, darkMode, toggleDarkMode,}) {
  const [messages, setMessages] = useState([initialMessages[0]]); // Start with first message
  const listRef = useRef(null);
  const navigate = useNavigate();
  const [initialMessagesComplete, setInitialMessagesComplete] = useState(false);

  useEffect(() => {
    const timer2 = setTimeout(() => {
      setMessages([initialMessages[0], initialMessages[1]]);
    }, 500); // 1s for second message

    const timer3 = setTimeout(() => {
      setMessages([initialMessages[0], initialMessages[1], initialMessages[2]]);

      setTimeout(() => {
        setInitialMessagesComplete(true);
      }, 600);
    }, 800); // 1.5s more for third message (total 5.5s)

    return () => {
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = (type, text) => {
    if (!text.trim()) return;

    // Add user's message
    const userMsg = {
      id: Date.now(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((p) => [...p, userMsg]);

    // Add "In progress..." message after short delay
    setTimeout(() => {
      const progressMsg = {
        id: Date.now() + 1,
        from: "them",
        text: "In progress...",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "delivered",
      };

      setMessages((p) => [...p, progressMsg]);

      // Navigate after another delay
      setTimeout(() => {
        if (type === 'runner') {
          navigate('/raw', { state: { darkMode } });
        } else {
          onSelectRole(type);
        }
      }, 1200);
    }, 300);
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full h-full flex flex-col relative overflow-hidden max-w-2xl mx-auto">

        <div ref={listRef} className="flex-1 overflow-y-auto p-4">
          {messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </div>

        {/* Show buttons only after all 3 messages are displayed */}
        {messages.length >= 3 && initialMessagesComplete && (
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
        )}
      </div>
    </Onboarding>
  );
}