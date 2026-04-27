const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const User = require('../models/User');

const testRequests = [
  {
    firstName: 'saminu',
    data: {
      'currentRequest.serviceType': 'pick-up',
      'currentRequest.fleetType': 'bike',
      'currentRequest.status': 'awaiting_runner_connection',
      'currentRequest.pickupLocation': 'Kano Central Market, Kano',
      'currentRequest.pickupCoordinates': { lat: 12.0022, lng: 8.5920 },
      'currentRequest.deliveryLocation': 'Bayero University, Kano',
      'currentRequest.deliveryCoordinates': { lat: 12.0184, lng: 8.5228 },
      'currentRequest.pickupItems': 'Books and stationery',
      'currentRequest.dropoffPhone': '08011111111',
    }
  },
  {
    firstName: 'tinu',
    data: {
      'currentRequest.serviceType': 'run-errand',
      'currentRequest.fleetType': 'bike',
      'currentRequest.status': 'awaiting_runner_connection',
      'currentRequest.marketLocation': 'Balogun Market, Lagos Island',
      'currentRequest.marketCoordinates': { lat: 6.4541, lng: 3.3947 },
      'currentRequest.marketItems': 'Tomatoes, pepper, onions',
      'currentRequest.budget': '5000',
      'currentRequest.budgetFlexibility': 'stay within budget',
      'currentRequest.deliveryLocation': 'Victoria Island, Lagos',
      'currentRequest.deliveryCoordinates': { lat: 6.4281, lng: 3.4219 },
    }
  },
  {
    firstName: 'Samuel',
    data: {
      'currentRequest.serviceType': 'pick-up',
      'currentRequest.fleetType': 'bike',
      'currentRequest.status': 'awaiting_runner_connection',
      'currentRequest.pickupLocation': 'Computer Village, Ikeja',
      'currentRequest.pickupCoordinates': { lat: 6.6018, lng: 3.3515 },
      'currentRequest.deliveryLocation': 'Lekki Phase 1, Lagos',
      'currentRequest.deliveryCoordinates': { lat: 6.4488, lng: 3.4734 },
      'currentRequest.pickupItems': 'Laptop charger',
      'currentRequest.dropoffPhone': '08033333333',
    }
  },
  {
    firstName: 'Gabriel',
    data: {
      'currentRequest.serviceType': 'run-errand',
      'currentRequest.fleetType': 'bike',
      'currentRequest.status': 'awaiting_runner_connection',
      'currentRequest.marketLocation': 'Mile 12 Market, Lagos',
      'currentRequest.marketCoordinates': { lat: 6.6062, lng: 3.3890 },
      'currentRequest.marketItems': 'Yam, plantain, vegetables',
      'currentRequest.budget': '8000',
      'currentRequest.budgetFlexibility': 'can adjust slightly',
      'currentRequest.deliveryLocation': 'Ojota, Lagos',
      'currentRequest.deliveryCoordinates': { lat: 6.5833, lng: 3.3833 },
    }
  },
];

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('Connected');

  for (const req of testRequests) {
    const result = await User.updateOne(
      { firstName: req.firstName },
      { $set: req.data }
    );
    console.log(`Patched ${req.firstName}: matched=${result.matchedCount} modified=${result.modifiedCount}`);
  }

  // Verify
  const users = await User.find({ role: 'user', isActive: true })
    .select('firstName currentRequest.serviceType currentRequest.fleetType currentRequest.status currentRequest.pickupCoordinates currentRequest.marketCoordinates')
    .lean();

  console.log('\nFinal state:');
  users.forEach((u, i) => {
    const coords = u.currentRequest?.serviceType === 'run-errand'
      ? u.currentRequest?.marketCoordinates
      : u.currentRequest?.pickupCoordinates;
    console.log(`  [${i + 1}] ${u.firstName} | ${u.currentRequest?.serviceType} | ${u.currentRequest?.fleetType} | coords: ${JSON.stringify(coords)}`);
  });

  process.exit(0);
})();