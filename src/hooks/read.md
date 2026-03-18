

6. Create a call service-video calls.


const handleSearchAction = async () => {
  if (!searchTerm.trim()) return;

  const text = searchTerm.trim();

  // For non-location steps, just send directly
  if (currentStep !== 'market-location' && currentStep !== 'delivery-location') {
    send(text, currentStep === 'market-items' ? 'market-items' : 'market-budget');
    setSearchTerm('');
    return;
  }

  if (!window.google) {
    setSearchError('Maps not ready yet. Please wait a moment and try again.');
    return;
  }

  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode(
    {
      address: text,
      componentRestrictions: { country: 'ng' },
    },
    (results, status) => {
      if (status === 'OK' && results[0]) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        const address = results[0].formatted_address;

        if (currentStep === 'market-location') {
          marketCoordinatesRef.current = { lat, lng };
          setPickupLocation(address);
          pickupLocationRef.current = address;
          send(address, 'market-location');
        } else if (currentStep === 'delivery-location') {
          deliveryCoordinatesRef.current = { lat, lng };
          setDeliveryLocation(address);
          deliveryLocationRef.current = address;
          send(address, 'delivery');
        }

        setSearchTerm('');
        setPredictions([]);
        setSearchError(null);
      } else {
        // Don't send — coordinates are required
        setSearchError('Could not find that location. Try being more specific or use the map/suggestions.');
      }
    }
  );
};