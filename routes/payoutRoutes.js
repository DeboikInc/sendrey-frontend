
const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticate, authorize } = require('../middleware/auth'); // adjust path to your auth middleware

// ─── Runner routes (must be authenticated runner) ─────────────────────────────
router.get('/current', authenticate, payoutController.getRunnerPayout);
router.get('/history', authenticate, payoutController.getPayoutHistory);
router.get('/receipts', authenticate, payoutController.getRunnerReceipts);
router.post('/submit-receipt', authenticate, payoutController.submitReceipt);
router.post('/transfer-to-vendor', authenticate, payoutController.transferToVendor);


module.exports = router;