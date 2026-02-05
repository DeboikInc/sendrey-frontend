// routes/kyc.routes.js
const router = require('express').Router();
const kycController = require('../controllers/kycController');
const { authenticate } = require('../middleware/auth');
const { isRunner, isAdmin } = require('../middleware/roleCheck');
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

// ADMIN ROUTES

// Get all pending KYC verifications
router.get('/admin/pending',
    authenticate,
    isAdmin,
    kycController.getPendingKYC
);

// Get specific runner's verification details
router.get('/admin/runner/:runnerId',
    authenticate,
    isAdmin,
    kycController.getRunnerDetails
);

// Approve document
router.post('/admin/approve-document/:runnerId',
    authenticate,
    isAdmin,
    kycController.approveDocument
);

// Reject document
router.post('/admin/reject-document/:runnerId',
    authenticate,
    isAdmin,
    kycController.rejectDocument
);

// Approve selfie
router.post('/admin/approve-selfie/:runnerId',
    authenticate,
    isAdmin,
    kycController.approveSelfie
);

// Reject selfie
router.post('/admin/reject-selfie/:runnerId',
    authenticate,
    isAdmin,
    kycController.rejectSelfie
);

router.get('/admin/verified-runners',
    authenticate,
    isAdmin,
     kycController.getVerifiedRunners
);

module.exports = router;