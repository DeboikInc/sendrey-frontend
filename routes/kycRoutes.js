// routes/kyc.routes.js
const router = require('express').Router();
const kycController = require('../controllers/kycController');
const { authenticate } = require('../middleware/auth');
const { isRunner } = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

// Document verification with file upload
router.post('/verify/nin',
    authenticate,
    isRunner,
    upload.single('document'),
    kycController.verifyNIN
);

router.post('/verify/driver-license',
    authenticate,
    isRunner,
    upload.single('document'),
    kycController.verifyDriverLicense
);

// Selfie verification with file upload
router.post('/verify/selfie',
    authenticate,
    isRunner,
    upload.single('selfie'),
    kycController.verifySelfie
);

// Status and progress
router.get('/status',
    authenticate,
    kycController.getVerificationStatus
);

router.get('/next-steps',
    authenticate,
    isRunner,
    kycController.getNextKYCSteps
);

module.exports = router;