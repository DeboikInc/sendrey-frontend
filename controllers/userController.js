// controllers/userController.js
const BaseController = require('./baseController');
const userService = require('../services/userService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');
const User = require('../models/User');

class UserController extends BaseController {
  constructor() {
    super(userService);
    this.smsService = smsService;
    this.emailService = emailService;

    // Bind all methods
    this.getProfile = this.getProfile.bind(this);
    this.getPublicProfile = this.getPublicProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.listUsers = this.listUsers.bind(this);
    this.getNearbyUsers = this.getNearbyUsers.bind(this);
    this.getSingleUser = this.getSingleUser.bind(this);
    this.updateNotificationPreferences = this.updateNotificationPreferences.bind(this);
    this.updateUserRole = this.updateUserRole.bind(this);
    this.updateUserStatus = this.updateUserStatus.bind(this);
    this.saveLocation = this.saveLocation.bind(this);
    this.getMyLocations = this.getMyLocations.bind(this);
    this.deleteLocation = this.deleteLocation.bind(this);
    this.deleteUser = this.deleteUser.bind(this);
    this.searchUsers = this.searchUsers.bind(this);
    this.bulkUserAction = this.bulkUserAction.bind(this);
    this.exportUsers = this.exportUsers.bind(this);
    this._sanitizeUser = this._sanitizeUser.bind(this);
  }

  // Get current user profile
  async getProfile(req, res, next) {
    
    try {
      const user = await userService.getUserById(req.user.id);
      this.success(res, { user: this._sanitizeUser(user) });
    } catch (error) {
      logger.error('Get user profile error:', error);
      next(error);
    }
  }

  // Get public user profile
  async getPublicProfile(req, res, next) {
    
    try {
      const { userId } = req.params;
      const user = await userService.getPublicProfile(userId);
      this.success(res, { user });
    } catch (error) {
      next(error);
    }
  }

  // Update user profile
  async updateProfile(req, res, next) {
     
    try {
      const userId = req.params.userId || req.user.id;
      const updateData = req.body;

      const user = await userService.updateUser(userId, updateData);
      if (!user) {
        return this.error(res, 'User not found', 404);
      }

      logger.info(`Profile updated for user: ${user.email || user.phone || userId}`);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: this._sanitizeUser(user)
        }
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  // Get all user profiles
  async listUsers(req, res, next) {
    
    try {
      const filters = req.query;
      const result = await userService.listUsers(filters);

      if (this && typeof this.success === 'function') {
        return this.success(res, result);
      }
      return res.status(200).json(result);
    } catch (error) {
      logger.error('List users error:', error);
      if (typeof next === 'function') {
        return next(error);
      }
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get nearby users (for runners to find customers)
  async getNearbyUsers(req, res, next) {
    
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

      const users = await userService.findNearbyUsers({
        latitude: lat,
        longitude: lng,
        serviceType,
        fleetType,
        maxDistance: 50000
      });

      console.log('DEBUG IN USERS CONTROLLER');
      console.log('Users Results:', users.length);
      console.log('Nearby users search:');
      console.log('  Query params:', { lat, lng, serviceType, fleetType });

      this.success(res, {
        success: true,
        count: users.length,
        users,
        message: `Found ${users.length} nearby user${users.length !== 1 ? 's' : ''}`
      });
    } catch (error) {
      logger.error('Error finding nearby users:', error);
      next(error);
    }
  }

  // Get single user by ID
  async getSingleUser(req, res, next) {
    
    try {
      const { userId } = req.params;
      const result = await userService.getUserById(userId);
      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(req, res, next) {
    
    try {
      const userId = req.user.id;
      const preferences = req.body;

      const user = await userService.updateNotificationPreferences(userId, preferences);
      logger.info(`Notification preferences updated for user: ${user.email}`);

      this.success(res, {
        preferences: user.notificationPreferences,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Update user role (admin only)
  async updateUserRole(req, res, next) {
    try {
      
      const { userId } = req.params;
      const { role } = req.body;

      const user = await userService.updateUserRole(userId, role);
      logger.info(`User role updated: ${user.email} -> ${role}`);

      this.success(res, {
        user: this._sanitizeUser(user),
        message: 'User role updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Update user status
  async updateUserStatus(req, res, next) {
   
    try {
      const { userId } = req.params;
      const { isActive, reason, isAvailable, isOnline } = req.body;

      const statusUpdates = {};
      if (isActive !== undefined) statusUpdates.isActive = isActive;
      if (isAvailable !== undefined) statusUpdates.isAvailable = isAvailable;
      if (isOnline !== undefined) statusUpdates.isOnline = isOnline;

      const user = await userService.updateUserStatus(userId, statusUpdates, reason);
      logger.info(`User status updated: ${user.email} -> ${isActive ? 'active' : 'inactive'}, available: ${isAvailable}, online: ${isOnline}`);

      this.success(res, {
        user: this._sanitizeUser(user),
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  // Save user location
  async saveLocation(req, res, next) {
    try {
      const locations = await userService.addSavedLocation(req.user.id, req.body);
      this.success(res, {
        message: 'Location saved successfully',
        locations
      });
    } catch (error) {
      logger.error('Save location error:', error);
      next(error);
    }
  }

  // Get user locations
  async getMyLocations(req, res, next) {
    try {
      const locations = await userService.getSavedLocations(req.user.id);
      this.success(res, { locations });
    } catch (error) {
      logger.error('Get locations error:', error);
      next(error);
    }
  }

  // Delete location
  async deleteLocation(req, res, next) {
    try {
      const { locationId } = req.params;
      const locations = await userService.removeSavedLocation(req.user.id, locationId);
      this.success(res, {
        message: 'Location removed successfully',
        locations
      });
    } catch (error) {
      logger.error('Delete location error:', error);
      next(error);
    }
  }

  // Delete user
  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;
      await userService.deleteUser(userId);
      logger.info(`User deleted: ${userId}`);
      this.success(res, { message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Search users
  async searchUsers(req, res, next) {
    
    try {
      const filters = req.query;
      const result = await userService.searchUsers(filters);
      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Bulk user actions
  async bulkUserAction(req, res, next) {
    
    try {
      const { userIds, action, role } = req.body;
      const result = await userService.bulkUserAction(userIds, action, role);
      logger.info(`Bulk user action performed: ${action} on ${userIds.length} users`);
      this.success(res, {
        ...result,
        message: `Bulk action completed successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  // Export users
  async exportUsers(req, res, next) {
    
    try {
      const { format, fields, dateFrom, dateTo } = req.body;
      const result = await userService.exportUsers({ format, fields, dateFrom, dateTo });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
      res.send(result.data);
    } catch (error) {
      next(error);
    }
  }

  // Remove sensitive data from user object
  _sanitizeUser(user) {
    if (!user) return null;

    const userObj = user.toObject ? user.toObject() : { ...user };

    const sensitiveFields = [
      'password', '__v',
      'verificationToken', 'verificationExpires',
      'resetPasswordToken', 'resetPasswordExpires',
      'phoneVerificationOTP', 'phoneVerificationExpires'
    ];

    sensitiveFields.forEach(field => delete userObj[field]);
    return userObj;
  }
}

module.exports = new UserController();