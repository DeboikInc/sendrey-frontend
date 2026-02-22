const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const runnerRoutes = require('./runnerRoutes');
const kycRoutes = require('./kycRoutes');
const adminRoutes = require('./adminRoutes')
const paymentRoutes = require('./paymentRoutes');
const disputeRoutes = require('./disputeRoutes');
const ratingRoutes = require('./ratingRoutes');
const termRoutes = require('./termRoutes');
const payoutRoutes = require('./payoutRoutes');

const waitlistRoutes = require('./waitlistRoutes')

// Use route modules
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/runners', runnerRoutes);
router.use('/kyc', kycRoutes);
router.use('/payments', paymentRoutes);
router.use('/disputes', disputeRoutes);
router.use('/ratings', ratingRoutes);
router.use('/terms', termRoutes);
router.use('/waitlist', waitlistRoutes)
router.use('/payouts', payoutRoutes);

// Export the router
module.exports = router;