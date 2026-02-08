import { Button, IconButton, Tooltip, } from "@material-tailwind/react";
import { Mic, Paperclip, Smile, Square, Plus, MapPin, X, Camera } from "lucide-react";
import { useEffect } from "react";
import InputReplyPreview from "./InputReplyPreview"


export default function CustomInput({
  value,
  onChange,
  send,
  showMic = true,
  placeholder,
  showIcons = true,
  showPlus = false,
  setLocationIcon = false,
  searchIcon,
  onMicClick,
  onAttachClick,
  isRecording = false,
  toggleRecording,
  onLocationClick,
  selectedFiles = [],
  onFilesChange,
  onRemoveFile,
  replyingTo = null,
  onCancelReply,
  darkMode = false,

  showCamera,
  onOpenCamera,
  userName,
}) {
  const HeaderIcon = ({ children, tooltip, onClick }) => (
    <Tooltip content={tooltip} placement="bottom" className="text-xs">
      <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );

  const handleSend = () => {
    // if (!value.trim() ) return;
    // // send("text", value.trim());
    send();
  };



  return (
    <div>

      {selectedFiles && selectedFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap rounded-2xl shadow-lg mx-auto max-w-3xl absolute left-8 right-5 bottom-20">
          {selectedFiles.map((fileData, index) => (
            <div key={index} className="relative group p-3 dark:bg-black-100 bg-white">
              {fileData.type.startsWith('image/') ? (
                <img
                  src={fileData.preview}
                  alt={fileData.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ) : fileData.type.startsWith('video/') ? (
                <video
                  src={fileData.preview}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center p-2">
                  <Paperclip className="h-6 w-6 mb-1" />
                  <p className="text-[10px] text-center truncate w-full px-1">
                    {fileData.name}
                  </p>
                </div>
              )}
              <button
                onClick={() => onRemoveFile(index)}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate">
                {fileData.size < 1024 * 1024
                  ? `${(fileData.size / 1024).toFixed(1)} KB`
                  : `${(fileData.size / (1024 * 1024)).toFixed(1)} MB`}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        {replyingTo && (
          <InputReplyPreview
            message={replyingTo}
            onCancel={onCancelReply}
            darkMode={darkMode}
            userName={userName} 
          />
        )}
      </div>

      <div className="flex mx-auto max-w-3xl items-center gap-3 absolute left-5 right-5 bottom-5 px-9">
        {showPlus && !value && (
          <Button className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
            <Plus className="h-10 w-10 text-white bg-primary rounded-full p-2" />
          </Button>
        )}

        {setLocationIcon && !value && (
          <Button
            onClick={onLocationClick}
            className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
            <MapPin className="h-10 w-10 text-white bg-primary rounded-full p-2" />
          </Button>
        )}
        <div className="flex-1 w-full flex items-center px-3 bg-white dark:bg-black-100 rounded-full h-14 shadow-lg backdrop-blur-lg">

          {showIcons && (
            <HeaderIcon tooltip="Emoji">
              <Smile className="h-6 w-6" />
            </HeaderIcon>
          )}

          <input
            placeholder={placeholder || "Type a message"}
            className="w-full bg-transparent focus:outline-none font-normal text-lg text-black-100 dark:text-gray-100 px-4"
            value={value}
            onChange={onChange}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          {showIcons && (
            <HeaderIcon tooltip="Attach" onClick={onAttachClick}>
              <Paperclip className="h-6 w-6" />
            </HeaderIcon>
          )}

          {searchIcon}
        </div>

        <div className="flex items-center">
          {showMic && !value && selectedFiles?.length === 0 && (
            <IconButton
              variant="text"
              className="rounded-full bg-primary text-white"
              onClick={toggleRecording}
            >
              {isRecording ? (
                <Square className="h-6 w-6 text-red-700" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </IconButton>
          )}

          {showCamera && (
            <Button
              onClick={onOpenCamera}
              className="rounded-lg bg-primary h-12 px-3"
            >
              <Camera size={28} />
            </Button>
          )}

          {(value || (selectedFiles && selectedFiles.length > 0)) && (
            <Button onClick={handleSend} className="rounded-lg bg-primary h-12 px-6 text-md">
              Send
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}
