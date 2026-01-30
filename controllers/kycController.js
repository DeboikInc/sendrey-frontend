// controllers/kyc.controller.js
const KYCService = require('../services/kycService');
const User = require('../models/User');

class KYCController {
    constructor() {
        this.kycService = new KYCService();
    }

    // Verify NIN - Only image needed
    async verifyNIN(req, res) {
        try {
            const userId = req.user.id;

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
                    message: 'NIN document image is required'
                });
            }

            const userInfo = {
                userId,
                firstName: user.firstName,
                lastName: user.lastName,
                dateOfBirth: user.dateOfBirth || null
            };

            const result = await this.kycService.submitNIN(
                null, // No NIN number needed
                req.file.buffer,
                req.file.originalname,
                userInfo
            );

            if (result.success) {
                const runnerProfile = user.runnerProfile || {};
                const verificationDocuments = runnerProfile.verificationDocuments || {};

                verificationDocuments.nin = {
                    verified: false,
                    status: 'pending_review',
                    submittedAt: new Date(),
                    documentPath: result.data.documentPath,
                    verificationData: result.data
                };

                await User.findByIdAndUpdate(userId, {
                    runnerProfile: {
                        ...runnerProfile,
                        verificationDocuments
                    },
                    runnerStatus: 'pending_verification'
                });

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

    // Verify Driver's License - Only image needed
    async verifyDriverLicense(req, res) {
        try {
            const userId = req.user.id;

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

            const result = await this.kycService.submitDriverLicense(
                null, // No license number needed
                req.file.buffer,
                req.file.originalname,
                userInfo
            );

            if (result.success) {
                const runnerProfile = user.runnerProfile || {};
                const verificationDocuments = runnerProfile.verificationDocuments || {};

                verificationDocuments.driverLicense = {
                    verified: false,
                    status: 'pending_review',
                    submittedAt: new Date(),
                    documentPath: result.data.documentPath,
                    verificationData: result.data
                };

                await User.findByIdAndUpdate(userId, {
                    runnerProfile: {
                        ...runnerProfile,
                        verificationDocuments
                    },
                    runnerStatus: 'pending_verification'
                });

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

    // Verify Selfie - Only image needed
    async verifySelfie(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

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

            const runnerProfile = user.runnerProfile || {};
            const docs = runnerProfile.verificationDocuments || {};
            const hasSubmittedDoc = docs.nin || docs.driverLicense;

            if (!hasSubmittedDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Please submit at least one document (NIN or Driver License) first'
                });
            }

            const result = await this.kycService.submitSelfie(
                req.file.buffer,
                req.file.originalname,
                userId
            );

            if (result.success) {
                await User.findByIdAndUpdate(userId, {
                    $set: {
                        'runnerProfile.biometricVerification': {
                            selfieVerified: false,
                            status: 'pending_review',
                            selfiePath: result.data.selfiePath,
                            submittedAt: new Date()
                        }
                    }
                });

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

    // Rest of the methods remain the same...
    async calculateRunnerStatus(userId) {
        const user = await User.findById(userId);

        if (!user || user.role !== 'runner') {
            return 'pending_verification';
        }

        const runnerProfile = user.runnerProfile || {};
        const docs = runnerProfile.verificationDocuments || {};
        const biometrics = runnerProfile.biometricVerification || {};

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

            const runnerProfile = user.runnerProfile || {};
            const docs = runnerProfile.verificationDocuments || {};
            const biometrics = runnerProfile.biometricVerification || {};

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

            const runnerProfile = user.runnerProfile || {};
            const docs = runnerProfile.verificationDocuments || {};
            const biometrics = runnerProfile.biometricVerification || {};

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
                    message: 'Submit at least one government ID (NIN, or Driver License)',
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

    calculateProgress(docsVerified, docsPending, selfieVerified, selfiePending) {
        if (selfieVerified) return 100;
        if (selfiePending) return 75;
        if (docsVerified >= 1) return 50;
        if (docsPending > 0) return 25;
        return 0;
    }
}

module.exports = new KYCController();