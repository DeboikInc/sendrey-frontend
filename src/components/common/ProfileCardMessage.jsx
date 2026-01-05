import React from "react";
import { Star } from "lucide-react";

export default function ProfileCardMessage({ runnerInfo, darkMode }) {
  const { firstName, lastName, avatar, rating, bio } = runnerInfo || {};

  return (
    <>
      <div className="flex justify-center my-2">
        <div className={`${darkMode ? "" : "bg-white"} rounded-2xl shadow-lg p-6 max-w-sm w-full`}>
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <img
              src={avatar || "https://via.placeholder.com/128"}
              alt={`${firstName} ${lastName}`}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary mb-4"
            />

            {/* Name */}
            <h3 className={`text-xl font-bold mb-2 ${darkMode ? "text-gray-300" : "text-gray-900"}`}>
              {firstName} {lastName}
            </h3>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${i < Math.floor(rating || 0)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                    }`}
                />
              ))}
              <span className={`ml-2 text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                {rating?.toFixed(1) || "4.0"}
              </span>
            </div>

          </div>
        </div>
      </div>


      {bio && (
        <div>
          <div className="max-w-[60%] mt-[-25px]">
            <div className="dark:bg-black-100 bg-gray-300 p-3 rounded-lg ">
              <p className={`text-start text-sm  ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                {bio}
              </p>
            </div>
          </div>
        </div>
      )}

    </>
  );
}