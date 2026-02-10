// controllers/kycController.js
const BaseController = require('./BaseController');
const KYCService = require('../services/kycService');
const Runner = require('../models/Runner');

class KYCController extends BaseController {
    constructor() {
        super(new KYCService());


        this.verifyNIN = this.verifyNIN.bind(this);
        this.verifyDriverLicense = this.verifyDriverLicense.bind(this);
        this.verifySelfie = this.verifySelfie.bind(this);
        this.getVerificationStatus = this.getVerificationStatus.bind(this);
        this.getNextKYCSteps = this.getNextKYCSteps.bind(this);
        this.getPendingKYC = this.getPendingKYC.bind(this);
        this.getRunnerDetails = this.getRunnerDetails.bind(this);
        this.approveDocument = this.approveDocument.bind(this);
        this.rejectDocument = this.rejectDocument.bind(this);
        this.approveSelfie = this.approveSelfie.bind(this);
        this.rejectSelfie = this.rejectSelfie.bind(this);
        this.getVerifiedRunners = this.getVerifiedRunners.bind(this);
    }

    // ==================== RUNNER METHODS ====================

    async verifyNIN(req, res) {
        console.log('=== DEBUG: verifyNIN called ===');
        console.log('Request user:', req.user);
        console.log('Request files:', req.file);
        console.log('Request body:', req.body);

        try {
            const userId = req.user.id || req.user._id;

            console.log('=== NIN Verification Request ===');
            console.log('User ID:', userId);

            const runner = await Runner.findById(userId);
            if (!runner) {
                return this.notFound(res, 'Runner not found');
            }

            if (!req.file) {
                console.log('ERROR: No file uploaded');
                return this.badRequest(res, 'NIN document image is required');
            }

            console.log('File received:', req.file.originalname, req.file.size, 'bytes');

            const userInfo = {
                userId,
                firstName: runner.firstName,
                lastName: runner.lastName,
                dateOfBirth: runner.dateOfBirth || null
            };

            console.log('DEBUG: Calling service.submitNIN with userInfo:', userInfo);

            const result = await this.service.submitNIN(
                null,
                req.file.buffer,
                req.file.originalname,
                userInfo
            );

            console.log('Service result:', result);

            if (result.success) {
                await Runner.findByIdAndUpdate(userId, {
                    'verificationDocuments.nin': {
                        verified: false,
                        status: 'pending_review',
                        submittedAt: new Date(),
                        documentPath: result.data.documentPath,
                        verificationData: result.data
                    },
                    runnerStatus: 'pending_verification'
                });

                console.log('NIN document saved successfully');

                return this.success(res, {
                    status: 'pending_review',
                    submittedAt: result.data.submittedAt
                }, 'NIN submitted for verification. Please wait for admin approval.');
            } else {
                return this.badRequest(res, 'NIN submission failed', { error: result.error });
            }

        } catch (error) {
            console.error('NIN submission error:', error);
            return this.error(res, 'Internal server error');
        }
    }

    async verifyDriverLicense(req, res) {
        console.log('=== DEBUG: verifyDriverLicense called ===');
        console.log('Request user:', req.user);
        console.log('Request files:', req.file);
        console.log('Request body:', req.body);

        try {
            const userId = req.user.id || req.user._id;

            console.log('=== Driver License Verification Request ===');
            console.log('User ID from token:', userId);

            const runner = await Runner.findById(userId);
            console.log('Found runner:', runner ? 'Yes' : 'No');

            if (!runner) {
                return this.notFound(res, 'User not found');
            }

            if (!req.file) {
                return this.badRequest(res, 'Driver license document image is required');
            }

            const userInfo = {
                userId,
                firstName: runner.firstName,
                lastName: runner.lastName,
                dateOfBirth: runner.dateOfBirth || null
            };

            console.log('DEBUG: Calling service.submitDriverLicense');

            const result = await this.service.submitDriverLicense(
                null,
                req.file.buffer,
                req.file.originalname,
                userInfo
            );

            if (result.success) {
                await Runner.findByIdAndUpdate(userId, {
                    'verificationDocuments.driverLicense': {
                        verified: false,
                        status: 'pending_review',
                        submittedAt: new Date(),
                        documentPath: result.data.documentPath,
                        verificationData: result.data
                    },
                    runnerStatus: 'pending_verification'
                });

                console.log('Driver license saved successfully');

                return this.success(res, {
                    status: 'pending_review',
                    submittedAt: result.data.submittedAt
                }, 'Driver license submitted for verification. Please wait for admin approval.');
            } else {
                return this.badRequest(res, 'Driver license submission failed', { error: result.error });
            }

        } catch (error) {
            console.error('Driver license submission error:', error);
            return this.error(res, 'Internal server error');
        }
    }

