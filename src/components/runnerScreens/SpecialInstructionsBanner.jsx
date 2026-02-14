import React from 'react';
import { FileText, Paperclip } from 'lucide-react';

export default function SpecialInstructionsBanner({ 
  userName, 
  hasText, 
  mediaCount, 
  onClick,
  darkMode 
}) {
  if (!hasText && mediaCount === 0) return null;

  return (
    <div 
      onClick={onClick}
      className={`
        sticky top-0 z-20 
        ${darkMode ? 'bg-primary border-primary' : 'bg-gray-700'} 
        border-b border-t
        px-4 py-3 
        cursor-pointer 
        hover:bg-opacity-80 
        transition-all
        flex items-center justify-between gap-3
      `}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`
          p-2 rounded-full 
          ${darkMode ? 'bg-black-100' : 'bg-primary'}
        `}>
          <FileText className={`h-5 w-5 ${darkMode ? 'text-gray-100' : 'text-white'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${darkMode ? 'text-gray-100' : 'text-black-100'}`}>
            Special Instructions from {userName}
          </p>
          <p className={`text-xs ${darkMode ? 'text-gray-100' : 'text-black-100'}`}>
            Tap to view details
          </p>
        </div>
      </div>

      {mediaCount > 0 && (
        <div className={`
          flex items-center gap-1 px-2 py-1 rounded-full
          ${darkMode ? 'text-gray-100 bg-black' : 'bg-gray-800 text-black-100'}
          text-xs font-medium
        `}>
          <Paperclip className="h-3 w-3" />
          <span>{mediaCount}</span>
        </div>
      )}
    </div>
  );
}