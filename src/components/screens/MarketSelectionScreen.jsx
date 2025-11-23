import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@material-tailwind/react";
import { Search, MapPin, X, } from "lucide-react";

import Message from "../common/Message";
import Onboarding from "../common/Onboarding";
import CustomInput from "../common/CustomInput";

const markets = [];

export default function MarketSelectionScreen({ service, onSelectMarket, darkMode, toggleDarkMode }) {
  const initialMessages = [
    { id: 1, from: "them", text: "Welcome!", time: "12:24 PM", status: "read" },
    {
      id: 2,
      from: "them",
      text: "Would you like to schedule a pickup or run an errand?",
      time: "12:25 PM",
      status: "delivered",
    },
    {
      id: 3,
      from: "me",
      text: service.service,
      time: "12:25 PM",
      status: "send",
    },
    {
      id: 4,
      from: "them",
      text: service?.service?.toLowerCase() === "run errand"
        ? "Which market would you like us to go to?"
        : "Which location do you want to pickup?",
      time: "12:25 PM",
      status: "delivered",
    },
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [showMap, setShowMap] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [findOnMap, setFindOnMap] = useState(true);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const listRef = useRef(null);
  const timeoutRef = useRef(null);
  const [showCustomInput, setShowCustomInput] = useState(true);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const initializeMap = () => {
      if (!mapRef.current) return;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            createMap(userLocation, 14);
          },
          () => {
            createMap({ lat: 6.5244, lng: 3.3792 }, 12);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
        );
      } else {
        createMap({ lat: 6.5244, lng: 3.3792 }, 12);
      }
    };

    if (showMap && window.google) {
      initializeMap();
    }
  }, [showMap]);

  const createMap = (center, zoom) => {
    const map = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: zoom,
    });

    mapInstanceRef.current = map;

    map.addListener("click", (e) => {
      const clickedLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: clickedLocation }, (results, status) => {
        if (status === "OK" && results[0]) {
          const place = {
            lat: clickedLocation.lat,
            lng: clickedLocation.lng,
            address: results[0].formatted_address,
            name: results[0].formatted_address,
          };
          setSelectedPlace(place);
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new window.google.maps.Marker({
            position: clickedLocation,
            map: map,
            title: "Selected Location",
          });
        } else {
          const place = {
            lat: clickedLocation.lat,
            lng: clickedLocation.lng,
            address: `Location (${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)})`,
            name: `Location (${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)})`,
          };
          setSelectedPlace(place);
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new window.google.maps.Marker({
            position: clickedLocation,
            map: map,
            title: "Selected Location",
          });
        }
      });
    });

    const input = document.getElementById("map-search");
    const searchBox = new window.google.maps.places.SearchBox(input);
    map.addListener("bounds_changed", () => {
      searchBox.setBounds(map.getBounds());
    });

    searchBox.addListener("places_changed", () => {
      const places = searchBox.getPlaces();
      if (places.length === 0) return;
      const place = places[0];
      const selectedPlace = {
        name: place.name,
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      setSelectedPlace(selectedPlace);
      map.setCenter(place.geometry.location);
      map.setZoom(16);
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new window.google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: place.name,
      });
    });
  };


  // select map
  const handleMapSelection = () => {
    if (selectedPlace) {
      const locationText = selectedPlace.name || selectedPlace.address || "Selected location";
      send("map", locationText);
      setShowMap(false);
      setSelectedPlace(null);

      if (markerRef.current) markerRef.current.setMap(null);
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
        if (mapRef.current) mapRef.current.innerHTML = "";
      }
    }
  };



  const send = (type, text) => {
    if (!text || typeof text !== "string") return;
    text = text.trim();
    if (!text) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const newMsg = {
      id: Date.now(),
      from: "me",
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setMessages((p) => [...p, newMsg]);

    setShowCustomInput(false);
    setFindOnMap(false);

    const botResponse = {
      id: Date.now() + 1,
      from: "them",
      text: "In progress...",
      status: "delivered",
    };

    timeoutRef.current = setTimeout(() => {
      setMessages((p) => [...p, botResponse]);

      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.text !== "In progress..."));
        // Navigate to vehicle selection
        onSelectMarket(text); // Pass location, 
      }, 900);
    }, 1200);
  };

  const filteredMarkets = markets.filter((market) =>
    market.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showMap) {
    return (
      <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b">
            <Button variant="text" onClick={() => {
              setShowMap(false);
              setFindOnMap(true);
            }
            } className="flex items-center">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              onClick={handleMapSelection}
              disabled={!selectedPlace}
              className={`${!selectedPlace ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Select Location
            </Button>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="map-search"
                type="text"
                placeholder="Search for a location..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
              />
            </div>
          </div>

          <div ref={mapRef} className="flex-1 w-full" />

          {selectedPlace && (
            <div className="p-4 bg-white dark:bg-gray-800 border-t">
              <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                <p className="font-semibold text-blue-800 dark:text-blue-200">Selected Location:</p>
                <p className="text-blue-600 dark:text-blue-300">
                  {selectedPlace.name || selectedPlace.address}
                </p>
                <p className="text-sm text-blue-500 dark:text-blue-400 mt-1">
                  Coordinates: {selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Onboarding>
    );
  }

  return (
    <Onboarding darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
      <div
        ref={listRef}
        className="w-full max-w-2xl mx-auto p-3 relative overflow-y-scroll marketSelection ">
        <div>
          {messages.map((m) => (
            <p className="mx-auto" key={m.id}>
              <Message m={m} />
            </p>
          ))}
        </div>

        <div className="mb-4 mt-2">
          {showCustomInput && (
            <CustomInput
              countryRestriction="us"
              stateRestriction="ny"
              setMessages={setMessages}
              showIcons={false}
              showMic={false}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search for a ${service?.service?.toLowerCase() === "run errend" ? "location" : "market"
                }...`}
              searchIcon={<Search className="h-4 w-4" />}
              send={(type, text) => send(type, text)}
            />
          )}
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {searchTerm &&
            filteredMarkets.map((market) => (
              <Button
                key={market}
                variant="outlined"
                className="w-full justify-start py-3"
                onClick={() => send(market, market)}
              >
                <MapPin className="h-4 w-4 mr-2" />
                {market}
              </Button>
            ))}

          {findOnMap && (
            <Button
              variant="text"
              className="w-full flex items-center py-3"
              onClick={() => {
                setShowMap(true);
                setFindOnMap(false);
              }}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Find on map
            </Button>
          )}
        </div>
      </div>
    </Onboarding>
  );
}