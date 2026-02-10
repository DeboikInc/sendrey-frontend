const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Runner = require('../models/Runner');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Authentication middleware - Verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const userId = decoded.id || decoded.userId || decoded._id;

    //  User collection first
    let user = await User.findById(userId).select('-password');
    let userType = 'user';

    //  try Runner collection
    if (!user) {
      user = await Runner.findById(userId).select('-password');
      userType = 'runner';
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // ✅ Attach userType to req.user
    user.userType = userType;

    req.user = user;
    req.token = token;

    logger.info(`User authenticated: ${user.email || user.phone || user._id} - ${req.method} ${req.path}`);

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token, but attaches user if valid
 */
const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Only proceed if it's an access token
    if (decoded.type && decoded.type !== 'access') {
      return next();
    }

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (user && user.isActive) {
      req.user = user;
      req.token = token;

      if (!user.isVerified && config.auth.requireEmailVerification) {
        // Still attach user but mark as unverified
        req.user.isVerified = false;
      }
    }

    next();
  } catch (error) {
    // Don't throw error for optional auth, just continue without user
    logger.debug('Optional authentication failed:', error.message);
    next();
  }
};

/**
 * Authorization middleware - Check if user has required roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Convert single role to array
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    // If no roles specified, allow any authenticated user
    if (requiredRoles.length === 0) {
      return next();
    }

    // Check if user has required role
    if (!requiredRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt: ${req.user.email} attempted to access ${req.method} ${req.path}. Required roles: ${requiredRoles.join(', ')}, User role: ${req.user.role}`);

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to access this resource'
      });
    }

    logger.debug(`User authorized: ${req.user.email || req.user.phone} - Role: ${req.user.role} - ${req.method} ${req.path}`);

    next();
  };
};

/**
 * Require email verification middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this resource'
    });
  }

  next();
};

/**
 * Require phone verification middleware
 */
const requirePhoneVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isPhoneVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your phone number to access this resource'
    });
  }

  next();
};

/**
 * Check ownership or admin access
 * Use for resources where user can only access their own data unless they're admin
 */
const checkOwnership = (resourceOwnerIdPath = 'params.userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admins can access any resource
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
      return next();
    }

    // Get resource owner ID from specified path
    const paths = resourceOwnerIdPath.split('.');
    let resourceOwnerId = req;

    for (const path of paths) {
      resourceOwnerId = resourceOwnerId[path];
      if (resourceOwnerId === undefined) break;
    }

    // Check if user is the resource owner
    if (resourceOwnerId && resourceOwnerId.toString() === req.user._id.toString()) {
      return next();
    }

    logger.warn(`Ownership violation: ${req.user.email || req.user.phone} attempted to access resource owned by ${resourceOwnerId}`);

    return res.status(403).json({
      success: false,
      message: 'You can only access your own resources'
    });
  };
};

/**
 * Rate limiting by user ID (complementary to express-rate-limit)
 */
const userRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    message = 'Too many requests from this user'
  } = options;

  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId).filter(time => time > windowStart);
      if (requests.length === 0) {
        userRequests.delete(userId);
      } else {
        userRequests.set(userId, requests);
      }
    }

    // Get or create user's request array
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const userTimestamps = userRequests.get(userId);

    // Check if user has exceeded limit
    if (userTimestamps.length >= maxRequests) {
      logger.warn(`User rate limit exceeded: ${req.user.email} - ${userTimestamps.length} requests in ${windowMs}ms`);

      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((userTimestamps[0] + windowMs - now) / 1000)
      });
    }

    // Add current timestamp
    userTimestamps.push(now);

    // Set headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - userTimestamps.length,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });

    next();
  };
};

/**
 * API key authentication middleware
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required'
    });
  }

  // Validate API key (in production, you'd check against database)
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

  if (!validApiKeys.includes(apiKey)) {
    logger.warn(`Invalid API key attempt from IP: ${req.ip}`);

    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  // Attach API key info to request
  req.apiKey = apiKey;
  req.isApiRequest = true;

  logger.info(`API request authenticated with key: ${apiKey.substring(0, 8)}... - ${req.method} ${req.path}`);

  next();
};

/**
 * CORS middleware for authenticated requests
 */
const corsWithAuth = (options = {}) => {
  const {
    allowedOrigins = [],
    credentials = true
  } = options;

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    if (credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  };
};

/**
 * Check if user has specific permission
 * (Extend this based on your permission system)
 */
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Simple permission check - extend based on your needs
    const userPermissions = getPermissionsForRole(req.user.role);

    if (!userPermissions.includes(permission)) {
      logger.warn(`Permission denied: ${req.user.email} attempted action requiring permission: ${permission}`);

      return res.status(403).json({
        success: false,
        message: `Permission denied: ${permission} required`
      });
    }

    next();
  };
};

/**
 * Get permissions for a role (extend this based on your application)
 */
function getPermissionsForRole(role) {
  const permissions = {
    user: [
      'read:own_profile',
      'update:own_profile',
      'read:own_data'
    ],

    runner: [
      'read:own_profile',
      'update:own_profile',
      'read:own_data'
    ],

    sales: [
      'read:own_profile',
      'update:own_profile',
      'read:own_data'
    ],

    manager: [
      'read:own_profile',
      'update:own_profile',
      'read:own_data',
      'read:users',
      'update:users',
      'delete:users'
    ],

    admin: [
      'read:own_profile',
      'update:own_profile',
      'read:own_data',
      'read:users',
      'update:users',
      'create:users',
      'manage:system'
    ],

    'super-admin': [
      'read:own_profile',
      'update:own_profile',
      'read:own_data',
      'read:users',
      'update:users',
      'delete:users',
      'create:users',
      'manage:system'
    ]
  };

  return permissions[role] || permissions.user;
}

/**
 * Audit logging middleware for sensitive operations
 */
const auditLog = (operation) => {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
      // Log after response is sent
      const auditData = {
        timestamp: new Date().toISOString(),
        operation,
        userId: req.user?._id,
        userEmail: req.user?.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        params: req.params,
        query: req.query
        // Don't log body as it may contain sensitive data
      };

      logger.audit('AUDIT_LOG', auditData);

      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticate,
  authenticateOptional,
  authorize,
  requireEmailVerification,
  requirePhoneVerification,
  checkOwnership,
  userRateLimit,
  apiKeyAuth,
  corsWithAuth,
  hasPermission,
  auditLog
};