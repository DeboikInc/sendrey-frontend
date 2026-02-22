module.exports = {
  // Platform fee percentage (of delivery fee)
  PLATFORM_FEE_PERCENTAGE: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '0.57'),
  
  // Delivery fee as percentage of total for run-errand
  DELIVERY_FEE_PERCENTAGE: parseFloat(process.env.DELIVERY_FEE_PERCENTAGE || '0.20'),
  
  // Base delivery fee for pickup tasks (in Naira)
  BASE_DELIVERY_FEE: parseFloat(process.env.BASE_DELIVERY_FEE || '1500'),
  
  // Price per km for distance-based pricing
  PRICE_PER_KM: parseFloat(process.env.PRICE_PER_KM || '100'),
};