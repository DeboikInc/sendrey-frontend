import { Button, IconButton, Tooltip, } from "@material-tailwind/react";
import { Mic, Paperclip, Smile, Square, Plus, MapPin } from "lucide-react";
import { useEffect } from "react";

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
  isRecording,
  toggleRecording
}) {
  const HeaderIcon = ({ children, tooltip, onClick }) => (
    <Tooltip content={tooltip} placement="bottom" className="text-xs">
      <IconButton variant="text" size="sm" className="rounded-full" onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );

  const handleSend = () => {
    if (!value.trim()) return;
    send("text", value.trim());
  };

  return (
    <div className="flex mx-auto max-w-3xl items-center gap-3 absolute left-5 right-5 bottom-5 px-2">
      {showPlus && !value && (
        <Button className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
          <Plus className="h-10 w-10 text-white bg-primary rounded-full p-2" />
        </Button>
      )}

      {setLocationIcon && !value && (
        <Button className="p-0 m-0 min-w-0 h-auto bg-transparent shadow-none hover:shadow-none focus:bg-transparent active:bg-transparent">
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
          className="w-full bg-transparent outline-0 font-normal text-lg text-black-100 dark:text-gray-100 px-4"
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
        {showMic && !value && (
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

        {value && (
          <Button onClick={handleSend} className="rounded-full bg-primary">
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
