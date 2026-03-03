// routes/businessRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, auditLog } = require('../middleware/auth');
const { requireBusiness } = require('../middleware/roleCheck');
const controller = require('../controllers/businessController');

router.use(authenticate)

router.get(
  '/business-status',
  auditLog('GET_BUSINESS_STATUS'),
  controller.getStatus);

router.post('/dismiss-business',
  auditLog('DISMISS_BUSINESS'),
  controller.dismiss);

router.post(
  '/acknowledge-business',
  auditLog('AKNOWLEDGE_BUSINESS'),
  controller.acknowledge);


module.exports = router;