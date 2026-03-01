// components/runnerScreens/Sidebar.jsx
import React from 'react';
import { IconButton, Badge } from "@material-tailwind/react";
import { Search, X } from "lucide-react";
import sendreyBot from "../../assets/sendrey_bot.jpg";

const Sidebar = ({ active, setActive, onClose, chatHistory = [], onBotClick, onUserClick }) => {
  const getFirstLetter = (name) => name ? name.charAt(0).toUpperCase() : 'U';

  const getRandomBgColor = (name) => {
    if (!name) return 'bg-green-500';
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500',
      'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500',
      'bg-pink-500', 'bg-rose-500'
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const handleBotClick = () => {
    onBotClick?.();
    setActive({ id: 'sendrey-bot', isBot: true, name: 'Sendrey Assistant' });
    if (onClose) onClose();
  };

  const handleUserClick = (user) => {
    onUserClick?.(user);
    setActive(user);
    if (onClose) onClose();
  };

  return (
    <div className="h-full flex flex-col">
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
            className="bg-transparent outline-none text-sm w-full placeholder:text-gray-500 dark:text-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <h3 className="font-bold px-4 text-md text-black-200 dark:text-gray-300 my-3">
          {chatHistory.length > 0 ? "Recent Chats" : "Pickup or Errand History"}
        </h3>

        {/* Bot Chat - Always visible */}
        <button
          onClick={handleBotClick}
          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-black-200 transition-colors border-t border-b dark:border-white/5 border-gray-200 ${
            active?.id === 'sendrey-bot' ? "dark:bg-black-200 bg-gray-200" : ""
          }`}
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
            <img src={sendreyBot} alt="Sendrey Bot" className="w-full h-full object-cover" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`font-semibold text-sm truncate ${
                active?.id === 'sendrey-bot'
                  ? "dark:text-white text-black-200"
                  : "text-black-200 dark:text-gray-300"
              }`}>
                Sendrey Assistant
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs truncate ${
                active?.id === 'sendrey-bot'
                  ? "text-gray-600 dark:text-gray-400"
                  : "text-gray-600 dark:text-gray-500"
              }`}>
                Chat with assistant
              </span>
            </div>
          </div>
        </button>

        {/* User Chats */}
        {chatHistory.filter(c => !c.isBot).map((c) => (
          <button
            key={c.id}
            onClick={() => handleUserClick(c)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-black-200 transition-colors border-t border-b dark:border-white/5 border-gray-200 ${
              active?.id === c.id ? "dark:bg-black-200 bg-gray-200" : ""
            }`}
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
              {c.avatar ? (
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `
                      <div class="w-full h-full ${getRandomBgColor(c.name)} flex items-center justify-center text-white font-bold text-lg">
                        ${getFirstLetter(c.name)}
                      </div>
                    `;
                  }}
                />
              ) : (
                <div className={`
                  w-full h-full 
                  ${getRandomBgColor(c.name)}
                  flex items-center justify-center text-white font-bold text-lg
                `}>
                  {getFirstLetter(c.name)}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`font-semibold text-sm truncate ${
                  active?.id === c.id
                    ? "dark:text-white text-black-200"
                    : "text-black-200 dark:text-gray-300"
                }`}>
                  {c.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {c.time}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs truncate ${
                  active?.id === c.id
                    ? "text-gray-600 dark:text-gray-400"
                    : "text-gray-600 dark:text-gray-500"
                }`}>
                  {c.lastMessage || "No messages yet"}
                </span>

                {c.unread > 0 && (
                  <Badge
                    content={c.unread}
                    className="bg-primary text-white min-w-[20px] h-5 flex items-center justify-center text-xs flex-shrink-0"
                  />
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;