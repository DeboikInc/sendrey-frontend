import { Button, IconButton, Tooltip } from "@material-tailwind/react";
import { Mic, Paperclip, Smile } from "lucide-react";
import { useEffect } from "react";

export default function CustomInput({ value, onChange, send, setMessages, showMic = false, placeholder, showIcons, searchIcon }) {

  useEffect(() => {
    if (searchIcon && window.google) {
      const input = document.getElementById("location-input");
      const autocomplete = new window.google.maps.places.Autocomplete(input);
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        console.log("Selected place:", place);
        // Save to your state or messages
      });
    }
  }, [searchIcon]);

  const HeaderIcon = ({ children, tooltip }) => (
    <Tooltip content={tooltip} placement="bottom" className="text-xs">
      <IconButton variant="text" size="sm" className="rounded-full">
        {children}
      </IconButton>
    </Tooltip>
  );

  const handleSend = () => {
    if (!value.trim()) return;
    send("text", value); // pass message type and text
    onChange({ target: { value: "" } }); // clear input after sending
  };


  return (
    <div className={`flex mx-auto max-w-3xl items-center ${value && 'gap-3'} absolute left-5 right-5 bottom-5 px-2`}>
      <div className="flex-1 w-full flex items-center px-3 bg-white dark:bg-black-100 rounded-full h-14 shadow-lg backdrop-blur-lg">
        {
          showIcons && <HeaderIcon tooltip="Emoji"><Smile className="h-8 w-8" /></HeaderIcon>
        }
        <input
          id="location-input"
          placeholder={placeholder ? placeholder : "Type a message"}
          className="w-full bg-transparent outline-0 font-normal text-lg text-black-100 dark:text-gray-100 px-5"
          value={value}
          onChange={onChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        {
          showIcons && <HeaderIcon tooltip="Attach"><Paperclip className="h-8 w-8" /></HeaderIcon>
        }
        {searchIcon}
      </div>
      <div className="flex items-center">
        {showMic && !value && <IconButton variant="text" className="rounded-full bg-primary text-white" onClick={() => setMessages(setMessages)}>
          <Mic className="h-7 w-7" />
        </IconButton>}

        {value && <Button onClick={handleSend} className="rounded-full bg-primary">
          Send
        </Button>}
      </div>
    </div>
  )
}