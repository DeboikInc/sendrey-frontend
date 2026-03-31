const paymentService = require('../services/paymentServices');
const Wallet = require('../models/Wallet');
const BaseController = require('./baseController');
const paystack = require('../config/paystack');
const Escrow = require('../models/Escrows');
const Order = require('../models/Order');
const { sendPaymentEvent } = require('../kafka/producers/paymentProducer');
const {
    notifyPaymentSuccess,
    notifyEscrowReleased,
    notifyItemApproved,
    sendPushNotification,
} = require('../services/notificationService');
const pinService = require('../services/pinService');

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

class PaymentController extends BaseController {
    constructor() {
        super(null);

        this.createPaymentIntent = this.createPaymentIntent.bind(this);
        this.fundWallet = this.fundWallet.bind(this);
        this.getWalletBalance = this.getWalletBalance.bind(this);
        this.handleWebhook = this.handleWebhook.bind(this);
        this.verifyPayment = this.verifyPayment.bind(this);
        this.checkEscrowTimeouts = this.checkEscrowTimeouts.bind(this);
        this.createTaskEscrow = this.createTaskEscrow.bind(this);
        this.releaseEscrow = this.releaseEscrow.bind(this);
        this.releaseItemBudget = this.releaseItemBudget.bind(this);
        this.createVirtualAccount = this.createVirtualAccount.bind(this);
        this.getTransactionHistory = this.getTransactionHistory.bind(this);
        this.withdrawFromWallet = this.withdrawFromWallet.bind(this);
        this.getBanks = this.getBanks.bind(this);
        this.verifyAccount = this.verifyAccount.bind(this);
        this.verifyWalletFunding = this.verifyWalletFunding.bind(this);
    }

    async createPaymentIntent(req, res) {
        console.log('[paymentIntent] full req.body:', JSON.stringify(req.body, null, 2));
        console.log('[paymentIntent] pin received:', req.body.pin);
        console.log('[paymentIntent] paymentMethod:', req.body.paymentMethod);
        try {
            const { orderId, chatId, paymentMethod, pin } = req.body;
            console.log('createPaymentIntent body:', req.body); // ← add this
            console.log('Looking for orderId:', orderId);
            const userId = req.user._id;
            const userEmail = req.user.email;

            let resolvedOrderId = orderId;
            if (!resolvedOrderId && chatId) {
                const fallbackOrder = await Order.findOne({
                    chatId,
                    paymentStatus: { $ne: 'paid' }
                }).sort({ createdAt: -1 });
                resolvedOrderId = fallbackOrder?.orderId;
            }
            if (!resolvedOrderId) return res.status(400).json({ success: false, message: 'Order not found' });

            // verify user pin
            if (paymentMethod === 'wallet') {
                if (!pin) return res.status(400).json({ success: false, message: 'PIN is required for wallet payments' });
                const { valid } = await pinService.verifyPin({
                    userId: req.user._id,
                    role: req.user.role,
                    pin,
                });
                if (!valid) return res.status(401).json({ status: 'fail', message: 'Incorrect PIN' });
            }

            const result = await paymentService.payForOrder(
                resolvedOrderId,
                paymentMethod,
                userId,
                userEmail
            );

            this.success(res, result);
        } catch (error) {
            console.error('Error creating payment:', error);
            this.error(res, error.message);
        }
    }

    async verifyPayment(req, res) {
        try {
            const { reference } = req.body;
            const result = await paymentService.verifyPayment(reference);
            this.success(res, { message: 'Payment verified successfully', ...result });
        } catch (error) {
            console.error('Error verifying payment:', error);
            this.error(res, error.message);
        }
    }

    async fundWallet(req, res) {
        try {
            const { amount } = req.body;
            const userId = req.user._id;
            const userEmail = req.user.email;

            const result = await paymentService.fundWallet(userId, amount, userEmail);

            sendPaymentEvent('wallet.funded', {
                userId,
                userEmail,
                userName: `${req.user.firstName} ${req.user.lastName}`,
                amount,
                newBalance: result.newBalance,
                reference: result.reference,
            });

            this.success(res, result);
        } catch (error) {
            console.error('Error funding wallet:', error);
            this.error(res, error.message);
        }
    }

