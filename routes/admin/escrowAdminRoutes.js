const express = require('express');
const router = express.Router();
const escrowAdminController = require('../../controllers/escrowAdminController');


router.get('/cancelled', escrowAdminController.getCancelledEscrows);


router.get('/:escrowId', escrowAdminController.getEscrowDetails);
router.post('/:escrowId/refund', escrowAdminController.refundToWallet);

module.exports = router;