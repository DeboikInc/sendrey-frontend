const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const runnerRoutes = require('./runnerRoutes');
const kycRoutes = require('./kycRoutes');
const adminRoutes = require('./adminRoutes')

// Use route modules
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/runners', runnerRoutes);
router.use('/kyc', kycRoutes);

// Export the router
module.exports = router;