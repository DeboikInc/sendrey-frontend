const express = require('express');
const router = express.Router();
const controller = require('../../controllers/businessController');
const { auditLog } = require('../../middleware/auth');

router.get('/', controller.adminGetAll);
router.get('/stats', controller.adminGetStats);

module.exports = router;