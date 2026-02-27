// services/locationTracking/locationStore.js
const redis = require('../../config/redis');

class LocationStore {
  constructor() {
    this.KEY_PREFIX = 'tracking:';
    this.ORDER_INDEX_KEY = 'tracking:active-orders';
    this.EXPIRY_SECONDS = 3600; // 1 hour
  }

  /**
   * Store runner location
   */
  async setLocation(orderId, runnerId, locationData) {
    const key = `${this.KEY_PREFIX}${orderId}`;
    const data = {
      ...locationData,
      runnerId: runnerId.toString(),
      updatedAt: Date.now(),
    };

    const client = await redis.connect();
    
    // Store location
    await client.setex(key, this.EXPIRY_SECONDS, JSON.stringify(data));
    
    // Add to active orders set
    await client.sadd(this.ORDER_INDEX_KEY, orderId);
    
    // Publish for real-time updates (optional)
    await client.publish('location-updates', JSON.stringify({
      orderId,
      ...data
    }));

    return data;
  }

  /**
   * Get runner location
   */
  async getLocation(orderId) {
    const key = `${this.KEY_PREFIX}${orderId}`;
    const client = await redis.connect();
    
    const data = await client.get(key);
    if (!data) return null;
    
    return JSON.parse(data);
  }

  /**
   * Remove location (when tracking stops)
   */
  async removeLocation(orderId) {
    const key = `${this.KEY_PREFIX}${orderId}`;
    const client = await redis.connect();
    
    await client.del(key);
    await client.srem(this.ORDER_INDEX_KEY, orderId);
    
    // Publish stop event
    await client.publish('location-stops', JSON.stringify({ orderId }));
  }

  /**
   * Get all active orders
   */
  async getActiveOrders() {
    const client = await redis.connect();
    const orders = await client.smembers(this.ORDER_INDEX_KEY);
    return orders;
  }

  /**
   * Get multiple locations at once
   */
  async getBulkLocations(orderIds) {
    if (!orderIds.length) return {};
    
    const client = await redis.connect();
    const pipeline = client.pipeline();
    
    orderIds.forEach(orderId => {
      pipeline.get(`${this.KEY_PREFIX}${orderId}`);
    });
    
    const results = await pipeline.exec();
    const locations = {};
    
    results.forEach(([err, data], index) => {
      if (!err && data) {
        locations[orderIds[index]] = JSON.parse(data);
      }
    });
    
    return locations;
  }

  /**
   * Clean up stale locations (should be called periodically)
   */
  async cleanupStaleLocations() {
    const client = await redis.connect();
    const activeOrders = await this.getActiveOrders();
    
    for (const orderId of activeOrders) {
      const key = `${this.KEY_PREFIX}${orderId}`;
      const exists = await client.exists(key);
      
      if (!exists) {
        await client.srem(this.ORDER_INDEX_KEY, orderId);
      }
    }
  }
}

module.exports = new LocationStore();