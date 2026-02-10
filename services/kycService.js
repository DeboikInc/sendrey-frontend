// services/kycService.js
const Runner = require('../models/Runner');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const path = require('path');
const fs = require('fs').promises;

class KYCService {

    constructor() {
        
        this.uploadDir = 'uploads';
    }

    async saveDocumentToCloudinary(fileBuffer, documentType, userId, originalName) {
        try {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: `kyc/${documentType}`,
                        public_id: `${userId}_${Date.now()}`,
                        resource_type: 'auto',
                        tags: [documentType, userId, 'kyc']
                    },
                    (error, result) => {
                        if (error) {
                            console.error('Cloudinary upload error:', error);
                            reject(error);
                        } else {
                            resolve({
                                success: true,
                                cloudinaryUrl: result.secure_url,
                                cloudinaryPublicId: result.public_id,
                                filename: originalName,
                                format: result.format,
                                resourceType: result.resource_type
                            });
                        }
                    }
                );

                streamifier.createReadStream(fileBuffer).pipe(uploadStream);
            });
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async saveDocument(fileBuffer, documentType, userId, originalName) {
        try {
            const ext = path.extname(originalName);
            const filename = `${userId}_${Date.now()}${ext}`;
            const filepath = path.join(this.uploadDir, documentType, filename);

            // create dir if it dont exist
            await fs.mkdir(path.dirname(filepath), { recursive: true });
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
            const uploadResult = await this.saveDocumentToCloudinary(
                fileBuffer,
                'nin',
                userInfo.userId,
                fileName
            );

            if (!uploadResult.success) {
                return {
                    success: false,
                    error: 'Failed to upload document',
                    documentType: 'nin'
                };
            }

            // Update runner document with Cloudinary URL
            await Runner.findByIdAndUpdate(userInfo.userId, {
                'verificationDocuments.nin': {
                    status: 'pending_review',
                    verified: false,
                    documentPath: uploadResult.cloudinaryUrl,
                    cloudinaryPublicId: uploadResult.cloudinaryPublicId,
                    submittedAt: new Date(),
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    dateOfBirth: userInfo.dateOfBirth
                }
            });

            return {
                success: true,
                verified: false,
                documentType: 'nin',
                status: 'pending_review',
                data: {
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    dateOfBirth: userInfo.dateOfBirth,
                    documentPath: uploadResult.cloudinaryUrl,
                    cloudinaryPublicId: uploadResult.cloudinaryPublicId,
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
            const uploadResult = await this.saveDocumentToCloudinary(
                fileBuffer,
                'driver_license',
                userInfo.userId,
                fileName
            );

            if (!uploadResult.success) {
                return {
                    success: false,
                    error: 'Failed to upload document',
                    documentType: 'driver_license'
                };
            }

            // Update runner document with Cloudinary URL
            await Runner.findByIdAndUpdate(userInfo.userId, {
                'verificationDocuments.driverLicense': {
                    status: 'pending_review',
                    verified: false,
                    documentPath: uploadResult.cloudinaryUrl,
                    cloudinaryPublicId: uploadResult.cloudinaryPublicId,
                    submittedAt: new Date(),
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    dateOfBirth: userInfo.dateOfBirth
                }
            });

            return {
                success: true,
                verified: false,
                documentType: 'driver_license',
                status: 'pending_review',
                data: {
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    dateOfBirth: userInfo.dateOfBirth,
                    documentPath: uploadResult.cloudinaryUrl,
                    cloudinaryPublicId: uploadResult.cloudinaryPublicId,
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
            const uploadResult = await this.saveDocumentToCloudinary(
                fileBuffer,
                'selfie',
                userId,
                fileName
            );

            if (!uploadResult.success) {
                return {
                    success: false,
                    error: 'Failed to upload selfie'
                };
            }

            // Update runner biometric verification with Cloudinary URL
            await Runner.findByIdAndUpdate(userId, {
                'biometricVerification': {
                    status: 'pending_review',
                    selfieVerified: false,
                    selfieImage: uploadResult.cloudinaryUrl,
                    cloudinaryPublicId: uploadResult.cloudinaryPublicId,
                    submittedAt: new Date()
                }
            });

            return {
                success: true,
                verified: false,
                status: 'pending_review',
                data: {
                    selfiePath: uploadResult.cloudinaryUrl,
                    cloudinaryPublicId: uploadResult.cloudinaryPublicId,
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

    async deleteDocument(cloudinaryPublicId) {
        try {
            const result = await cloudinary.uploader.destroy(cloudinaryPublicId);

            if (result.result === 'ok') {
                return { success: true };
            } else {
                return { success: false, error: 'Failed to delete from Cloudinary' };
            }
        } catch (error) {
            console.error('Error deleting document from Cloudinary:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== ADMIN METHODS ====================

    async getPendingVerifications() {
        try {
            const pendingRunners = await Runner.find({
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
            const runner = await Runner.findById(runnerId);

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
            await Runner.findByIdAndUpdate(runnerId, {
                [`${updateField}.verified`]: true,
                [`${updateField}.status`]: 'approved',
                [`${updateField}.verifiedAt`]: new Date(),
                [`${updateField}.verifiedBy`]: adminId
            });

            // Recalculate runner status
            const newStatus = await this.calculateRunnerStatus(runnerId);
            await Runner.findByIdAndUpdate(runnerId, { runnerStatus: newStatus });

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
            await Runner.findByIdAndUpdate(runnerId, {
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
            await Runner.findByIdAndUpdate(runnerId, {
                'biometricVerification.selfieVerified': true,
                'biometricVerification.status': 'approved',
                'biometricVerification.verifiedAt': new Date()
            });

            // Recalculate runner status
            const newStatus = await this.calculateRunnerStatus(runnerId);
            const isVerified = newStatus === 'approved_full';

            await Runner.findByIdAndUpdate(runnerId, {
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
            await Runner.findByIdAndUpdate(runnerId, {
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
            const runner = await Runner.findById(userId);

            if (!runner || runner.role !== 'runner') {
                return 'pending_verification';
            }

            const docs = runner.verificationDocuments || {};
            const biometrics = runner.biometricVerification || {};

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
            const verifiedRunners = await Runner.find({
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