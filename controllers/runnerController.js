const runnerService = require('../services/runnerService');
const userService = require('../services/userService');
const logger = require('../utils/logger');

class RunnerController {
  /**
   * Success response helper
   */
  success(res, data, statusCode = 200) {
    return res.status(statusCode).json(data);
  }

  /**
   * Error response helper
   */
  error(res, message, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      message
    });
  }

  /**
   * Get nearby runners (within 2km)
   */
  async getNearbyRunners(req, res, next) {
    try {
      const { latitude, longitude, serviceType, fleetType } = req.query;

      if (!latitude || !longitude) {
        return this.error(res, 'Latitude and longitude are required', 400);
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return this.error(res, 'Invalid latitude or longitude', 400);
      }

      if (lat < -90 || lat > 90) {
        return this.error(res, 'Latitude must be between -90 and 90', 400);
      }
      if (lng < -180 || lng > 180) {
        return this.error(res, 'Longitude must be between -180 and 180', 400);
      }

      const validServiceTypes = ['pick-up', 'run-errand'];
      if (serviceType && !validServiceTypes.includes(serviceType)) {
        return this.error(res, `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}`, 400);
      }

      const validFleetTypes = ['cycling', 'bike', 'car', 'van', 'pedestrian'];
      if (fleetType && !validFleetTypes.includes(fleetType)) {
        return this.error(res, `Invalid fleet type. Must be one of: ${validFleetTypes.join(', ')}`, 400);
      }

      const runners = await runnerService.findNearbyRunners({
        latitude: lat,
        longitude: lng,
        serviceType,
        fleetType,
        maxDistance: 2000
      });

      console.log('DEBUG IN RUNNER CONTROLLER');
      console.log('🔍 Nearby runners search:');
      console.log('  Query params:', { lat, lng, serviceType, fleetType });
      console.log('  Results:', runners.length);

      
      if (runners.length === 0) {
        const allRunners = await runnerService.getAllRunners();
        console.log('📋 Total runners in DB:', allRunners.length);

        const onlineRunners = await runnerService.getOnlineRunners(serviceType, fleetType);
        console.log('📋 Online runners matching criteria:', onlineRunners.length);

        if (onlineRunners.length > 0) {
          console.log('📋 Online runner details:', onlineRunners.map(r => ({
            id: r._id,
            name: `${r.firstName} ${r.lastName}`,
            serviceType: r.serviceType,
            fleetType: r.fleetType,
            location: r.location,
            lat: r.latitude,
            lng: r.longitude,
            isOnline: r.isOnline,
            isAvailable: r.isAvailable
          })));
        }
      }

      // Return runners found
      this.success(res, {
        success: true,
        count: runners.length,
        runners,
        message: `Found ${runners.length} nearby runner${runners.length !== 1 ? 's' : ''}`
      });
    } catch (error) {
      logger.error('Error finding nearby runners:', error);
      next(error);
    }
  }

  /**
   * Get all runners
   */
  async getRunners(req, res, next) {
    try {
      const { fleetType, serviceType } = req.query;

      const runners = await runnerService.getAllRunners(serviceType, fleetType);

      this.success(res, {
        success: true,
        count: runners.length,
        runners
      });
    } catch (error) {
      logger.error('Error fetching runners:', error);
      next(error);
    }
  }

  /**
   * Get runners by service type
   */
  async getRunnersByServiceType(req, res, next) {
    try {
      const { serviceType } = req.params;
      const runners = await runnerService.findRunnersByServiceType(serviceType);

      this.success(res, {
        success: true,
        count: runners.length,
        runners
      });
    } catch (error) {
      logger.error('Error fetching runners by service type:', error);
      next(error);
    }
  }

  /**
   * Get online runners
   */
  async getOnlineRunners(req, res, next) {
    try {
      const { serviceType, fleetType } = req.query;

      const runners = await runnerService.getOnlineRunners(serviceType, fleetType);

      this.success(res, {
        success: true,
        count: runners.length,
        runners
      });
    } catch (error) {
      logger.error('Error fetching online runners:', error);
      next(error);
    }
  }

  /**
   * Update runner location
   */
  async updateRunnerLocation(req, res, next) {
    try {
      const { userId, latitude, longitude } = req.body;

      if (!userId || !latitude || !longitude) {
        return this.error(res, 'userId, latitude, and longitude are required', 400);
      }

      const runner = await runnerService.updateRunnerLocation(userId, latitude, longitude);

      this.success(res, {
        success: true,
        message: 'Location updated successfully',
        runner
      });
    } catch (error) {
      logger.error('Error updating runner location:', error);
      next(error);
    }
  }

  /**
   * Set runner online status
   */
  async setRunnerOnlineStatus(req, res, next) {
    try {
      const { userId, isOnline, isAvailable } = req.body;

      if (!userId) {
        return this.error(res, 'userId is required', 400);
      }

      const runner = await runnerService.setRunnerOnlineStatus(userId, isOnline, isAvailable);

      this.success(res, {
        success: true,
        message: 'Status updated successfully',
        runner
      });
    } catch (error) {
      logger.error('Error updating runner status:', error);
      next(error);
    }
  }

  /**
   * Get runner statistics
   */
  async getRunnerStats(req, res, next) {
    try {
      const stats = await runnerService.getRunnerStats();

      this.success(res, {
        success: true,
        stats
      });
    } catch (error) {
      logger.error('Error fetching runner stats:', error);
      next(error);
    }
  }
}

module.exports = new RunnerController();