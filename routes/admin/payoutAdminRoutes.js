const express = require('express');
const router = express.Router();
const payoutController = require('../../controllers/payoutController');

router.get('/receipts',  payoutController.adminGetAllReceipts);
router.get('/stats',  payoutController.adminPayoutStats);
router.patch('/:payoutId/receipt/:receiptId', payoutController.adminReviewReceipt);

module.exports = router;