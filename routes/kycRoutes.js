// routes/kyc.routes.js
const router = require('express').Router();
const kycController = require('../controllers/kycController');
const { authenticate, auditLog  } = require('../middleware/auth');
const { isRunner } = require('../middleware/roleCheck');
const upload = require('../middleware/upload');


// Document verification with file upload
router.post('/verify/nin',
    authenticate,
    isRunner,
    auditLog('VERIFY_NIN'),
    upload.single('document'),
    kycController.verifyNIN
);

router.post('/verify/driver-license',
    authenticate,
    isRunner,
    auditLog('VERIFY_DRIVERS_LICENSE'),
    upload.single('document'),
    kycController.verifyDriverLicense
);

// Selfie verification with file upload
router.post('/verify/selfie',
    authenticate,
    isRunner,
    auditLog('VERIFY_SELFIE'),
    upload.single('selfie'),
    kycController.verifySelfie
);

// Status and progress
router.get('/status',
    authenticate,
    auditLog('VERIFICATION_STATUS'),
    kycController.getVerificationStatus
);

router.get('/next-steps',
    authenticate,
    isRunner,
    auditLog('KYC_NEXT_STEPS'),
    kycController.getNextKYCSteps
);

module.exports = router;