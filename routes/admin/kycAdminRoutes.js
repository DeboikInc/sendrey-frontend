
const router = require('express').Router();
const express = require('express');
const kycController = require('../../controllers/kycController');

// Get all pending KYC verifications
router.get('/pending',
    kycController.getPendingKYC
);

// Get specific runner's verification details
router.get('/runner/:runnerId',
    kycController.getRunnerDetails
);

// Approve document
router.post('/approve-document/:runnerId',

    kycController.approveDocument
);

// Reject document
router.post('/reject-document/:runnerId',
    kycController.rejectDocument
);

// Approve selfie
router.post('/approve-selfie/:runnerId',

    kycController.approveSelfie
);

// Reject selfie
router.post('/reject-selfie/:runnerId',
    kycController.rejectSelfie
);

router.get('/verified-runners',
    kycController.getVerifiedRunners
);

module.exports = router;