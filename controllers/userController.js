const BaseController = require('./baseController');
const userService = require('../services/userService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');

class UserController extends BaseController {
  constructor() {
    super(userService);
    this.smsService = smsService
    this.emailService = emailService
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
      const userId = req.user.id;
      const updateData = req.body;

      const user = await userService.updateUser(userId, updateData);
      logger.info(`Profile updated for user: ${user.email}`);

      this.success(res, {
        user: this._sanitizeUser(user),
        message: 'Profile updated successfully'
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  /**
   * Get all user profile
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

  async getSingleUser(req, res, next) {
    try {
      const { userId } = req.params;
      const result = await userService.getUserById(user, userId);

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

  async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { isActive, reason } = req.body;

      const user = await userService.updateUserStatus(userId, isActive, reason);
      logger.info(`User status updated: ${user.email} -> ${isActive ? 'active' : 'inactive'}`);

      this.success(res, {
        user: this._sanitizeUser(user),
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

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

  async searchUsers(req, res, next) {
    try {
      const filters = req.query;
      const result = await userService.searchUsers(filters);

      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

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