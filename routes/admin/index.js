const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { isAdmin } = require('../../middleware/roleCheck');

// login
router.use('/auth', require('./authAdminRoutes'));


// all admin routes require auth + admin role
router.use(authenticate, isAdmin);

// ── mount admin sub-routers here 
// full url - "/api/admin/v1" join each router and routes
router.use('/payouts', require('./payoutAdminRoutes'));
router.use('/business', require('./businessAdminRoutes'));
router.use('/users', require('./userAdminRoutes'));
router.use('/runners', require('./runnerAdminRoutes'));
router.use('/kyc', require('./kycAdminRoutes'))
router.use('/disputes', require('./disputeAdminRoutes'));
router.use('/orders', require('./orderAdminRoutes'));
router.use('/escrows', require('./escrowAdminRoutes'));
// router.use('/payments',  require('./paymentAdminRoutes'));


module.exports = router;