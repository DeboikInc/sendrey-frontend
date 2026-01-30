// services/kyc.service.js
const path = require('path');
const fs = require('fs').promises;

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
}

module.exports = KYCService;