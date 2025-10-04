const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');

// Use route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// Export the router
module.exports = router;