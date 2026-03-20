const Order = require('../models/Order');
const Chat = require('../models/Chat').Chat;
const User = require('../models/User');
const Runner = require('../models/Runner');
const Escrow = require('../models/Escrows');
const { computeDeliveryFeeFromDocs } = require('../config/pricing');
const orderStateMachine = require('../services/orderStateMachine');
const { notifyPaymentRequest } = require('../services/notificationService');
const logger = require('../utils/logger');
const { logSocketAudit } = require('../utils/socketAudit');

const handleRunnerAccept = async (io, socket, data) => {
    try {
        const { runnerId, userId, chatId, serviceType } = data;

        // Just cancel any stale unpaid orders — don't create new one yet
        await Order.updateMany(
            {
                chatId,
                paymentStatus: { $ne: 'paid' },
                status: { $nin: ['completed', 'cancelled'] }
            },
            {
                $set: {
                    status: 'cancelled',
                    cancelledBy: 'system',
                    cancelledAt: new Date(),
                    cancellationReason: 'Superseded by new runner accept',
                },
                $push: {
                    statusHistory: {
                        status: 'cancelled',
                        timestamp: new Date(),
                        triggeredBy: 'system',
                        note: 'Superseded by new order from runner re-accept'
                    }
                }
            }
        );

        await Runner.findByIdAndUpdate(runnerId, {
            currentUserId: userId
        });

        await User.findByIdAndUpdate(userId, {
            currentRunnerId: runnerId
        });

        logSocketAudit('RUNNER_ACCEPTED_ORDER', {
            runnerId, userId, serviceType, chatId
        });

    } catch (error) {
        console.error('Error in handleRunnerAccept:', error);
        throw error;
    }
};

module.exports = { handleRunnerAccept };