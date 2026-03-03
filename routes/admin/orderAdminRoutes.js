// routes/admin/orderAdminRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/orderController');

router.get('/', orderController.adminGetAllOrders);

module.exports = router;