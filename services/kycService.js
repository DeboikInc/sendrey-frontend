// services/kycService.js
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');

class KYCService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../uploads/kyc');
        this.ensureUploadDirectory();
    }

    async ensureUploadDirectory() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            await fs.mkdir(path.join(this.uploadDir, 'nin'), { recursive: true });
            await fs.mkdir(path.join(this.uploadDir, 'driver_license'), { recursive: true });
            await fs.mkdir(path.join(this.uploadDir, 'selfie'), { recursive: true });
        } catch (error) {
            console.error('Error creating upload directories:', error);
        }
    }

    async saveDocument(fileBuffer, documentType, userId, originalName) {
        try {
            const ext = path.extname(originalName);
            const filename = `${userId}_${Date.now()}${ext}`;
            const filepath = path.join(this.uploadDir, documentType, filename);

            await fs.writeFile(filepath, fileBuffer);

            return {
                success: true,
                filename,
                filepath,
                relativePath: `/uploads/kyc/${documentType}/${filename}`
            };
        } catch (error) {
            console.error('Error saving document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async submitNIN(nin, fileBuffer, fileName, userInfo = {}) {
        try {
            const saveResult = await this.saveDocument(
                fileBuffer,
                'nin',
                userInfo.userId,
                fileName
            );

            if (!saveResult.success) {
                return {
                    success: false,
                    error: 'Failed to save document',
                    documentType: 'nin'
                };
            }

            return {
                success: true,
                verified: false,
                documentType: 'nin',
                status: 'pending_review',
                data: {
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    dateOfBirth: userInfo.dateOfBirth,
                    documentPath: saveResult.relativePath,
                    submittedAt: new Date()
                }
            };

        } catch (error) {
            console.error('NIN Submission Error:', error);
            return {
                success: false,
                error: error.message || 'NIN submission failed',
                documentType: 'nin'
            };
        }
    }

    async submitDriverLicense(licenseNumber, fileBuffer, fileName, userInfo = {}) {
        try {
            const saveResult = await this.saveDocument(
                fileBuffer,
                'driver_license',
                userInfo.userId,
                fileName
            );

            if (!saveResult.success) {
                return {
                    success: false,
                    error: 'Failed to save document',
                    documentType: 'driver_license'
                };
            }

            return {
                success: true,
                verified: false,
                documentType: 'driver_license',
                status: 'pending_review',
                data: {
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    dateOfBirth: userInfo.dateOfBirth,
                    documentPath: saveResult.relativePath,
                    submittedAt: new Date()
                }
            };

        } catch (error) {
            console.error('Driver License Submission Error:', error);
            return {
                success: false,
                error: error.message || 'Driver license submission failed',
                documentType: 'driver_license'
            };
        }
    }

    async submitSelfie(fileBuffer, fileName, userId) {
        try {
            const saveResult = await this.saveDocument(
                fileBuffer,
                'selfie',
                userId,
                fileName
            );

            if (!saveResult.success) {
                return {
                    success: false,
                    error: 'Failed to save selfie'
                };
            }

            return {
                success: true,
                verified: false,
                status: 'pending_review',
                data: {
                    selfiePath: saveResult.relativePath,
                    submittedAt: new Date()
                }
            };

        } catch (error) {
            console.error('Selfie Submission Error:', error);
            return {
                success: false,
                error: error.message || 'Selfie submission failed'
            };
        }
    }

    async deleteDocument(relativePath) {
        try {
            const fullPath = path.join(__dirname, '..', relativePath);
            await fs.unlink(fullPath);
            return { success: true };
        } catch (error) {
            console.error('Error deleting document:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== ADMIN METHODS ====================

    async getPendingVerifications() {
        try {
            const pendingRunners = await User.find({
                role: 'runner',
                $or: [
                    { 'verificationDocuments.nin.status': 'pending_review' },
                    { 'verificationDocuments.passport.status': 'pending_review' },
                    { 'verificationDocuments.driverLicense.status': 'pending_review' },
                    { 'biometricVerification.status': 'pending_review' }
                ]
            }).select('firstName lastName email phone createdAt verificationDocuments biometricVerification runnerStatus');

            return pendingRunners.map(runner => ({
                id: runner._id,
                firstName: runner.firstName,
                lastName: runner.lastName,
                email: runner.email,
                phone: runner.phone,
                createdAt: runner.createdAt,
                runnerStatus: runner.runnerStatus,
                pendingItems: this.getPendingItems(runner)
            }));

        } catch (error) {
            console.error('Error fetching pending verifications:', error);
            throw error;
        }
    }

    getPendingItems(runner) {
        const pending = [];
        const docs = runner.verificationDocuments || {};
        const bio = runner.biometricVerification || {};

        if (docs.nin?.status === 'pending_review') pending.push('NIN');
        if (docs.driverLicense?.status === 'pending_review') pending.push('Driver License');
        if (docs.passport?.status === 'pending_review') pending.push('Passport');
        if (bio.status === 'pending_review') pending.push('Selfie');

        return pending;
    }

    async getRunnerVerificationDetails(runnerId) {
        try {
            const runner = await User.findById(runnerId);

            if (!runner) {
                return null;
            }

            const docs = runner.verificationDocuments || {};
            const bio = runner.biometricVerification || {};

            return {
                id: runner._id,
                firstName: runner.firstName,
                lastName: runner.lastName,
                email: runner.email,
                phone: runner.phone,
                dateOfBirth: runner.dateOfBirth,
                createdAt: runner.createdAt,
                runnerStatus: runner.runnerStatus,
                isVerified: runner.isVerified,
                documents: {
                    nin: {
                        status: docs.nin?.status || 'not_submitted',
                        verified: docs.nin?.verified || false,
                        submittedAt: docs.nin?.submittedAt,
                        documentPath: docs.nin?.documentPath,
                        verifiedAt: docs.nin?.verifiedAt,
                        verifiedBy: docs.nin?.verifiedBy,
                        rejectedAt: docs.nin?.rejectedAt,
                        rejectionReason: docs.nin?.rejectionReason
                    },
                    driverLicense: {
                        status: docs.driverLicense?.status || 'not_submitted',
                        verified: docs.driverLicense?.verified || false,
                        submittedAt: docs.driverLicense?.submittedAt,
                        documentPath: docs.driverLicense?.documentPath,
                        verifiedAt: docs.driverLicense?.verifiedAt,
                        verifiedBy: docs.driverLicense?.verifiedBy,
                        rejectedAt: docs.driverLicense?.rejectedAt,
                        rejectionReason: docs.driverLicense?.rejectionReason
                    }
                },
                biometrics: {
                    status: bio.status || 'not_submitted',
                    selfieVerified: bio.selfieVerified || false,
                    selfieImage: bio.selfieImage,
                    submittedAt: bio.submittedAt,
                    verifiedAt: bio.verifiedAt,
                    rejectedAt: bio.rejectedAt,
                    rejectionReason: bio.rejectionReason
                }
            };

        } catch (error) {
            console.error('Error fetching runner details:', error);
            throw error;
        }
    }

    async approveDocument(runnerId, documentType, adminId = 'admin') {
        try {
            const validTypes = ['nin', 'driverLicense', 'passport'];
            if (!validTypes.includes(documentType)) {
                return {
                    success: false,
                    error: 'Invalid document type'
                };
            }

            const updateField = `verificationDocuments.${documentType}`;
            await User.findByIdAndUpdate(runnerId, {
                [`${updateField}.verified`]: true,
                [`${updateField}.status`]: 'approved',
                [`${updateField}.verifiedAt`]: new Date(),
                [`${updateField}.verifiedBy`]: adminId
            });

            // Recalculate runner status
            const newStatus = await this.calculateRunnerStatus(runnerId);
            await User.findByIdAndUpdate(runnerId, { runnerStatus: newStatus });

            return {
                success: true,
                runnerStatus: newStatus
            };

        } catch (error) {
            console.error('Error approving document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async rejectDocument(runnerId, documentType, reason) {
        try {
            const validTypes = ['nin', 'driverLicense', 'passport'];
            if (!validTypes.includes(documentType)) {
                return {
                    success: false,
                    error: 'Invalid document type'
                };
            }

            const updateField = `verificationDocuments.${documentType}`;
            await User.findByIdAndUpdate(runnerId, {
                [`${updateField}.verified`]: false,
                [`${updateField}.status`]: 'rejected',
                [`${updateField}.rejectedAt`]: new Date(),
                [`${updateField}.rejectionReason`]: reason,
                runnerStatus: 'banned'
            });

            return {
                success: true,
                runnerStatus: 'banned'
            };

        } catch (error) {
            console.error('Error rejecting document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async approveSelfie(runnerId, adminId = 'admin') {
        try {
            await User.findByIdAndUpdate(runnerId, {
                'biometricVerification.selfieVerified': true,
                'biometricVerification.status': 'approved',
                'biometricVerification.verifiedAt': new Date()
            });

            // Recalculate runner status
            const newStatus = await this.calculateRunnerStatus(runnerId);
            const isVerified = newStatus === 'approved_full';

            await User.findByIdAndUpdate(runnerId, {
                runnerStatus: newStatus,
                isVerified: isVerified
            });

            return {
                success: true,
                runnerStatus: newStatus,
                isVerified: isVerified
            };

        } catch (error) {
            console.error('Error approving selfie:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async rejectSelfie(runnerId, reason) {
        try {
            await User.findByIdAndUpdate(runnerId, {
                'biometricVerification.selfieVerified': false,
                'biometricVerification.status': 'rejected',
                'biometricVerification.rejectedAt': new Date(),
                'biometricVerification.rejectionReason': reason,
                runnerStatus: 'banned'
            });

            return {
                success: true,
                runnerStatus: 'banned'
            };

        } catch (error) {
            console.error('Error rejecting selfie:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async calculateRunnerStatus(userId) {
        try {
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

        } catch (error) {
            console.error('Error calculating runner status:', error);
            return 'pending_verification';
        }
    }

    async getVerifiedRunners() {
        try {
            const verifiedRunners = await User.find({
                role: 'runner',
                runnerStatus: { $in: ['approved_full', 'approved_limited'] }
            }).select('firstName lastName email phone createdAt verificationDocuments biometricVerification runnerStatus');

            return verifiedRunners.map(runner => ({
                id: runner._id,
                firstName: runner.firstName,
                lastName: runner.lastName,
                email: runner.email,
                phone: runner.phone,
                createdAt: runner.createdAt,
                runnerStatus: runner.runnerStatus,
                pendingItems: [] // Verified runners have no pending items
            }));

        } catch (error) {
            console.error('Error fetching verified runners:', error);
            throw error;
        }
    }
}

module.exports = KYCService;