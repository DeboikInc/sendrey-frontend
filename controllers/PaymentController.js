const paymentService = require('../services/paymentServices');
const Wallet = require('../models/Wallet');
const BaseController = require('./baseController');
const paystack = require('../config/paystack');
const Escrow = require('../models/Escrows');
const Order = require('../models/Order');

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
    }

    /**
     * Create payment intent for order (Paystack)
     */
    async createPaymentIntent(req, res) {
        try {
            const { orderId, paymentMethod } = req.body;
            const userId = req.user._id;
            const userEmail = req.user.email;

            const result = await paymentService.payForOrder(
                orderId,
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

    /**
     * Verify Paystack payment
     */
    async verifyPayment(req, res) {
        try {
            const { reference } = req.body;

            const result = await paymentService.verifyPayment(reference);

            this.success(res, {
                message: 'Payment verified successfully',
                ...result
            });
        } catch (error) {
            console.error('Error verifying payment:', error);
            this.error(res, error.message);
        }
    }

    /**
     * Fund wallet (Paystack)
     */
    async fundWallet(req, res) {
        try {
            const { amount } = req.body;
            const userId = req.user._id;
            const userEmail = req.user.email;

            const result = await paymentService.fundWallet(userId, amount, userEmail);

            this.success(res, result);
        } catch (error) {
            console.error('Error funding wallet:', error);
            this.error(res, error.message);
        }
    }

    /**
     * Get wallet balance
     */
    async getWalletBalance(req, res) {
        try {
            const userId = req.user._id;

            let wallet = await Wallet.findOne({ userId });

            if (!wallet) {
                wallet = await Wallet.create({
                    userId,
                    userType: 'user',
                    balance: 0
                });
            }

            this.success(res, {
                balance: wallet.balance,
                status: wallet.status
            });
        } catch (error) {
            console.error('Error getting wallet balance:', error);
            this.error(res, error.message);
        }
    }

    /**
     * Paystack webhook handler
     */
    async handleWebhook(req, res) {
        const hash = req.headers['x-paystack-signature'];
        const secret = process.env.PAYSTACK_SECRET_KEY;

        // Verify webhook signature
        const crypto = require('crypto');
        const computedHash = crypto
            .createHmac('sha512', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== computedHash) {
            console.error('⚠️ Webhook signature verification failed');
            return res.status(400).send('Invalid signature');
        }

        const event = req.body;

        switch (event.event) {
            case 'charge.success':
                const { reference, metadata } = event.data;

                if (metadata.type === 'wallet_funding') {
                    // Wallet funding
                    await paymentService.verifyWalletFunding(reference);
                } else if (metadata.orderId) {
                    // Order payment
                    await paymentService.verifyPayment(reference);
                }

                console.log('✅ Payment successful:', reference);
                break;

            case 'transfer.success':
                console.log('✅ Transfer successful');
                break;

            case 'transfer.failed':
                console.log('❌ Transfer failed');
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

            const order = await Order.findOne({ orderId }).populate('userId');
            if (order.userId._id.toString() !== userId.toString()) {
                return this.badRequest(res, 'Unauthorized');
            }

            if (order.status !== 'pending_payment') {
                return this.badRequest(res, 'Order already funded');
            }

            const { platformFee, runnerPayout } = Escrow.calculateFees(order.deliveryFee);

            const escrowData = {
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
                paymentStatus: 'paid'
            };

            const escrow = await Escrow.create(escrowData);

            await paymentService.lockWalletFunds(userId, escrow.totalAmount, escrow._id);

            order.escrowId = escrow._id;
            order.paymentStatus = 'paid';
            order.status = 'paid';
            await order.save();

            this.success(res, {
                message: 'Escrow created & funds locked ✅',
                escrowId: escrow._id
            });
        } catch (error) {
            console.error('Escrow creation error:', error);
            this.error(res, error.message);
        }
    }

    async releaseEscrow(req, res) {
        try {
            const { escrowId } = req.params;
            const escrow = await Escrow.findById(escrowId).populate('orderId');

            if (escrow.status !== 'delivery_pending') {
                return this.badRequest(res, 'Escrow not ready for release');
            }

            if (escrow.taskType === 'shopping' && !escrow.itemBudgetReleased) {
                await paymentService.releaseItemBudget(escrowId);
                return this.success(res, { message: 'Item budget released to runner' });
            }

            if (!escrow.deliveryFeeReleased) {
                await paymentService.payoutToRunner(escrowId);
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
                timeoutAt: { $lt: new Date() }
            });

            for (const escrow of timedOut) {
                await paymentService.payoutToRunner(escrow._id);
            }

            this.success(res, {
                message: `${timedOut.length} escrows auto-released due to timeout`
            });
        } catch (error) {
            this.error(res, error.message);
        }
    }

    async releaseItemBudget(req, res) {
        try {
            const { escrowId } = req.params;
            const userId = req.user._id;

            const escrow = await Escrow.findById(escrowId);
            if (!escrow) {
                return this.notFound(res, 'Escrow not found');
            }

            if (escrow.userId.toString() !== userId.toString()) {
                return this.forbidden(res, 'Unauthorized');
            }

            const result = await paymentService.releaseItemBudget(escrowId);

            this.success(res, {
                message: 'Item budget released to runner',
                ...result
            });
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

            // Check if already has virtual account
            const wallet = await Wallet.findOne({ userId });
            if (wallet?.virtualAccountNumber) {
                return this.success(res, {
                    accountNumber: wallet.virtualAccountNumber,
                    bankName: wallet.virtualAccountBank,
                    accountName: wallet.virtualAccountName
                });
            }

            const result = await paymentService.createVirtualAccount(
                userId, userEmail, userName
            );

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

    async withdrawFromWallet(req, res) {
        try {
            const userId = req.user._id;
            const { amount, bankDetails } = req.body;

            if (!amount || amount < 100) {
                return this.badRequest(res, 'Minimum withdrawal amount is ₦100');
            }

            if (!bankDetails?.accountNumber || !bankDetails?.bankCode) {
                return this.badRequest(res, 'Bank details are required');
            }

            const result = await paymentService.withdrawFromWallet(
                userId, amount, bankDetails
            );

            this.success(res, result);
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

    async verifyAccount(req, res) {
        try {
            const { accountNumber, bankCode } = req.body;
            const result = await paystack.verifyAccountNumber({
                account_number: accountNumber,
                bank_code: bankCode
            });
            this.success(res, result.data);
        } catch (error) {
            console.error('Error verifying account:', error);
            this.error(res, error.message);
        }
    }
}

module.exports = new PaymentController();