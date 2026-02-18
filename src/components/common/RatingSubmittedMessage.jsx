import React from 'react';
import { Star } from 'lucide-react';

export default function RatingSubmittedMessage({ message, darkMode }) {
  const { ratingDetails } = message;

  return (
    <div className="flex justify-center my-2">
      <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
        darkMode ? 'bg-black-200' : 'bg-gray-1001'
      }`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < ratingDetails?.score
                ? 'fill-yellow-400 text-yellow-400'
                : darkMode ? 'text-gray-1002' : 'text-gray-300'
            }`}
          />
        ))}
        <span className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
          User rated this delivery
        </span>
      </div>
    </div>
  );
}