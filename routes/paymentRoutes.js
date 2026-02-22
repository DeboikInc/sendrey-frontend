const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');
const { authenticate } = require('../middleware/auth');
const { checkTransactionLimits } = require('../middleware/transactionLimits');

router.post('/intent', authenticate, paymentController.createPaymentIntent);
router.post('/verify', authenticate, paymentController.verifyPayment);
router.post('/wallet/fund', authenticate, paymentController.fundWallet);
router.post('/wallet/virtual-account', authenticate, paymentController.createVirtualAccount);
router.post('/wallet/withdraw', authenticate, paymentController.withdrawFromWallet);
router.post('/wallet/verify-account', authenticate, paymentController.verifyAccount);
router.post('/webhook', paymentController.handleWebhook);


router.get('/wallet/balance', authenticate, paymentController.getWalletBalance);
router.get('/wallet/transactions', authenticate, paymentController.getTransactionHistory);
router.get('/wallet/banks', authenticate, paymentController.getBanks);


// escrow routes
router.post('/escrow/create', authenticate, paymentController.createTaskEscrow); // Create & lock escrow when funding task
router.post('/escrow/:escrowId/release', authenticate, paymentController.releaseEscrow); // Release funds to runner
router.post('/escrow/timeouts', paymentController.checkEscrowTimeouts); // Cron job to check for escrow timeouts and auto-release if needed
router.post('/escrow/:escrowId/release-items', authenticate, paymentController.releaseItemBudget);

module.exports = router;
