const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize, auditLog } = require('../middleware/auth');

router.get('/runner/:runnerId',
    authenticate,
    auditLog('RUNNERS_ORDERS'),
    authorize(['runner']),
    orderController.getRunnerOrders);

router.get(
    '/by-chat/:chatId',
    authenticate,
    auditLog('GET_ORDERS_BY_CHAT_ID'),
    orderController.getOrderByChatId);

module.exports = router;