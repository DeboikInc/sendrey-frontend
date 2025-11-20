import { useEffect, useState } from "react";
import { io } from "socket.io-client";

let socket;

export const useChatSocket = (chatId) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket = io("http://localhost:4000");

    socket.emit("joinChat", chatId);

    socket.on("chatHistory", (history) => {
      setMessages(history);
    });

    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [chatId]);

  const sendMessage = (msg) => {
    socket.emit("sendMessage", { chatId, message: msg });
    setMessages((prev) => [...prev, msg]);
  };

  return { messages, sendMessage };
};
