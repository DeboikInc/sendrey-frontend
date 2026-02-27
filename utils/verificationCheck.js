const Runner = require('../models/Runner');

/**
 * Check if runner can accept errands based on verification status and daily limits
 * @param {String} runnerId - Runner's MongoDB ID
 * @returns {Object} { canAccept: Boolean, reason: String, status: String, dailyCount: Number, maxDaily: Number }
 */
const canRunnerAcceptErrand = async (runnerId) => {
    try {
        const runner = await Runner.findById(runnerId).select(
            'runnerStatus dailyErrandCount lastErrandResetDate verificationDocuments biometricVerification'
        );

        if (!runner) {
            return {
                canAccept: false,
                reason: 'Runner not found',
                status: null
            };
        }

        const status = runner.runnerStatus;

        // Banned or suspended - hard stop
        if (status === 'banned' || status === 'suspended') {
            let reason = 'Your account has been suspended.';

            if (status === 'banned') {
                // Check for rejection reasons
                const ninRejected = runner.verificationDocuments?.nin?.status === 'rejected';
                const dlRejected = runner.verificationDocuments?.driverLicense?.status === 'rejected';
                const selfieRejected = runner.biometricVerification?.status === 'rejected';

                if (ninRejected) {
                    reason = runner.verificationDocuments.nin.rejectionReason
                        ? `Your NIN verification was rejected: ${runner.verificationDocuments.nin.rejectionReason}`
                        : 'Your NIN verification was rejected.';
                } else if (dlRejected) {
                    reason = runner.verificationDocuments.driverLicense.rejectionReason
                        ? `Your Driver's License verification was rejected: ${runner.verificationDocuments.driverLicense.rejectionReason}`
                        : 'Your Driver\'s License verification was rejected.';
                } else if (selfieRejected) {
                    reason = runner.biometricVerification.rejectionReason
                        ? `Your selfie verification was rejected: ${runner.biometricVerification.rejectionReason}`
                        : 'Your selfie verification was rejected.';
                }

                reason += ' Please contact support@sendrey.com for assistance.';
            }

            // Set runner unavailable after 2 errands for limited and not reviewed at all
            await Runner.findByIdAndUpdate(runnerId, { isAvailable: false });

            return {
                canAccept: false,
                reason,
                status,
                isBanned: true
            };
        }

        // approved_full - unlimited errands
        if (status === 'approved_full') {
            // make sure they are available
            if (!runner.isAvailable) {
                await Runner.findByIdAndUpdate(runnerId, { isAvailable: true });
            }

            return {
                canAccept: true,
                reason: null,
                status,
                dailyCount: runner.dailyErrandCount || 0,
                maxDaily: null // unlimited
            };
        }

        // approved_limited - check daily limit (2 per day)
        if (status === 'approved_limited' || status === 'pending_verification') {
            const MAX_DAILY_ERRANDS = 2;

            // Check if we need to reset daily count (midnight reset)
            const now = new Date();
            const lastReset = runner.lastErrandResetDate;

            let needsReset = false;
            if (!lastReset) {
                needsReset = true;
            } else {
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const lastResetMidnight = new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate());

                if (todayMidnight > lastResetMidnight) {
                    needsReset = true;
                }
            }

            if (needsReset) {
                // Reset count and set available
                await Runner.findByIdAndUpdate(runnerId, {
                    dailyErrandCount: 0,
                    lastErrandResetDate: new Date(),
                    isAvailable: true
                });

                return {
                    canAccept: true,
                    reason: null,
                    status,
                    dailyCount: 0,
                    maxDaily: MAX_DAILY_ERRANDS
                };
            }

            // Check current count
            const currentCount = runner.dailyErrandCount || 0;

            if (currentCount >= MAX_DAILY_ERRANDS) {

                if (runner.isAvailable) {
                    await Runner.findByIdAndUpdate(runnerId, { isAvailable: false });
                    console.log(`Runner ${runnerId} reached daily limit, set isAvailable: false`);
                }

                // Calculate time until midnight reset
                const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                const hoursUntilReset = Math.ceil((tomorrow - now) / (1000 * 60 * 60));

                return {
                    canAccept: false,
                    reason: `You have reached your daily limit of ${MAX_DAILY_ERRANDS} errands. Your count resets in ${hoursUntilReset} hour${hoursUntilReset === 1 ? '' : 's'}.`,
                    status,
                    dailyCount: currentCount,
                    maxDaily: MAX_DAILY_ERRANDS,
                    resetIn: hoursUntilReset
                };
            }

            // Still under limit - make sure they're available
            if (!runner.isAvailable) {
                await Runner.findByIdAndUpdate(runnerId, { isAvailable: true });
                console.log(`Runner ${runnerId} under limit, set isAvailable: true`);
            }

            return {
                canAccept: true,
                reason: null,
                status,
                dailyCount: currentCount,
                maxDaily: MAX_DAILY_ERRANDS
            };
        }

        // Unknown status - default to cannot accept
        return {
            canAccept: false,
            reason: 'Your account status is under review.',
            status
        };

    } catch (error) {
        console.error('canRunnerAcceptErrand error:', error);
        return {
            canAccept: false,
            reason: 'Error checking verification status. Please try again.',
            status: null,
            error: error.message
        };
    }
};

/**
 * Increment runner's daily errand count (called after accepting an errand)
 * Only increments for approved_limited runners
 */
const incrementErrandCount = async (runnerId) => {
    try {
        const runner = await Runner.findById(runnerId).select('runnerStatus dailyErrandCount');

        if (runner && runner.runnerStatus === 'approved_limited') {
            await Runner.findByIdAndUpdate(runnerId, {
                $inc: { dailyErrandCount: 1 }
            });

            console.log(`✅ Incremented errand count for runner ${runnerId} (approved_limited)`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('incrementErrandCount error:', error);
        return false;
    }
};

module.exports = {
    canRunnerAcceptErrand,
    incrementErrandCount
};