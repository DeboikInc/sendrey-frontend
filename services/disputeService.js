const Dispute = require('../models/Dispute');
const Escrow = require('../models/Escrows');
const Order = require('../models/Order');
const { Chat } = require('../models/Chat');
const cloudinary = require('../config/cloudinary');
const orderStateMachine = require('./orderStateMachine');
const { sendPushNotification } = require('./notificationService');
const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');
const Runner = require('../models/Runner');

// Execute payments based on outcome
const paymentService = require('./paymentServices');

const uploadEvidence = (base64String) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            base64String,
            { folder: 'dispute-evidence', resource_type: 'auto' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
    });
};

/**
 * Raise a dispute
 */
const raiseDispute = async ({
    orderId,
    chatId,
    raisedBy,
    raisedById,
    reason,
    description,
    evidenceFiles
}) => {
    const order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
    if (!order) throw new Error('Order not found');

    let escrowId = order.escrowId || null;
    if (!escrowId) {
        const escrow = await Escrow.findOne({ orderId: order._id });
        escrowId = escrow?._id || null;
    }

    // Check no existing open dispute
    const existingDispute = await Dispute.findOne({
        orderId,
        status: { $in: ['open', 'under_review'] }
    });
    if (existingDispute) throw new Error('A dispute already exists for this order');

    const userId = order.userId;
    const runnerId = order.runnerId;


    // Upload evidence files
    const evidence = [];
    if (evidenceFiles && evidenceFiles.length > 0) {
        for (const file of evidenceFiles) {
            const uploaded = await uploadEvidence(file.base64);
            evidence.push({
                type: file.type || 'image',
                url: uploaded.secure_url,
                description: file.description || ''
            });
        }
    }

    // Create dispute
    const dispute = await Dispute.create({
        disputeId: Dispute.generateDisputeId(),
        orderId,
        taskId: order.orderId,
        chatId,
        escrowId: order.escrowId || undefined,
        initiatedBy: raisedById,
        initiatedByModel: raisedBy === 'user' ? 'User' : 'Runner',
        userId,
        runnerId,
        reason,
        description,
        evidence,
        status: 'open',
        escrowPaused: !!escrowId,
        messages: [{
            from: raisedBy,
            message: `Dispute raised: ${description}`,
            timestamp: new Date()
        }]
    });


    // Only pause escrow if it exists
    if (escrowId) {
        await Escrow.findByIdAndUpdate(escrowId, { status: 'disputed' });
    }

    await orderStateMachine.transition(orderId, 'disputed', {
        triggeredBy: raisedBy,
        triggeredById: raisedById,
        note: `Dispute raised: ${reason}`
    });

    await order.save();

    const isPostCompletion = ['completed', 'task_completed'].includes(order.status);

    if (isPostCompletion && escrowId) {
        const escrow = await Escrow.findById(escrowId);
        if (escrow?.deliveryFeeReleased && escrow.runnerPayout > 0) {
            const runnerWallet = await Wallet.findOne({ userId: runnerId, userType: 'runner' });
            if (runnerWallet && runnerWallet.balance >= escrow.runnerPayout) {
                runnerWallet.balance -= escrow.runnerPayout;
                runnerWallet.lockedBalance = (runnerWallet.lockedBalance || 0) + escrow.runnerPayout;
                await runnerWallet.save();

                await LedgerEntry.create({
                    userId: runnerId,
                    userModel: 'Runner',
                    runnerId,
                    type: 'escrow_lock',
                    grossAmount: escrow.runnerPayout,
                    netAmount: escrow.runnerPayout,
                    providerFee: 0,
                    provider: 'system',
                    orderId,
                    escrowId,
                    description: `₦${escrow.runnerPayout.toLocaleString()} earned from order ${orderId} locked — dispute in review`,
                    status: 'completed',
                });

                await sendPushNotification({
                    recipientId: runnerId,
                    recipientType: 'runner',
                    title: 'Earnings Locked',
                    body: `₦${escrow.runnerPayout.toLocaleString()} you earned from order ${orderId} has been locked pending dispute review.`,
                    data: { type: 'dispute_lock', orderId, disputeId: dispute.disputeId },
                });

                // store locked amount on dispute for resolution
                dispute.lockedRunnerAmount = escrow.runnerPayout;
                await dispute.save();
            }
        }
    }

    console.log(` Dispute ${dispute.disputeId} raised for order ${orderId}`);
    return dispute;
};

/**
 * Resolve a dispute (admin only)
 */
