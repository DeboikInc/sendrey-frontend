import React from 'react';
import { FileText } from 'lucide-react';

export default function SpecialInstructionsBanner({
  userName,
  hasText,
  mediaCount,
  onClick,
  darkMode,
  media = []
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

      {media.length > 0 && (
        <div className="flex items-center gap-1">
          {media.slice(0, 3).map((item, i) => (
            item.fileType?.startsWith('image/') || item.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
              <img
                key={i}
                src={item.fileUrl}
                alt=""
                className="w-10 h-10 rounded-lg object-cover border-2 border-white/20"
              />
            ) : (
              // <div key={i} className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 border-white/20 ${darkMode ? 'bg-black-100' : 'bg-gray-600'}`}>
              <div>
                {/* <FileText className="w-5 h-5 text-white" /> */}
              </div>
            )
          ))}
          {media.length > 3 && (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white ${darkMode ? 'bg-black-100' : 'bg-gray-600'}`}>
              +{media.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}