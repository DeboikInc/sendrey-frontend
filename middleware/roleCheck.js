// middleware/roleCheck.js

// check if user is a runner
const isRunner = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role !== 'runner') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Only runners can perform this action.'
        });
    }

    next();
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin privileges required.'
        });
    }

    next();
};

// Middleware to check if user is either runner or admin
const isRunnerOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (req.user.role !== 'runner' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient privileges.'
        });
    }

    next();
};
// checks the user has a business account and optionally has the right role within it
const requireBusiness = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const User = require('../models/User');
      const user = await User.findById(req.user._id);

      if (user.accountType !== 'business') {
        return res.status(403).json({
          success: false,
          message: 'This feature requires a business account.'
        });
      }

      // no specific roles required — just being a business account is enough
      if (allowedRoles.length === 0) return next();

      const member = user.businessProfile.members.find(
        (m) => m.userId.toString() === req.user._id.toString()
      );

      // the person who converted is always the admin, even if somehow
      // they don't appear in the members array
      const isOwner = user._id.toString() === req.user._id.toString() &&
        user.businessProfile.members[0]?.userId.toString() === req.user._id.toString();

      if (!isOwner && (!member || !allowedRoles.includes(member.role))) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to do this."
        });
      }

      // attach the business user to the request so controllers can use it
      req.businessUser = user;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking business permissions'
      });
    }
  };
};
module.exports = {
    isRunner,
    isAdmin,
    isRunnerOrAdmin,
    requireBusiness 
};