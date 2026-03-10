const express = require('express');
const router = express.Router();
const controller = require('../../controllers/businessController');
const { auditLog } = require('../../middleware/auth');

// ── Suggestions 
router.get('/suggestions',
  auditLog('ADMIN_GET_ALL_SUGGESTIONS'),
  controller.adminGetAll);

router.get('/suggestions/stats',
  auditLog('ADMIN_GET_SUGGESTION_STATS'),
  controller.adminGetStats);

router.patch('/suggestions/:userId/reset-opt-out',
  auditLog('ADMIN_RESET_OPT_OUT'),
  controller.adminResetOptOut);

router.post('/suggestions/:userId/force-suggest',
  auditLog('ADMIN_FORCE_SUGGEST'),
  controller.adminForceSuggest);

// ── Business Accounts ─────────────────────────────────────────────────────────
router.get('/accounts',
  auditLog('ADMIN_GET_ALL_BUSINESSES'),
  controller.adminGetAllBusinesses);

router.get('/accounts/:userId',
  auditLog('ADMIN_GET_BUSINESS'),
  controller.adminGetBusiness);

router.patch('/accounts/:userId/convert',
  auditLog('ADMIN_CONVERT_TO_BUSINESS'),
  controller.adminConvertToBusiness);

router.patch('/accounts/:userId/revoke',
  auditLog('ADMIN_REVOKE_BUSINESS'),
  controller.adminRevokeBusiness);

module.exports = router;