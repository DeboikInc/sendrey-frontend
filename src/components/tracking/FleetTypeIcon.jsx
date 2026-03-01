// components/tracking/FleetTypeIcon.jsx
import React from 'react';
import { Bike, Car, Truck,  } from "lucide-react";
import { FaWalking as Footprints, FaMotorcycle as Motorcycle } from "react-icons/fa";

// Map fleetType strings to Lucide icons
const FLEET_TYPE_ICON_MAP = {
  pedestrian: Footprints,
  cycling: Bike,
  bike: Motorcycle,
  car: Car,
  van: Truck,
};

// Default fallback
const DEFAULT_ICON = Car;

export const FleetTypeIcon = ({ 
  fleetType = 'car', 
  heading = 0, 
  darkMode = false,
  size = 40,
}) => {
  const IconComponent = FLEET_TYPE_ICON_MAP[fleetType?.toLowerCase()] || DEFAULT_ICON;
  
  const iconColor = darkMode ? '#E5E7EB' : '#4B5563'; // gray-200 : gray-600
  const glowColor = darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'; // eslint-disable-line no-unused-vars

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{
        transform: `rotate(${heading}deg)`,
        transition: 'transform 0.2s ease-out',
        width: size,
        height: size,
      }}
    >
      <IconComponent 
        size={size}
        color={iconColor}
        strokeWidth={1.5}
        className="drop-shadow-lg"
      />
      
      {/* Direction indicator (small dot at front) */}
      <div 
        className="absolute w-1.5 h-1.5 rounded-full bg-primary"
        style={{
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  );
};

// For Google Maps AdvancedMarkerElement
export const createVehicleElement = (fleetType, heading, darkMode, size = 20) => {
  const container = document.createElement('div');
  container.className = 'vehicle-marker';
  container.style.transform = `rotate(${heading}deg)`;
  container.style.transition = 'transform 0.2s ease-out';
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';

  // This will be rendered by React DOM, but for marker we need static HTML
  // We'll use the component approach with createHtmlMarker instead
  
  return container;
};