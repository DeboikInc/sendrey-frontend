export const DELIVERY_FEE_PER_KM_BIKE = 500; // 500 Naira per km for bike deliveries
export const DELIVERY_FEE_PER_KM_OTHER = 700; // 700 Naira per km for other fleet types (e.g., car, van)

export const PLATFORM_FEE_PERCENTAGE = 0.57;
export const RUNNER_SHARE = 1 - PLATFORM_FEE_PERCENTAGE;

export const haversineDistance = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6_371_000;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const calculateDeliveryFee = (distanceInMeters, fleetType) => {
  const ratePerKm = fleetType === 'bike' ? DELIVERY_FEE_PER_KM_BIKE : DELIVERY_FEE_PER_KM_OTHER;
  return Math.round(ratePerKm * (distanceInMeters / 1000));
};

export const calculateRouteDistance = (serviceType, midCoords, deliveryCoords) => {
  if (!midCoords) return { distanceInMeters: 0, legs: {}, error: `${serviceType === 'run-errand' ? 'Market' : 'Pick-up'} coordinates unavailable` };
  if (!deliveryCoords) return { distanceInMeters: 0, legs: {}, error: 'Delivery location unavailable' };

  const RUNNER_DEFAULT_METERS = 1000;
  const leg1 = RUNNER_DEFAULT_METERS;
  const leg2 = haversineDistance(midCoords, deliveryCoords);

  return {
    distanceInMeters: leg1 + leg2,
    legs: { runnerToMid: Math.round(leg1), midToDelivery: Math.round(leg2) },
    error: null,
  };
};

export const computeDeliveryFee = (serviceType, midCoords, deliveryCoords, fleetType) => {
  const { distanceInMeters, legs, error } = calculateRouteDistance(
    serviceType, midCoords, deliveryCoords
  );

  if (error) return { distanceInMeters: 0, deliveryFee: 0, legs, error };

  return {
    distanceInMeters: Math.round(distanceInMeters),
    deliveryFee: calculateDeliveryFee(distanceInMeters, fleetType),
    legs,
    error: null,
  };
};

export const formatNaira = (amount) =>
  `₦${Math.round(amount).toLocaleString('en-NG')}`;