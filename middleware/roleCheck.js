// middleware/roleCheck.js
const User = require('../models/User');

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
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const user = await User.findById(req.user._id).select('accountType businessProfile');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      if (user.accountType !== 'business') {
        return res.status(403).json({ success: false, message: 'This feature requires a business account.' });
      }

      // no role restriction — just needs to be a business account
      if (allowedRoles.length === 0) {
        req.businessUser = user;
        return next();
      }

      // the account owner (the one who converted) is always treated as admin
      // they ARE the business account, not just a member of it
      const isOwner = user._id.toString() === req.user._id.toString() &&
        user.businessProfile?.members?.[0]?.userId?.toString() === req.user._id.toString();

      if (isOwner) {
        req.businessUser = user;
        return next();
      }

      // for actual team members, check their assigned role
      const member = user.businessProfile?.members?.find(
        (m) => m.userId.toString() === req.user._id.toString()
      );

      if (!member || !allowedRoles.includes(member.role)) {
        return res.status(403).json({ success: false, message: "You don't have permission to do this." });
      }

      req.businessUser = user;
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error checking business permissions' });
    }
  };
};

module.exports = {
  isRunner,
  isAdmin,
  isRunnerOrAdmin,
  requireBusiness
};