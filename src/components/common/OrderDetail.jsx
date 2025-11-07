import { useState } from "react";

export const OrderDetail = () => {
  return (
    <div className="flex justify-center items-center min-h-screen px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 space-y-6">

        <h1 className="text-blue-900 text-xl font-semibold text-center">
          You have received an order
        </h1>

        <div className="space-y-1">
          <p className="font-medium">Sender's name</p>
          <p className="text-lg text-blue-900 font-semibold">Dayo Afolabi</p>
        </div>

        <div className="space-y-1">
          <p className="font-medium">Pickup / Dropoff</p>
          <p className="text-gray-600">delivery in Delivery-time</p>
        </div>

        <div className="space-y-1">
          <p className="font-medium">Location:</p>
          <div className="rounded-lg border border-gray-200 p-4 text-gray-600">
            location
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-medium">Delivery Location:</p>
          <div className="rounded-lg border border-gray-200 p-4 text-gray-600">
            location
          </div>
        </div>

        <div className="flex gap-4">
          <button className="w-1/2 bg-blue-500 text-white font-medium py-2 rounded-lg hover:bg-blue-600 transition">
            Accept
          </button>

          <button className="w-1/2 border border-gray-400 font-medium py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition">
            Decline
          </button>
        </div>

      </div>
    </div>
  );
};
