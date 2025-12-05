import { Button } from "@material-tailwind/react";
import Onboarding from "../common/Onboarding";
import { useEffect, useRef, useState } from "react";
import Message from "../common/Message";

const initialMessages = [
  { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
  {
    id: 2,
    from: "them",
    text: "Would you like to schedule a pickup or run an errand?",
    time: "12:25 PM",
    status: "delivered",
  }
];

export default function ServiceSelectionScreen({ onSelectService, darkMode, toggleDarkMode }) {

  const [messages, setMessages] = useState(initialMessages);
  const listRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const send = (serviceType, displayText) => {
    if (!displayText.trim()) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const newMsg = {
      id: Date.now(),
      from: "me",
      text: displayText.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setMessages((p) => [...p, newMsg]);

    const botResponse = {
      id: Date.now() + 1,
      from: "them",
      text: "In progress...",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "delivered",
    };

    timeoutRef.current = setTimeout(() => {
      setMessages((p) => [...p, botResponse]);

      timeoutRef.current = setTimeout(() => {
        onSelectService(serviceType); // Pass the backend format
      }, 800);
    }, 1200);
  };

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div className="w-full max-w-2xl mx-auto p-4 relative">
        {messages.map((m) => (
          <Message key={m.id} m={m}
          showCursor={false}
          />
        ))}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 absolute bottom-0 p-4 right-0 left-0">
          <Button
            onClick={() => send('pick-up', 'Pick Up')}
            className="bg-secondary rounded-lg sm:text-sm flex items-center gap-3 justify-center"
          >
            <span>Pick Up</span>
          </Button>

          <Button
            onClick={() => send('run-errand', 'Run Errand')}
            className="bg-primary rounded-lg sm:text-sm flex items-center gap-3 justify-center"
          >
            <span>Run Errand</span>
          </Button>
        </div>
      </div>
    </Onboarding>
  );
}