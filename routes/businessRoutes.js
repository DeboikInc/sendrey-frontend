// routes/businessRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireBusiness } = require('../middleware/roleCheck');
const {
  convertToBusiness,
  inviteMember,
  removeMember,
  getTeamMembers,
  getReports,
  exportReport,
  createSchedule,
  deleteSchedule,
} = require('../controllers/businessController');

// any logged-in user can convert
router.post('/convert', authenticate, convertToBusiness);

// team — admin only
router.post('/members/invite',          authenticate, requireBusiness(['admin']), inviteMember);
router.delete('/members/:memberId',     authenticate, requireBusiness(['admin']), removeMember);
router.get('/members',                  authenticate, requireBusiness(), getTeamMembers);

// reports — admin and manager
router.get('/reports',                  authenticate, requireBusiness(['admin', 'manager']), getReports);
router.get('/reports/:reportId/export/:format', authenticate, requireBusiness(['admin', 'manager']), exportReport);

// schedules — admin only
router.post('/schedules',              authenticate, requireBusiness(['admin']), createSchedule);
router.delete('/schedules/:scheduleId', authenticate, requireBusiness(['admin']), deleteSchedule);

module.exports = router;