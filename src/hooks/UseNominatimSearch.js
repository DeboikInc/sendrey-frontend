import { useState, useRef } from 'react';

export const useNominatimSearch = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);

  const searchPlaces = async (input, searchOptions = {}) => {
    if (!input || input.trim().length < 2) {
      setPredictions([]);
      return;
    }

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        q: input,
        format: 'json',
        addressdetails: '1',
        limit: '10',
        countrycodes: searchOptions.countryCode || 'ng', // Nigeria
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      // Transform Nominatim results to match expected format
      const transformedResults = data.map((place) => ({
        place_id: place.place_id,
        structured_formatting: {
          main_text: place.name || place.display_name.split(',')[0],
          secondary_text: place.display_name.split(',').slice(1).join(',').trim(),
        },
        description: place.display_name,
        types: [place.type, place.class],
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon),
      }));

      setPredictions(transformedResults);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Nominatim search error:', error);
        setPredictions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getPlaceDetails = async (prediction) => {
    // For Nominatim, we already have the details from search
    return Promise.resolve({
      name: prediction.structured_formatting.main_text,
      formatted_address: prediction.description,
      geometry: {
        location: {
          lat: () => prediction.lat,
          lng: () => prediction.lon,
        },
      },
      place_id: prediction.place_id,
      types: prediction.types,
    });
  };

  return {
    predictions,
    loading,
    searchPlaces,
    getPlaceDetails,
  };
};