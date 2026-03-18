import React from "react";
import { IconButton, Tooltip } from "@material-tailwind/react";
import { ChevronLeft, Moon, Sun, MoreHorizontal } from "lucide-react";
import Logo from "../../assets/Sendrey-Logo-Variants-09.png"
import { useNavigate } from "react-router-dom";


const HeaderIcon = ({ children, tooltip, onClick }) => (
  <Tooltip content={tooltip} placement="bottom" className="text-xs">
    <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </IconButton>
  </Tooltip>
);


export default function Header({ showBack, darkMode, toggleDarkMode, rightActions, backTo, onBack, onMore }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
    else navigate(-1);
  }

  return (
    <div className="px-4 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between dark:bg-black-200 bg-white/5/10 backdrop-blur-xl">
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <IconButton variant="text" className="rounded-full p-5" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5 text-gray-800 dark:text-white" />
          </IconButton>
        )}
        <img src={Logo} alt="Logo" width={140} height={140} />
      </div>

      <div className="flex items-center gap-2">
        {onMore && showBack &&
          <HeaderIcon tooltip="More" onClick={onMore}>
            <MoreHorizontal className="h-6 w-6" />
          </HeaderIcon>
        }
        {rightActions}
        <IconButton variant="text" size="sm" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </IconButton>
      </div>
    </div>
  );
}
