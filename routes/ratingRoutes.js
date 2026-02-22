const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const {authenticate} = require('../middleware/auth');

router.post('/submit', authenticate, ratingController.submitRating);
router.get('/runner/:runnerId', ratingController.getRunnerRatings);
router.get('/can-rate/:orderId', authenticate, ratingController.canRateOrder);

module.exports = router;