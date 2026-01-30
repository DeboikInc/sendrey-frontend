const createError = require('http-errors');

// Middleware factory to check user roles
const roleCheck = (requiredRoles = []) => {
  return (req, res, next) => {
    try {
      // Check if user exists
      if (!req.user) {
        throw createError(401, 'Authentication required');
      }

      // Check if user has any of the required roles
      if (requiredRoles.length > 0) {
        const userRole = req.user.role;
        
        // Check if user has one of the required roles
        const hasRole = requiredRoles.includes(userRole);
        
        if (!hasRole) {
          throw createError(403, `Access denied. Required roles: ${requiredRoles.join(', ')}`);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


const isRunner = roleCheck(['runner']);
const isUser = roleCheck(['user']);
const isAdmin = roleCheck(['admin']);
const isUserOrRunner = roleCheck(['user', 'runner']);
const isAdminOrRunner = roleCheck(['admin', 'runner']);

module.exports = {
  roleCheck,
  isRunner,
  isUser,
  isAdmin,
  isUserOrRunner,
  isAdminOrRunner
};