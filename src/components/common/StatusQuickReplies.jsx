import React from "react";
import { Chip } from "@material-tailwind/react";

const statusMessages = [
  "On the way to shop",
  "Arrived at the shop",
  "Purchase in progress",
  "Send total price",
  "Send invoice",
  "On the way to delivery",
  "Arrived at delivery",
];

export default function StatusQuickReplies({ onSelect }) {
  return (
    <div className="flex overflow-x-auto justify-center gap-2 pb-2 px-4 bg-gray-100 dark:bg-black-200">
      {statusMessages.map(status => (
        <Chip
          key={status}
          value={status}
          className="cursor-pointer whitespace-nowrap"
          onClick={() => onSelect(status)}
        />
      ))}
    </div>
  );
}
