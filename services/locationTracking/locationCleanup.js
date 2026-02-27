// services/locationTracking/locationCleanup.js
const locationStore = require('./locationStore');

class LocationCleanupService {
  constructor() {
    this.interval = null;
  }

  start(intervalMs = 60000) { // Run every minute
    if (this.interval) return;
    
    this.interval = setInterval(async () => {
      try {
        await locationStore.cleanupStaleLocations();
      } catch (error) {
        console.error('Location cleanup error:', error);
      }
    }, intervalMs);
    
    console.log(`Location cleanup started (interval: ${intervalMs}ms)`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Location cleanup stopped');
    }
  }
}

module.exports = new LocationCleanupService();