    async verifySelfie(req, res) {
        try {
            const userId = req.user.id || req.user._id;
            const runner = await Runner.findById(userId);

            if (!runner || runner.role !== 'runner') {
                return this.badRequest(res, 'Only runners can verify selfie');
            }

            if (!req.file) {
                return this.badRequest(res, 'Selfie image is required');
            }

            const docs = runner.verificationDocuments || {};
            const hasSubmittedDoc = docs.nin || docs.driverLicense;

            if (!hasSubmittedDoc) {
                return this.badRequest(res, 'Please submit at least one document (NIN or Driver License) first');
            }

            const result = await this.service.submitSelfie(
                req.file.buffer,
                req.file.originalname,
                userId
            );

            if (result.success) {
                await Runner.findByIdAndUpdate(userId, {
                    'biometricVerification.selfieVerified': false,
                    'biometricVerification.status': 'pending_review',
                    'biometricVerification.selfieImage': result.data.selfiePath,
                    'biometricVerification.submittedAt': new Date()
                });

                console.log('Selfie saved successfully');

                return this.success(res, {
                    status: 'pending_review',
                    submittedAt: result.data.submittedAt
                }, 'Selfie submitted for verification. Please wait for admin approval.');
            } else {
                return this.badRequest(res, 'Selfie submission failed', { error: result.error });
            }

        } catch (error) {
            console.error('Selfie submission error:', error);
            return this.error(res, 'Internal server error');
        }
    }

    async getVerificationStatus(req, res) {
        try {
            const userId = req.user.id || req.user._id;
            const runner = await Runner.findById(userId);

            if (!runner) {
                return this.notFound(res, 'User not found');
            }

            const docs = runner.verificationDocuments || {};
            const biometrics = runner.biometricVerification || {};

            const verificationStatus = {
                runnerStatus: runner.runnerStatus,
                documents: {
                    nin: {
                        verified: docs.nin?.verified || false,
                        status: docs.nin?.status || 'not_submitted',
                        submittedAt: docs.nin?.submittedAt || null
                    },
                    driverLicense: {
                        verified: docs.driverLicense?.verified || false,
                        status: docs.driverLicense?.status || 'not_submitted',
                        submittedAt: docs.driverLicense?.submittedAt || null
                    }
                },
                biometrics: {
                    selfieVerified: biometrics.selfieVerified || false,
                    status: biometrics.status || 'not_submitted',
                    submittedAt: biometrics.submittedAt || null
                },
                canAcceptJobs: runner.runnerStatus === 'approved_full',
                canAcceptLimitedJobs: runner.runnerStatus === 'approved_limited'
            };

            return this.success(res, verificationStatus);

        } catch (error) {
            console.error('Get verification status error:', error);
            return this.error(res, 'Internal server error');
        }
    }

    async getNextKYCSteps(req, res) {
        try {
            const userId = req.user.id || req.user._id;
            const runner = await Runner.findById(userId);

            if (!runner || runner.role !== 'runner') {
                return this.badRequest(res, 'Only runners have KYC steps');
            }

            const docs = runner.verificationDocuments || {};
            const biometrics = runner.biometricVerification || {};

            const verifiedDocs = [];
            if (docs.nin?.verified) verifiedDocs.push('nin');
            if (docs.driverLicense?.verified) verifiedDocs.push('driverLicense');

            const pendingDocs = [];
            if (docs.nin?.status === 'pending_review') pendingDocs.push('nin');
            if (docs.driverLicense?.status === 'pending_review') pendingDocs.push('driverLicense');

            const steps = [];

            if (pendingDocs.length > 0) {
                steps.push({
                    step: 1,
                    action: 'awaiting_review',
                    message: `Your ${pendingDocs.join(', ')} document(s) are under review`,
                    required: true,
                    status: 'pending'
                });
            } else if (verifiedDocs.length === 0) {
                steps.push({
                    step: 1,
                    action: 'submit_document',
                    message: 'Submit at least one government ID (NIN or Driver License)',
                    required: true,
                    status: 'pending'
                });
            } else if (verifiedDocs.length >= 1 && !biometrics.selfieVerified) {
                if (biometrics.status === 'pending_review') {
                    steps.push({
                        step: 2,
                        action: 'awaiting_selfie_review',
                        message: 'Your selfie is under review',
                        required: true,
                        status: 'pending'
                    });
                } else {
                    steps.push({
                        step: 2,
                        action: 'submit_selfie',
                        message: 'Submit selfie for full approval',
                        required: true,
                        status: 'pending'
                    });
                }
            } else if (runner.runnerStatus === 'approved_full') {
                steps.push({
                    step: 3,
                    action: 'complete',
                    message: 'KYC verification complete!',
                    required: false,
                    status: 'completed'
                });
            }

            return this.success(res, {
                currentStatus: runner.runnerStatus,
                steps: steps,
                progress: {
                    documentsVerified: verifiedDocs.length,
                    documentsPending: pendingDocs.length,
                    selfieVerified: biometrics.selfieVerified || false,
                    selfiePending: biometrics.status === 'pending_review',
                    overallProgress: this.calculateProgress(
                        verifiedDocs.length,
                        pendingDocs.length,
                        biometrics.selfieVerified,
                        biometrics.status === 'pending_review'
                    )
                }
            });

        } catch (error) {
            console.error('Get KYC steps error:', error);
            return this.error(res, 'Internal server error');
        }
    }