const resolveDispute = async ({
    disputeId,
    outcome,
    releasePercentage,
    adminNote,
    resolvedBy
}) => {
    const dispute = await Dispute.findOne({ disputeId });
    if (!dispute) throw new Error('Dispute not found');
    if (dispute.isFinal) throw new Error('This dispute is already finalized');

    let escrow = null;
    if (dispute.escrowId) {
        escrow = await Escrow.findById(dispute.escrowId);
    } else {
        const order = await Order.findOne({ orderId: dispute.orderId }).select('_id').sort({ createdAt: -1 }).lean();
        if (order) escrow = await Escrow.findOne({ orderId: order._id });
    }

    if (!escrow) {
        dispute.status = 'resolved';
        dispute.isFinal = true;
        dispute.resolution = {
            outcome,
            amountToUser: 0,
            amountToRunner: 0,
            notes: adminNote || 'No escrow found — order was not paid',
            resolvedBy,
            resolvedAt: new Date(),
        };
        await dispute.save();
        return {
            dispute: await Dispute.findOne({ disputeId })
                .populate('userId', 'firstName lastName email')
                .populate('runnerId', 'firstName lastName email'),
            amountToUser: 0,
            amountToRunner: 0,
        };
    }

    // ── 1. Calculate split ────────────────────────────────────────────────────
    // For post-completion disputes, total is lockedRunnerAmount (runner's payout only).
    // For pre-completion disputes, total is escrow.totalAmount.
    const isPostCompletion = (dispute.lockedRunnerAmount ?? 0) > 0;
    const totalAmount = isPostCompletion ? dispute.lockedRunnerAmount : escrow.totalAmount;

    let amountToUser = 0;
    let amountToRunner = 0;

    switch (outcome) {
        case 'full_release':
            amountToRunner = totalAmount;
            break;
        case 'full_refund':
            amountToUser = totalAmount;
            break;
        case 'partial_release': {
            const runnerPercent = releasePercentage || 50;
            amountToRunner = Math.round(totalAmount * (runnerPercent / 100));
            amountToUser = totalAmount - amountToRunner;
            break;
        }
        case 'partial_refund': {
            const userPercent = releasePercentage || 50;
            amountToUser = Math.round(totalAmount * (userPercent / 100));
            amountToRunner = totalAmount - amountToUser;
            break;
        }
        default:
            throw new Error(`Unknown outcome: ${outcome}`);
    }

    // ── 2. Move funds ─────────────────────────────────────────────────────────
    if (isPostCompletion) {
        // Money is in runner's lockedBalance — redistribute from there
        const runnerWallet = await Wallet.findOne({ userId: dispute.runnerId, userType: 'runner' });
        if (!runnerWallet) throw new Error('Runner wallet not found');

        runnerWallet.lockedBalance = Math.max(0, (runnerWallet.lockedBalance || 0) - dispute.lockedRunnerAmount);
        if (amountToRunner > 0) runnerWallet.balance += amountToRunner;
        await runnerWallet.save();

        if (amountToUser > 0) {
            const userWallet = await Wallet.findOne({ userId: dispute.userId, userType: 'user' });
            if (!userWallet) throw new Error('User wallet not found');
            userWallet.balance += amountToUser;
            await userWallet.save();
        }
    } else {
        // Money still in escrow — credit wallets directly
        if (amountToUser > 0) {
            const userWallet = await Wallet.findOne({ userId: escrow.userId, userType: 'user' });
            if (!userWallet) throw new Error('User wallet not found');
            userWallet.balance += amountToUser;
            await userWallet.save();
        }

        if (amountToRunner > 0) {
            const runnerWallet = await Wallet.findOne({ userId: escrow.runnerId, userType: 'runner' });
            if (!runnerWallet) throw new Error('Runner wallet not found');
            runnerWallet.balance += amountToRunner;
            await runnerWallet.save();
        }
    }

    // ── 3. Ledger entries ─────────────────────────────────────────────────────
    const ledgerEntries = [];

    if (amountToUser > 0) {
        ledgerEntries.push({
            userId: dispute.userId,
            userModel: 'User',
            type: 'refund',
            grossAmount: amountToUser,
            netAmount: amountToUser,
            providerFee: 0,
            provider: 'system',
            orderId: dispute.orderId,
            escrowId: escrow._id,
            description: `Dispute refund for order ${dispute.orderId} — ${outcome}`,
            status: 'completed',
        });
    }

    if (amountToRunner > 0) {
        ledgerEntries.push({
            userId: dispute.runnerId,
            userModel: 'Runner',
            runnerId: dispute.runnerId,
            type: 'escrow_release',
            grossAmount: amountToRunner,
            netAmount: amountToRunner,
            providerFee: 0,
            provider: 'system',
            orderId: dispute.orderId,
            escrowId: escrow._id,
            description: `Dispute payout for order ${dispute.orderId} — ${outcome}`,
            status: 'completed',
        });
    }

    if (ledgerEntries.length > 0) {
        await LedgerEntry.create(ledgerEntries);
    }

    // ── 4. Update dispute ─────────────────────────────────────────────────────
    dispute.status = 'resolved';
    dispute.isFinal = true;
    dispute.escrowPaused = false;
    dispute.resolution = {
        outcome,
        amountToUser,
        amountToRunner,
        releasePercentage: releasePercentage || null,
        notes: adminNote,
        resolvedBy,
        resolvedAt: new Date(),
        notifiedAt: new Date(),
    };
    dispute.messages.push({
        from: 'admin',
        message: `Dispute resolved: ${outcome}. ${adminNote || ''}`,
        timestamp: new Date(),
    });
    await dispute.save();

    await Escrow.findByIdAndUpdate(escrow._id, { status: 'released' });
    await orderStateMachine.transition(dispute.orderId, 'dispute_resolved', {
        triggeredBy: 'admin',
        triggeredById: resolvedBy,
        note: `Resolved: ${outcome}. ${adminNote || ''}`,
    });

    // ── 5. Notify both parties ────────────────────────────────────────────────
    const outcomeMessages = {
        full_release: {
            user: 'Your dispute was reviewed. No refund was issued.',
            runner: `₦${amountToRunner.toLocaleString()} has been released to your wallet.`,
        },
        full_refund: {
            user: `₦${amountToUser.toLocaleString()} has been refunded to your wallet.`,
            runner: 'Your dispute was reviewed. Funds were returned to the customer.',
        },
        partial_release: {
            user: amountToUser > 0
                ? `₦${amountToUser.toLocaleString()} was refunded to your wallet.`
                : 'Your dispute was reviewed. No refund was issued.',
            runner: `₦${amountToRunner.toLocaleString()} has been released to your wallet.`,
        },
        partial_refund: {
            user: `₦${amountToUser.toLocaleString()} was refunded to your wallet.`,
            runner: amountToRunner > 0
                ? `₦${amountToRunner.toLocaleString()} has been released to your wallet.`
                : 'Your dispute was reviewed. Funds were returned to the customer.',
        },
    };

    const msgs = outcomeMessages[outcome];
    if (msgs) {
        await Promise.allSettled([
            sendPushNotification({
                recipientId: dispute.userId,
                recipientType: 'user',
                title: 'Dispute Resolved',
                body: msgs.user,
                data: { type: 'dispute_resolved', orderId: dispute.orderId, outcome },
            }),
            sendPushNotification({
                recipientId: dispute.runnerId,
                recipientType: 'runner',
                title: 'Dispute Resolved',
                body: msgs.runner,
                data: { type: 'dispute_resolved', orderId: dispute.orderId, outcome },
            }),
        ]);
    }

    // ── 6. Return ─────────────────────────────────────────────────────────────
    const populated = await Dispute.findOne({ disputeId })
        .populate('userId', 'firstName lastName email')
        .populate('runnerId', 'firstName lastName email');

    console.log(`Dispute ${disputeId} resolved: ${outcome} | toUser=₦${amountToUser} | toRunner=₦${amountToRunner}`);
    return { dispute: populated, amountToUser, amountToRunner };
};

/**
 * Get dispute by orderId
 */
const getDisputeByOrderId = async (orderId) => {
    return await Dispute.findOne({ orderId }).sort({ createdAt: -1 });
};

/**
 * Get all disputes (admin)
 */
const getAllDisputes = async (page = 1, limit = 20, status = null) => {
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const disputes = await Dispute.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .populate('runnerId', 'firstName lastName email');

    const total = await Dispute.countDocuments(query);

    return {
        disputes,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
};

const getDisputesByRunnerId = async (runnerId) => {
    return Dispute.find({ runnerId })
        .populate('orderId', 'orderId serviceType createdAt')
        .sort({ createdAt: -1 });
}

module.exports = {
    raiseDispute,
    resolveDispute,
    getDisputeByOrderId,
    getDisputesByRunnerId,
    getAllDisputes
};