const activityService = require('../services/activityService');

class ActivityLogger {
  /**
   * Log user login activity
   */
  static async logLogin(user, ip, userAgent, status = 'success') {
    const description = status === 'success'
      ? 'User logged in successfully'
      : 'Failed login attempt';

    return activityService.logActivity({
      userId: user._id,
      action: 'login',
      description,
      ipAddress: ip,
      userAgent,
      severity: status === 'failed' ? 'high' : 'low',
      status
    });
  }

  /**
   * Log user logout activity
   */
  static async logLogout(user, ip, userAgent) {
    return activityService.logActivity({
      userId: user._id,
      action: 'logout',
      description: 'User logged out',
      ipAddress: ip,
      userAgent,
      severity: 'low',
      status: 'success'
    });
  }

  /**
   * Log profile update activity
   */
  static async logProfileUpdate(user, ip, changes) {
    return activityService.logActivity({
      userId: user._id,
      action: 'profile_update',
      description: `Profile updated: ${Object.keys(changes).join(', ')}`,
      ipAddress: ip,
      metadata: { changes },
      severity: 'low',
      status: 'success'
    });
  }

  /**
   * Log password change activity
   */
  static async logPasswordChange(user, ip, status = 'success') {
    const description = status === 'success'
      ? 'Password changed successfully'
      : 'Failed password change attempt';

    return activityService.logActivity({
      userId: user._id,
      action: 'password_change',
      description,
      ipAddress: ip,
      severity: 'high',
      status
    });
  }

  /**
   * Log email verification activity
   */
  static async logEmailVerification(user, ip, status = 'success') {
    const description = status === 'success'
      ? 'Email verified successfully'
      : 'Failed email verification attempt';

    return activityService.logActivity({
      userId: user._id,
      action: 'email_verification',
      description,
      ipAddress: ip,
      severity: status === 'failed' ? 'medium' : 'low',
      status
    });
  }

  /**
   * Log password reset activity
   */
  static async logPasswordReset(user, ip, action, status = 'success') {
    const descriptions = {
      request: status === 'success' ? 'Password reset requested' : 'Failed password reset request',
      success: 'Password reset successfully'
    };

    return activityService.logActivity({
      userId: user._id,
      action: action === 'request' ? 'password_reset_request' : 'password_reset_success',
      description: descriptions[action] || 'Password reset activity',
      ipAddress: ip,
      severity: 'high',
      status
    });
  }
}

module.exports = ActivityLogger;