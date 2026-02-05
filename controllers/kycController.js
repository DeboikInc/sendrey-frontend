// controllers/kycController.js
const KYCService = require('../services/kycService');
const User = require('../models/User');

class KYCController {
    constructor() {
        this.kycService = null;

        // Bind all methods
        this.verifyNIN = this.verifyNIN.bind(this);
        this.verifyDriverLicense = this.verifyDriverLicense.bind(this);
        this.verifySelfie = this.verifySelfie.bind(this);
        this.getService = this.getService.bind(this);
        this.getVerificationStatus = this.getVerificationStatus.bind(this);
        this.getNextKYCSteps = this.getNextKYCSteps.bind(this);
        this.calculateRunnerStatus = this.calculateRunnerStatus.bind(this);
        this.calculateProgress = this.calculateProgress.bind(this);

        // Admin methods
        this.getPendingKYC = this.getPendingKYC.bind(this);
        this.getRunnerDetails = this.getRunnerDetails.bind(this);
        this.approveDocument = this.approveDocument.bind(this);
        this.rejectDocument = this.rejectDocument.bind(this);
        this.approveSelfie = this.approveSelfie.bind(this);
        this.rejectSelfie = this.rejectSelfie.bind(this);
        this.getVerifiedRunners = this.getVerifiedRunners.bind(this);
    }

    getService() {
        if (!this.kycService) {
            this.kycService = new KYCService();
        }
        return this.kycService;
    }

    // ==================== RUNNER METHODS ====================