    // ==================== ADMIN METHODS ====================

    async getPendingKYC(req, res) {
        try {
            const pendingRunners = await this.service.getPendingVerifications();

            return this.success(res, {
                total: pendingRunners.length,
                runners: pendingRunners
            });

        } catch (error) {
            console.error('Error fetching pending KYC:', error);
            return this.error(res, 'Error loading pending verifications');
        }
    }

    async getRunnerDetails(req, res) {
        try {
            const { runnerId } = req.params;

            const runner = await this.service.getRunnerVerificationDetails(runnerId);

            if (!runner) {
                return this.notFound(res, 'Runner not found');
            }

            return this.success(res, runner);

        } catch (error) {
            console.error('Error fetching runner details:', error);
            return this.error(res, 'Error loading runner details');
        }
    }

    async approveDocument(req, res) {
        try {
            const { runnerId } = req.params;
            const { documentType } = req.body;
            const adminId = req.user?.id || req.user?._id || 'admin';

            const result = await this.service.approveDocument(runnerId, documentType, adminId);

            if (result.success) {
                return this.success(res, {
                    runnerStatus: result.runnerStatus
                }, `${documentType} approved successfully`);
            } else {
                return this.badRequest(res, result.error || 'Failed to approve document');
            }

        } catch (error) {
            console.error('Error approving document:', error);
            return this.error(res, 'Error approving document');
        }
    }

    async rejectDocument(req, res) {
        try {
            const { runnerId } = req.params;
            const { documentType, reason } = req.body;

            if (!reason || reason.trim().length === 0) {
                return this.badRequest(res, 'Rejection reason is required');
            }

            const result = await this.service.rejectDocument(runnerId, documentType, reason);

            if (result.success) {
                return this.success(res, {
                    runnerStatus: result.runnerStatus
                }, `${documentType} rejected`);
            } else {
                return this.badRequest(res, result.error || 'Failed to reject document');
            }

        } catch (error) {
            console.error('Error rejecting document:', error);
            return this.error(res, 'Error rejecting document');
        }
    }

    async approveSelfie(req, res) {
        try {
            const { runnerId } = req.params;
            const adminId = req.user?.id || req.user?._id || 'admin';

            const result = await this.service.approveSelfie(runnerId, adminId);

            if (result.success) {
                return this.success(res, {
                    runnerStatus: result.runnerStatus,
                    isVerified: result.isVerified
                }, 'Selfie approved successfully');
            } else {
                return this.badRequest(res, result.error || 'Failed to approve selfie');
            }

        } catch (error) {
            console.error('Error approving selfie:', error);
            return this.error(res, 'Error approving selfie');
        }
    }

    async rejectSelfie(req, res) {
        try {
            const { runnerId } = req.params;
            const { reason } = req.body;

            if (!reason || reason.trim().length === 0) {
                return this.badRequest(res, 'Rejection reason is required');
            }

            const result = await this.service.rejectSelfie(runnerId, reason);

            if (result.success) {
                return this.success(res, {
                    runnerStatus: result.runnerStatus
                }, 'Selfie rejected');
            } else {
                return this.badRequest(res, result.error || 'Failed to reject selfie');
            }

        } catch (error) {
            console.error('Error rejecting selfie:', error);
            return this.error(res, 'Error rejecting selfie');
        }
    }

    async getVerifiedRunners(req, res) {
        try {
            const verifiedRunners = await this.service.getVerifiedRunners();

            return this.success(res, {
                total: verifiedRunners.length,
                runners: verifiedRunners
            });

        } catch (error) {
            console.error('Error fetching verified runners:', error);
            return this.error(res, 'Error loading verified runners');
        }
    }

    // ==================== HELPER METHODS ====================

    calculateProgress(docsVerified, docsPending, selfieVerified, selfiePending) {
        if (selfieVerified) return 100;
        if (selfiePending) return 75;
        if (docsVerified >= 1) return 50;
        if (docsPending > 0) return 25;
        return 0;
    }
}

module.exports = new KYCController();