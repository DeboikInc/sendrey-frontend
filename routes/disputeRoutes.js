const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');
const {authenticate} = require('../middleware/auth');

router.post('/raise', authenticate, disputeController.raiseDispute);
router.get('/order/:orderId', authenticate, disputeController.getDispute);

router.get('/all', authenticate, disputeController.getAllDisputes); // admin
router.post('/:disputeId/resolve', authenticate, disputeController.resolveDispute); // admin

module.exports = router;