    async verifyNIN(req, res) {
        try {
            const userId = req.user.id;
            const service = this.getService();

            console.log('=== NIN Verification Request ===');
            console.log('User ID:', userId);

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (!req.file) {
                console.log('ERROR: No file uploaded');
                return res.status(400).json({
                    success: false,
                    message: 'NIN document image is required'
                });
            }

            console.log('File received:', req.file.originalname, req.file.size, 'bytes');

            const userInfo = {
                userId,
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: user.dateOfBirth || null
            };

            const result = await service.submitNIN(
                null,
                req.file.buffer,
                req.file.originalname,
                userInfo
            );

            console.log('Service result:', result);

            if (result.success) {
                await User.findByIdAndUpdate(userId, {
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

                return res.status(200).json({
                    success: true,
                    message: 'NIN submitted for verification. Please wait for admin approval.',
                    data: {
                        status: 'pending_review',
                        submittedAt: result.data.submittedAt
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'NIN submission failed',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('NIN submission error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async verifyDriverLicense(req, res) {
        try {
            const userId = req.user.id;
            const service = this.getService();

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Driver license document image is required'
                });
            }

            const userInfo = {
                userId,
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: user.dateOfBirth || null
            };

            const result = await service.submitDriverLicense(
                null,
                req.file.buffer,
                req.file.originalname,
                userInfo
            );

            if (result.success) {
                await User.findByIdAndUpdate(userId, {
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

                return res.status(200).json({
                    success: true,
                    message: 'Driver license submitted for verification. Please wait for admin approval.',
                    data: {
                        status: 'pending_review',
                        submittedAt: result.data.submittedAt
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Driver license submission failed',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Driver license submission error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async verifySelfie(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);
            const service = this.getService();

            if (!user || user.role !== 'runner') {
                return res.status(400).json({
                    success: false,
                    message: 'Only runners can verify selfie'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Selfie image is required'
                });
            }

            const docs = user.verificationDocuments || {};
            const hasSubmittedDoc = docs.nin || docs.driverLicense;

            if (!hasSubmittedDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Please submit at least one document (NIN or Driver License) first'
                });
            }

            const result = await service.submitSelfie(
                req.file.buffer,
                req.file.originalname,
                userId
            );

            if (result.success) {
                await User.findByIdAndUpdate(userId, {
                    'biometricVerification.selfieVerified': false,
                    'biometricVerification.status': 'pending_review',
                    'biometricVerification.selfieImage': result.data.selfiePath,
                    'biometricVerification.submittedAt': new Date()
                });

                console.log('Selfie saved successfully');

                return res.status(200).json({
                    success: true,
                    message: 'Selfie submitted for verification. Please wait for admin approval.',
                    data: {
                        status: 'pending_review',
                        submittedAt: result.data.submittedAt
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Selfie submission failed',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Selfie submission error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getVerificationStatus(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const docs = user.verificationDocuments || {};
            const biometrics = user.biometricVerification || {};

            const verificationStatus = {
                runnerStatus: user.runnerStatus,
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
                canAcceptJobs: user.runnerStatus === 'approved_full',
                canAcceptLimitedJobs: user.runnerStatus === 'approved_limited'
            };

            return res.status(200).json({
                success: true,
                data: verificationStatus
            });

        } catch (error) {
            console.error('Get verification status error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getNextKYCSteps(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user || user.role !== 'runner') {
                return res.status(400).json({
                    success: false,
                    message: 'Only runners have KYC steps'
                });
            }

            const docs = user.verificationDocuments || {};
            const biometrics = user.biometricVerification || {};

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
            } else if (user.runnerStatus === 'approved_full') {
                steps.push({
                    step: 3,
                    action: 'complete',
                    message: 'KYC verification complete!',
                    required: false,
                    status: 'completed'
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    currentStatus: user.runnerStatus,
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
                }
            });

        } catch (error) {
            console.error('Get KYC steps error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // ==================== ADMIN METHODS ====================

    async getPendingKYC(req, res) {
        try {
            const service = this.getService();
            const pendingRunners = await service.getPendingVerifications();

            return res.status(200).json({
                success: true,
                data: {
                    total: pendingRunners.length,
                    runners: pendingRunners
                }
            });

        } catch (error) {
            console.error('Error fetching pending KYC:', error);
            return res.status(500).json({
                success: false,
                message: 'Error loading pending verifications'
            });
        }
    }

    async getRunnerDetails(req, res) {
        try {
            const { runnerId } = req.params;
            const service = this.getService();

            const runner = await service.getRunnerVerificationDetails(runnerId);

            if (!runner) {
                return res.status(404).json({
                    success: false,
                    message: 'Runner not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: runner
            });

        } catch (error) {
            console.error('Error fetching runner details:', error);
            return res.status(500).json({
                success: false,
                message: 'Error loading runner details'
            });
        }
    }

    async approveDocument(req, res) {
        try {
            const { runnerId } = req.params;
            const { documentType } = req.body;
            const adminId = req.user?.id || 'admin';

            const service = this.getService();
            const result = await service.approveDocument(runnerId, documentType, adminId);

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: `${documentType} approved successfully`,
                    data: {
                        runnerStatus: result.runnerStatus
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to approve document'
                });
            }

        } catch (error) {
            console.error('Error approving document:', error);
            return res.status(500).json({
                success: false,
                message: 'Error approving document'
            });
        }
    }

    async rejectDocument(req, res) {
        try {
            const { runnerId } = req.params;
            const { documentType, reason } = req.body;

            if (!reason || reason.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Rejection reason is required'
                });
            }

            const service = this.getService();
            const result = await service.rejectDocument(runnerId, documentType, reason);

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: `${documentType} rejected`,
                    data: {
                        runnerStatus: result.runnerStatus
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to reject document'
                });
            }

        } catch (error) {
            console.error('Error rejecting document:', error);
            return res.status(500).json({
                success: false,
                message: 'Error rejecting document'
            });
        }
    }

    async approveSelfie(req, res) {
        try {
            const { runnerId } = req.params;
            const adminId = req.user?.id || 'admin';

            const service = this.getService();
            const result = await service.approveSelfie(runnerId, adminId);

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Selfie approved successfully',
                    data: {
                        runnerStatus: result.runnerStatus,
                        isVerified: result.isVerified
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to approve selfie'
                });
            }

        } catch (error) {
            console.error('Error approving selfie:', error);
            return res.status(500).json({
                success: false,
                message: 'Error approving selfie'
            });
        }
    }

    async rejectSelfie(req, res) {
        try {
            const { runnerId } = req.params;
            const { reason } = req.body;

            if (!reason || reason.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Rejection reason is required'
                });
            }

            const service = this.getService();
            const result = await service.rejectSelfie(runnerId, reason);

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Selfie rejected',
                    data: {
                        runnerStatus: result.runnerStatus
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Failed to reject selfie'
                });
            }

        } catch (error) {
            console.error('Error rejecting selfie:', error);
            return res.status(500).json({
                success: false,
                message: 'Error rejecting selfie'
            });
        }
    }

    // ==================== HELPER METHODS ====================

    async calculateRunnerStatus(userId) {
        const user = await User.findById(userId);

        if (!user || user.role !== 'runner') {
            return 'pending_verification';
        }

        const docs = user.verificationDocuments || {};
        const biometrics = user.biometricVerification || {};

        const verifiedDocs = [];
        if (docs.nin?.verified) verifiedDocs.push('nin');
        if (docs.driverLicense?.verified) verifiedDocs.push('driverLicense');

        const pendingDocs = [];
        if (docs.nin?.status === 'pending_review') pendingDocs.push('nin');
        if (docs.driverLicense?.status === 'pending_review') pendingDocs.push('driverLicense');

        if (pendingDocs.length > 0 || biometrics.status === 'pending_review') {
            return 'pending_verification';
        }

        if (verifiedDocs.length === 0) {
            return 'pending_verification';
        } else if (verifiedDocs.length >= 1 && biometrics.selfieVerified) {
            return 'approved_full';
        } else if (verifiedDocs.length >= 1) {
            return 'approved_limited';
        } else {
            return 'pending_verification';
        }
    }

    calculateProgress(docsVerified, docsPending, selfieVerified, selfiePending) {
        if (selfieVerified) return 100;
        if (selfiePending) return 75;
        if (docsVerified >= 1) return 50;
        if (docsPending > 0) return 25;
        return 0;
    }

    async getVerifiedRunners(req, res) {
        try {
            const service = this.getService();
            const verifiedRunners = await service.getVerifiedRunners();

            return res.status(200).json({
                success: true,
                data: {
                    total: verifiedRunners.length,
                    runners: verifiedRunners
                }
            });

        } catch (error) {
            console.error('Error fetching verified runners:', error);
            return res.status(500).json({
                success: false,
                message: 'Error loading verified runners'
            });
        }
    }
}

module.exports = new KYCController();