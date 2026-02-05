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

module.exports = {
    isRunner,
    isAdmin,
    isRunnerOrAdmin
};