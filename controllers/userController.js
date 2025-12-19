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
    this.listUsers = this.listUsers.bind(this);
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res, next) {
    try {
      const user = await userService.getUserById(req.user.id);
      this.success(res, { user: this._sanitizeUser(user) });
    } catch (error) {
      logger.error('Get user profile error:', error);
      next(error);
    }
  }

  /**
   * Get public user profile
   */
  async getPublicProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await userService.getPublicProfile(userId);

      this.success(res, { user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
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

  /**
   * Get all user profiles
   */
  async listUsers(req, res, next) {
    try {
      const filters = req.query;
      const result = await userService.listUsers(filters);

      this.success(res, result);
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

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
        maxDistance: 2000
      });

      console.log('DEBUG IN USERS CONTROLLER');
      console.log('🔍 Nearby users search:');
      console.log('  Query params:', { lat, lng, serviceType, fleetType });
      console.log('  Results:', users.length);

      // Keep debug logs but don't return 404
      if (users.length === 0) {
        const allUsersWithService = await User.find({
          role: 'user',
          serviceType: serviceType
        }).select('firstName lastName serviceType fleetType latitude longitude location');

        console.log('📋 Total users with serviceType:', serviceType, '=', allUsersWithService.length);

        if (allUsersWithService.length > 0) {
          console.log('📋 User details:', allUsersWithService.map(u => ({
            id: u._id,
            name: `${u.firstName} ${u.lastName}`,
            serviceType: u.serviceType,
            fleetType: u.fleetType,
            location: u.location,
            lat: u.latitude,
            lng: u.longitude
          })));
        }
      }

      
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

  /**
   * Get single user by ID
   */
  async getSingleUser(req, res, next) {
    try {
      const { userId } = req.params;
      const result = await userService.getUserById(userId);

      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update notification preferences
   */
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

  /**
   * Update user role (admin only)
   */
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

  /**
   * Update user status
   */
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

  /**
   * Delete user
   */
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

  /**
   * Search users
   */
  async searchUsers(req, res, next) {
    try {
      const filters = req.query;
      const result = await userService.searchUsers(filters);

      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk user actions
   */
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

  /**
   * Export users
   */
  async exportUsers(req, res, next) {
    try {
      const { format, fields, dateFrom, dateTo } = req.body;
      const result = await userService.exportUsers({ format, fields, dateFrom, dateTo });

      // Set appropriate headers for download
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);

      res.send(result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove sensitive data from user object
   */
  _sanitizeUser(user) {
    if (!user) return null;

    const userObj = user.toObject ? user.toObject() : { ...user };

    // Remove sensitive fields
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