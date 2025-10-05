import React from "react";
import { IconButton } from "@material-tailwind/react";
import { ChevronLeft, Moon, Sun } from "lucide-react";
import Logo from "../../assets/Sendrey-Logo-Variants-09.png"
import { useNavigate } from "react-router-dom";

export default function Header({ title, showBack, darkMode, toggleDarkMode, rightActions, backTo, onBack }) {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) onBack();
      else if (backTo) navigate(backTo); // to previous page
      else navigate(-1);
  }
  return (
    <div className="px-4 py-3 border-b dark:border-white/10 border-gray-200 flex items-center justify-between bg-white/5/10 backdrop-blur-xl">
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <IconButton variant="text" className="rounded-full" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" /> 
          </IconButton>
        )}
        <div className="truncate">
          <div className="font-bold text-[16px] truncate text-gray-800 dark:text-white">
            {title && showBack ? title : <img src={Logo} alt="Logo" width={140} height={140} /> }          
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {rightActions}
        <IconButton variant="text" size="sm" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </IconButton>
      </div>
    </div>
  );
}
