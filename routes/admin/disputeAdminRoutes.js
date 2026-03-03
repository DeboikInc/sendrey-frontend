// routes/admin/disputeAdminRoutes.js
const express = require('express');
const router = express.Router();
const disputeController = require('../../controllers/disputeController');

router.get('/',                       disputeController.getAllDisputes);
router.get('/:orderId',               disputeController.getDispute);
router.patch('/:disputeId/resolve',   disputeController.resolveDispute);

module.exports = router;