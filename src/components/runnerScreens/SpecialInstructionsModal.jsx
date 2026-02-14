// components/common/SpecialInstructionsModal.jsx
import React from 'react';
import { X, Music } from 'lucide-react';
import { Button } from '@material-tailwind/react';

export default function SpecialInstructionsModal({ 
  isOpen, 
  onClose, 
  userName,
  instructions, 
  darkMode 
}) {
  if (!isOpen) return null;

  const { text, media = [] } = instructions || {};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`
          w-full max-w-2xl mx-4 rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden
          ${darkMode ? 'bg-black-200 text-white' : 'bg-gray-300 text-gray-900'}
        `}
      >
        {/* Header */}
        <div className={`
          sticky top-0 z-10 flex items-center justify-between p-4 border-b
          ${darkMode ? 'bg-black-200 border-gray-700' : 'bg-gray-300 border-gray-200 text-black-100'}
        `}>
          <div>
            <h2 className="text-xl font-bold">Special Instructions</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-black-100'}`}>
              From {userName}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`
              p-2 rounded-full transition-colors
              ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
            `}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Text Instructions */}
          {text && (
            <div className="mb-6">
              <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-black-100'}`}>
                Instructions
              </h3>
              <p className={`whitespace-pre-wrap ${darkMode ? 'text-gray-200' : 'text-black-100'}`}>
                {text}
              </p>
            </div>
          )}

          {/* Media Attachments */}
          {media && media.length > 0 && (
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-black-100'}`}>
                Attachments ({media.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {media.map((item, idx) => {
                  const getPreviewUrl = () => {
                    if (item.preview && !item.preview.startsWith('blob:')) {
                      return item.preview;
                    }
                    if (item.fileUrl) {
                      return item.fileUrl;
                    }
                    if (item.file) {
                      return URL.createObjectURL(item.file);
                    }
                    return null;
                  };

                  const previewUrl = getPreviewUrl();

                  return (
                    <div key={idx} className="relative">
                      {item.type?.startsWith('image/') && previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={`Attachment ${idx + 1}`}
                          className={`
                            w-full h-32 object-cover rounded-lg cursor-pointer
                            ${darkMode ? 'border-gray-600' : 'border-gray-300'}
                            border-2 hover:border-blue-500 transition-colors
                          `}
                          onClick={() => window.open(previewUrl, '_blank')}
                          onError={(e) => {
                            console.error('Image failed to load:', previewUrl);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : item.type?.startsWith('audio/') ? (
                        <div className={`
                          w-full p-3 rounded-lg
                          ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                        `}>
                          <div className="flex items-center gap-2 mb-2">
                            <Music className="h-4 w-4" />
                            <span className="text-xs font-medium">Voice message</span>
                          </div>
                          <audio 
                            controls 
                            className="w-full h-8"
                            style={{ maxWidth: '100%' }}
                          >
                            <source src={previewUrl} type="audio/webm" />
                            <source src={previewUrl} type="audio/mpeg" />
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      ) : (
                        <div className={`
                          w-full h-32 rounded-lg flex flex-col items-center justify-center
                          ${darkMode ? 'bg-black-100' : 'bg-black-100/70'}
                        `}>
                          <span className="text-2xl mb-1">📎</span>
                          <span className="text-xs truncate max-w-full px-2">
                            {item.name?.split('.').pop() || 'File'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!text && (!media || media.length === 0) && (
            <div className="text-center py-8">
              <p className={darkMode ? 'text-gray-400' : 'text-black-100'}>
                No special instructions provided
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`
          sticky bottom-0 p-4 border-t
          ${darkMode ? 'bg-black-200 border-gray-700' : 'bg-gray-300 border-gray-200'}
        `}>
          <Button
            onClick={onClose}
            className="w-full bg-secondary hover:bg-secondary"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}