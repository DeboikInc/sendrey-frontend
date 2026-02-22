const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Runner = require('../models/Runner');

router.post('/accept', authenticate, async (req, res) => {
  try {
    const { version, userType } = req.body;
    const userId = req.user._id;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const Model = userType === 'runner' ? Runner : User;

    await Model.findByIdAndUpdate(userId, {
      termsAccepted: {
        version,
        acceptedAt: new Date(),
        ipAddress
      }
    });

    res.json({ success: true, message: 'Terms accepted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/check', authenticate, async (req, res) => {
  try {
    const { userType } = req.query;
    const userId = req.user._id;

    const Model = userType === 'runner' ? Runner : User;
    const user = await Model.findById(userId).select('termsAccepted');

    res.json({
      success: true,
      data: {
        hasAccepted: !!user?.termsAccepted?.version,
        version: user?.termsAccepted?.version,
        acceptedAt: user?.termsAccepted?.acceptedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;