    async getWalletBalance(req, res) {
        try {
            const userId = req.user._id;

            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = await Wallet.create({ userId, userType: 'user', balance: 0 });
            }

            this.success(res, { balance: wallet.balance, status: wallet.status });
        } catch (error) {
            console.error('Error getting wallet balance:', error);
            this.error(res, error.message);
        }
    }

    async handleWebhook(req, res) {
        const hash = req.headers['x-paystack-signature'];
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const crypto = require('crypto');

        // const body = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

        const computedHash = crypto
            .createHmac('sha512', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== computedHash) {
            console.error('⚠️ Webhook signature verification failed');
            return res.status(400).send('Invalid signature');
        }

        // const event = typeof req.body === 'string'
        //     ? JSON.parse(req.body)
        //     : req.body instanceof Buffer
        //         ? JSON.parse(req.body.toString())
        //         : req.body;

        const event = req.body;

        switch (event.event) {
            case 'charge.success': {
                const { reference, metadata } = event.data;

                if (metadata.type === 'wallet_funding') {
                    const result = await paymentService.verifyWalletFunding(reference);
                    sendPaymentEvent('wallet.funded', {
                        userId: metadata.userId,
                        userEmail: metadata.userEmail,
                        userName: metadata.userName,
                        amount: event.data.amount / 100,
                        newBalance: result?.newBalance,
                        reference,
                    });
                } else if (metadata.orderId) {
                    await paymentService.verifyPayment(reference);
                }

                // console.log(' Payment successful:', reference);
                break;
            }
            case 'transfer.success':
                console.log('Transfer successful');
                break;
            case 'transfer.failed':
                console.log('Transfer failed');
                break;
            default:
                console.log(`Unhandled event type ${event.event}`);
        }

        res.json({ received: true });
    }

    async createTaskEscrow(req, res) {
        try {
            const { orderId, taskType } = req.body;
            const userId = req.user._id;

            const order = await Order.findOne({ orderId }).populate('userId').populate('runnerId');
            if (order.userId._id.toString() !== userId.toString()) {
                return this.badRequest(res, 'Unauthorized');
            }

            if (order.status !== 'pending_payment') {
                return this.badRequest(res, 'Order already funded');
            }

            const { platformFee, runnerPayout } = Escrow.calculateFees(order.deliveryFee);

            const escrow = await Escrow.create({
                taskId: order.orderId,
                orderId: order._id,
                userId: order.userId,
                runnerId: order.runnerId,
                taskType,
                itemBudget: order.itemBudget,
                deliveryFee: order.deliveryFee,
                totalAmount: order.totalAmount,
                platformFee,
                runnerPayout,
                timeoutAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                status: 'funded',
                paymentStatus: 'paid',
            });

            await paymentService.lockWalletFunds(userId, escrow.totalAmount, escrow._id);

            order.escrowId = escrow._id;
            order.paymentStatus = 'paid';
            order.status = 'paid';
            await order.save();

            sendPaymentEvent('escrow.created', {
                orderId: order.orderId,
                escrowId: escrow._id,
                taskType,
                totalAmount: escrow.totalAmount,
                runnerPayout: escrow.runnerPayout,
                userId: order.userId._id,
                userEmail: order.userId.email,
                userName: `${order.userId.firstName} ${order.userId.lastName}`,
                runnerId: order.runnerId?._id,
                runnerPhone: order.runnerId?.phone,
                runnerName: `${order.runnerId?.firstName} ${order.runnerId?.lastName}`,
            });

            // Notify runner — payment confirmed, they can start the task
            notifyPaymentSuccess(order.runnerId?._id, {
                orderId: order.orderId,
                amount: escrow.runnerPayout,
            });

            this.success(res, {
                message: 'Escrow created & funds locked ✅',
                escrowId: escrow._id,
            });
        } catch (error) {
            console.error('Escrow creation error:', error);
            this.error(res, error.message);
        }
    }

    async releaseEscrow(req, res) {
        try {
            const { escrowId } = req.params;
            const escrow = await Escrow.findById(escrowId)
                .populate('orderId')
                .populate('userId')
                .populate('runnerId');

            if (escrow.status !== 'delivery_pending') {
                return this.badRequest(res, 'Escrow not ready for release');
            }

            if (escrow.taskType === 'shopping' && !escrow.itemBudgetReleased) {
                await paymentService.releaseItemBudget(escrowId);

                sendPaymentEvent('item_budget.released', {
                    escrowId,
                    orderId: escrow.taskId,
                    itemBudget: escrow.itemBudget,
                    runnerId: escrow.runnerId?._id,
                    runnerPhone: escrow.runnerId?.phone,
                });

                // Notify runner their item budget is approved and in their wallet
                notifyItemApproved(escrow.runnerId?._id, { orderId: escrow.taskId });

                return this.success(res, { message: 'Item budget released to runner' });
            }

            if (!escrow.deliveryFeeReleased) {
                await paymentService.payoutToRunner(escrowId);

                sendPaymentEvent('escrow.released', {
                    escrowId,
                    orderId: escrow.taskId,
                    runnerPayout: escrow.runnerPayout,
                    runnerId: escrow.runnerId?._id,
                    runnerEmail: escrow.runnerId?.email,
                    runnerName: `${escrow.runnerId?.firstName} ${escrow.runnerId?.lastName}`,
                    userId: escrow.userId?._id,
                    userPhone: escrow.userId?.phone,
                });

                // Notify runner their delivery fee has been released
                notifyEscrowReleased(escrow.runnerId?._id, {
                    orderId: escrow.taskId,
                    amount: escrow.runnerPayout,
                });
            }

            this.success(res, { message: 'Funds released: runner paid full amount' });
        } catch (error) {
            this.error(res, error.message);
        }
    }

    async checkEscrowTimeouts(req, res) {
        try {
            const timedOut = await Escrow.find({
                status: 'delivery_pending',
                timeoutAt: { $lt: new Date() },
            });

            for (const escrow of timedOut) {
                await paymentService.payoutToRunner(escrow._id);
            }

            sendPaymentEvent('timeout.checked', {
                releasedCount: timedOut.length,
                checkedAt: Date.now(),
            });

            this.success(res, {
                message: `${timedOut.length} escrows auto-released due to timeout`,
            });
        } catch (error) {
            this.error(res, error.message);
        }
    }

    async releaseItemBudget(req, res) {
        try {
            const { escrowId } = req.params;
            const userId = req.user._id;

            const escrow = await Escrow.findById(escrowId).populate('runnerId');
            if (!escrow) return this.notFound(res, 'Escrow not found');

            if (escrow.userId.toString() !== userId.toString()) {
                return this.forbidden(res, 'Unauthorized');
            }

            const result = await paymentService.releaseItemBudget(escrowId);

            sendPaymentEvent('item_budget.released', {
                escrowId,
                orderId: escrow.taskId,
                itemBudget: escrow.itemBudget,
                runnerId: escrow.runnerId?._id,
                runnerPhone: escrow.runnerId?.phone,
            });

            // Notify runner their item budget is approved and in their wallet
            notifyItemApproved(escrow.runnerId?._id, { orderId: escrow.taskId });

            this.success(res, { message: 'Item budget released to runner', ...result });
        } catch (error) {
            console.error('Error releasing item budget:', error);
            this.error(res, error.message);
        }
    }

    async createVirtualAccount(req, res) {
        try {
            const userId = req.user._id;
            const userEmail = req.user.email;
            const userName = `${req.user.firstName} ${req.user.lastName}`;

            const wallet = await Wallet.findOne({ userId });
            if (wallet?.virtualAccountNumber) {
                return this.success(res, {
                    accountNumber: wallet.virtualAccountNumber,
                    bankName: wallet.virtualAccountBank,
                    accountName: wallet.virtualAccountName,
                });
            }

            const result = await paymentService.createVirtualAccount(userId, userEmail, userName);
            this.success(res, result);
        } catch (error) {
            console.error('Error creating virtual account:', error);
            this.error(res, error.message);
        }
    }

    async getTransactionHistory(req, res) {
        try {
            const userId = req.user._id;
            const { page = 1, limit = 20 } = req.query;

            const result = await paymentService.getTransactionHistory(
                userId,
                parseInt(page),
                parseInt(limit)
            );

            this.success(res, result);
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            this.error(res, error.message);
        }
    }

    /**
     * Withdraw from wallet
     *
     * Funds are locked immediately but only released to the runner's bank
     * after a 24-hour hold period. Runner is notified twice:
     *   1. Immediately — withdrawal request received
     *   2. After 24hrs — funds have been sent
     *
     * NOTE: The setTimeout here is intentionally simple. If your server restarts
     * within the 24hr window, the delayed notification won't fire. For production,
     * replace the setTimeout with a proper job queue (Bull, Agenda, etc).
     */
    async withdrawFromWallet(req, res) {
        try {
            const runnerId = req.user._id; // only runners withdraw
            const { amount, bankDetails, pin } = req.body;

            console.log('withdrawFromWallet body:', { amount, bankDetails: !!bankDetails, pin: !!pin });
            console.log('bankDetails:', bankDetails);

            if (!amount || amount < 100) {
                console.log('Failed: amount check', amount);
                return this.badRequest(res, 'Minimum withdrawal amount is ₦100');
            }

            if (!bankDetails?.accountNumber || !bankDetails?.bankCode) {
                console.log('Failed: bankDetails check', bankDetails);
                return this.badRequest(res, 'Bank details are required');
            }

            if (!pin) {
                console.log('Failed: pin missing');
                return res.status(400).json({ success: false, message: 'PIN is required' });
            }

            // pin
            const { valid } = await pinService.verifyPin({
                userId: runnerId,
                role: 'runner',
                pin,
            });
            if (!valid) return res.status(401).json({ status: 'fail', message: 'Incorrect PIN' });

            const result = await paymentService.withdrawFromWallet(
                runnerId, amount, bankDetails, { releaseAfter: TWENTY_FOUR_HOURS }
            );

            sendPaymentEvent('withdrawal', {
                runnerId,
                runnerEmail: req.user.email,
                runnerName: `${req.user.firstName} ${req.user.lastName}`,
                amount,
                bankName: bankDetails.bankName,
                accountNumber: bankDetails.accountNumber,
                reference: result?.reference,
            });

            // Notify runner immediately — request received, hold period starts
            sendPushNotification({
                recipientId: runnerId,
                recipientType: 'runner',
                title: 'Withdrawal Requested',
                body: `₦${amount?.toLocaleString()} will be sent to your ${bankDetails.bankName} account within 24 hours.`,
                data: { type: 'withdrawal_requested', amount, reference: result?.reference },
            });

            // Notify runner after 24hrs — funds are on their way
            setTimeout(() => {
                sendPushNotification({
                    recipientId: runnerId,
                    recipientType: 'runner',
                    title: 'Withdrawal Sent',
                    body: `₦${amount?.toLocaleString()} has been sent to your ${bankDetails.bankName} account.`,
                    data: { type: 'withdrawal_released', amount, reference: result?.reference },
                });
            }, TWENTY_FOUR_HOURS);

            this.success(res, {
                ...result,
                message: `Withdrawal of ₦${amount?.toLocaleString()} scheduled. Funds will be released within 24 hours.`,
            });
        } catch (error) {
            console.error('Error withdrawing from wallet:', error);
            this.error(res, error.message);
        }
    }

    async getBanks(req, res) {
        try {
            const result = await paystack.getBanks();
            this.success(res, result.data);
        } catch (error) {
            console.error('Error fetching banks:', error);
            this.error(res, error.message);
        }
    }

    async verifyWalletFunding(req, res) {
        try {
            const { reference } = req.body;
            const result = await paymentService.verifyWalletFunding(reference);
            if (result.alreadyProcessed) {
                return this.success(res, { message: 'Already processed' });
            }
            this.success(res, { message: 'Wallet funded successfully', balance: result.balance, amount: result.amount });
        } catch (error) {
            console.error('Error verifying wallet funding:', error);
            this.error(res, error.message);
        }
    }

    async verifyAccount(req, res) {
        try {
            const { accountNumber, bankCode } = req.body;
            const result = await paystack.verifyAccountNumber({
                account_number: accountNumber,
                bank_code: bankCode,
            });
            this.success(res, result.data);
        } catch (error) {
            console.error('Error verifying account:', error);
            this.error(res, error.message);
        }
    }
}

module.exports = new PaymentController();