import React, { useState, useEffect, useRef } from "react";
import Message from "../common/Message";
import { FaWalking, FaMotorcycle } from "react-icons/fa";
import { Bike, Car, Truck, } from "lucide-react";


const FLEET_TYPES = [
  { type: "cycling", icon: Bike, label: "Cycling" },
  { type: "car", icon: Car, label: "Car" },
  { type: "van", icon: Truck, label: "Van" },
  { type: "pedestrian", icon: FaWalking, label: "Pedestrian" },
  { type: "bike", icon: FaMotorcycle, label: "Bike" },
];

export default function StartNewOrder({
  runnerData,
  dark,
  onComplete,       // (serviceType, fleetType) => void
  onUpdateProfile,
}) {
  const [step, setStep] = useState('service'); // 'service' | 'fleet' | 'done'
  const [selectedService, setSelectedService] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        from: 'them',
        text: `Welcome back ${runnerData?.firstName || 'there'}! Would you like to run a pickup or run an errand?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
      }
    ]);
  }, [runnerData?.firstName]);

  useEffect(() => {
    if (listRef.current) {
      setTimeout(() => {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 100);
    }
  }, [messages]);

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  const handleServiceSelect = (serviceType) => {
    setSelectedService(serviceType);

    addMessage({
      id: Date.now(),
      from: 'me',
      text: serviceType === 'pick-up' ? 'Pick Up' : 'Run Errand',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    });

    setTimeout(() => {
      addMessage({
        id: Date.now() + 1,
        from: 'them',
        text: 'What fleet type will you be using for this service?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
      });
      setStep('fleet');
    }, 800);
  };

  const handleFleetSelect = async (fleetType) => {
    addMessage({
      id: Date.now(),
      from: 'me',
      text: FLEET_TYPES.find(f => f.type === fleetType)?.label || fleetType,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
    });

    setIsUpdating(true);
    setStep('done');

    try {
      await onUpdateProfile({
        serviceType: selectedService,
        fleetType,
        role: 'runner',
      });

      addMessage({
        id: Date.now() + 1,
        from: 'them',
        text: "You're all set! Hit connect whenever you're ready 🚀",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
      });

      setTimeout(() => {
        onComplete(selectedService, fleetType);
      }, 1200);

    } catch (err) {
      console.error('updateProfile failed:', err);
      addMessage({
        id: Date.now() + 1,
        from: 'them',
        text: 'Something went wrong. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered',
      });
      setStep('fleet');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-chat-pattern bg-gray-100 dark:bg-black-200"
      >
        <div className="mx-auto max-w-3xl">
          {messages.map((m) => (
            <Message
              key={m.id}
              m={m}
              showCursor={false}
              userType="runner"
              disableContextMenu={true}
            />
          ))}
        </div>
      </div>

      <div className="bg-gray-100 dark:bg-black-200 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {step === 'service' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleServiceSelect('pick-up')}
                className="bg-secondary rounded-xl py-3 text-white font-medium"
              >
                Pick Up
              </button>
              <button
                onClick={() => handleServiceSelect('run-errand')}
                className="bg-primary rounded-xl py-3 text-white font-medium"
              >
                Run Errand
              </button>
            </div>
          )}

          {step === 'fleet' && (
            <div className="flex justify-center items-center gap-3">
              {FLEET_TYPES.map((fleet) => {
                const Icon = fleet.icon; 
                return (
                  <button
                    key={fleet.type} 
                    onClick={() => handleFleetSelect(fleet.type)} 
                    disabled={isUpdating}
                    className="bg-white p-3 dark:bg-black-200 border border-gray-300 dark:border-white/10 text-black-200 dark:text-white rounded-xl py-3 font-medium hover:bg-gray-50 dark:hover:bg-black-100 disabled:opacity-50"
                  >
                    <Icon className="text-2xl mx-auto mb-1" /> 
                    <span className="text-xs">{fleet.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 'done' && isUpdating && (
            <div className="flex justify-center py-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Setting things up...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}