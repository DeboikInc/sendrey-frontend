import React from "react";
import { Star } from "lucide-react";

export default function ProfileCardMessage({ runnerInfo, darkMode }) {
  const { firstName, lastName, avatar, rating, bio } = runnerInfo || {};

  // Same color logic as RunnerChatScreen
  const getRandomBgColor = (name) => {
    if (!name) return 'bg-green-500';
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500',
      'bg-green-500', 'bg-teal-500', 'bg-blue-500',
      'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500'
    ];
    const charCode = name.charCodeAt(0);
    return colors[charCode % colors.length];
  };

  const getFirstLetter = (name) => {
    if (!name) return 'R';
    return name.charAt(0).toUpperCase();
  };

  const isValidAvatar = avatar &&
    !avatar.includes('placeholder.com') &&
    avatar !== 'https://via.placeholder.com/128';

  return (
    <>
      <div className="flex justify-center my-2">
        <div className="p-6 max-w-sm w-full">
          <div className="flex flex-col items-center">

            {/* Avatar */}
            {isValidAvatar ? (
              <img
                src={avatar}
                alt={`${firstName} ${lastName}`}
                className="w-24 h-24 rounded-full object-cover border-4 border-primary mb-4"
              />
            ) : (
              <div className={`
                w-24 h-24 rounded-full border-4 border-primary mb-4
                ${getRandomBgColor(firstName)}
                flex items-center justify-center
              `}>
                <span className="text-white text-3xl font-bold">
                  {getFirstLetter(firstName)}
                </span>
              </div>
            )}

            {/* Name */}
            <h3 className={`text-xl font-bold mb-2 ${
              darkMode ? "text-gray-300" : "text-black-100"
            }`}>
              {firstName} {lastName}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${
                    i < Math.floor(rating || 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
              <span className={`ml-2 text-sm ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}>
                {rating?.toFixed(1) || "New"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {bio && (
        <div>
          <div className="max-w-[60%] mt-[-25px]">
            <div className={`p-3 rounded-lg ${
              darkMode ? 'bg-black-100' : 'bg-gray-300'
            }`}>
              <p className={`text-start text-sm ${
                darkMode ? "text-gray-400" : "text-black-100"
              }`}>
                {bio}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}