const paystack = require('../config/paystack');

const orderStateMachine = require('../services/orderStateMachine');

const { notifyEscrowReleased } = require('./notificationService');

const Wallet = require('../models/Wallet');
const Escrow = require('../models/Escrows');
const Order = require('../models/Order');
const User = require('../models/User');
const Runner = require('../models/Runner');
const RunnerPayout = require('../models/RunnerPayout');
const PlatformEarnings = require('../models/PlatformEarnings');

let io;
const getSocketIO = () => {
    if (ioInstance) return ioInstance;

    try {
        const socketModule = require('../socket');
        // Check if getIO exists before calling it
        if (socketModule && typeof socketModule.getIO === 'function') {
            ioInstance = socketModule.getIO();
        } else {
            console.warn('socketModule.getIO is not a function yet');
            return null;
        }
    } catch (err) {
        console.warn('Socket module not ready yet:', err.message);
        return null;
    }
    return ioInstance;
};


const { Chat } = require('../models/Chat');


class PaymentService {



    async createVirtualAccount(userId, email, fullName) {
        try {
            // Create Paystack customer first
            const customer = await paystack.createCustomer({
                email,
                first_name: fullName.split(' ')[0],
                last_name: fullName.split(' ').slice(1).join(' ') || fullName,
                metadata: { userId: userId.toString() }
            });

            const customerCode = customer.data.customer_code;

            // Create dedicated virtual account for the customer
            const virtualAccount = await paystack.createDedicatedVirtualAccount({
                customer: customerCode,
                preferred_bank: 'wema-bank' // or 'titan-paystack'
            });

            // Save to user/runner record
            const updated = await User.findByIdAndUpdate(userId, {
                paystackCustomerCode: customerCode,
                virtualAccount: {
                    bankName: virtualAccount.data.bank.name,
                    accountNumber: virtualAccount.data.account_number,
                    accountName: virtualAccount.data.account_name,
                }
            }) || await Runner.findByIdAndUpdate(userId, {
                paystackCustomerCode: customerCode,
                virtualAccount: {
                    bankName: virtualAccount.data.bank.name,
                    accountNumber: virtualAccount.data.account_number,
                    accountName: virtualAccount.data.account_name,
                }
            });

            console.log(`Virtual account created for ${email}`);

            return virtualAccount.data;

        } catch (error) {
            console.error('Error creating virtual account:', error.message);
            throw error;
        }
    }

    /**
     * Initialize payment for order (Paystack)
     */
    async payForOrder(orderId, paymentMethod, userId, userEmail) {
        try {
            const order = await Order.findOne({ orderId });
            if (!order) {
                throw new Error('Order not found');
            }

            if (order.paymentStatus === 'paid') {
                throw new Error('Order already paid');
            }

            if (paymentMethod === 'wallet') {
                // Pay via wallet
                const wallet = await Wallet.findOne({ userId });
                if (!wallet || wallet.balance < order.totalAmount) {
                    throw new Error('Insufficient wallet balance');
                }

                // Debit wallet
                await wallet.debit(
                    order.totalAmount,
                    `order-${orderId}`,
                    { orderId, source: 'wallet' }
                );

                // Create escrow
                const escrow = await Escrow.create({
                    taskId: orderId,
                    userId: order.userId,
                    runnerId: order.runnerId,
                    taskType: order.taskType,
                    itemBudget: order.itemBudget,
                    deliveryFee: order.deliveryFee,
                    totalAmount: order.totalAmount,
                    platformFee: order.platformFee,
                    runnerPayout: order.runnerPayout,
                    status: 'funded',
                    paymentStatus: 'paid'
                });

                // Link escrow to order
                order.escrowId = escrow._id;
                order.paymentStatus = 'paid';
                await order.updateStatus('paid', 'user');

                console.log('Paid via wallet');

                return {
                    escrowId: escrow._id,
                    paymentStatus: 'paid',
                    totalAmount: order.totalAmount
                };

            } else if (paymentMethod === 'card') {
                // Pay via Paystack
                const paystackResponse = await paystack.initializeTransaction({
                    email: userEmail,
                    amount: order.totalAmount,
                    metadata: {
                        orderId,
                        userId: userId.toString()
                    }
                });

                console.log(' Paystack payment initialized');

                return {
                    reference: paystackResponse.data.reference,
                    authorizationUrl: paystackResponse.data.authorization_url,
                    amount: order.totalAmount,
                    paymentStatus: 'pending'
                };
            }

        } catch (error) {
            console.error('Error paying for order:', error);
            throw error;
        }
    }

    /**
     * Verify payment and create escrow (Paystack webhook or manual verification)
     */
    async verifyPayment(reference) {
        try {
            const verification = await paystack.verifyTransaction(reference);

            if (!verification.status || verification.data.status !== 'success') {
                throw new Error('Payment verification failed');
            }

            const { orderId } = verification.data.metadata;
            const amount = verification.data.amount / 100; // Convert from kobo

            const order = await Order.findOne({ orderId });
            if (!order) {
                throw new Error('Order not found');
            }

            // Create escrow
            const escrow = await Escrow.create({
                taskId: orderId,
                userId: order.userId,
                runnerId: order.runnerId,
                taskType: order.taskType,
                itemBudget: order.itemBudget,
                deliveryFee: order.deliveryFee,
                totalAmount: order.totalAmount,
                platformFee: order.platformFee,
                runnerPayout: order.runnerPayout,
                status: 'funded',
                paymentStatus: 'paid',
                paystackReference: reference
            });

            await orderStateMachine.transition(order.orderId, 'paid', {
                triggeredBy: 'user',
                triggeredById: userId,
                note: `Payment via ${paymentMethod}`
            });

            console.log('Payment verified and escrow created');

            return { escrow, order };

        } catch (error) {
            console.error('Error verifying payment:', error);
            throw error;
        }
    }

    /**
     * Fund wallet via Paystack
     */
    async fundWallet(userId, amount, userEmail) {
        try {
            if (amount < 100) {
                throw new Error('Minimum funding amount is ₦100');
            }

            const paystackResponse = await paystack.initializeTransaction({
                email: userEmail,
                amount,
                metadata: {
                    userId: userId.toString(),
                    type: 'wallet_funding'
                }
            });

            console.log('✅ Wallet funding initialized');

            return {
                reference: paystackResponse.data.reference,
                authorizationUrl: paystackResponse.data.authorization_url,
                accessCode: paystackResponse.data.access_code
            };

        } catch (error) {
            console.error('❌ Error funding wallet:', error);
            throw error;
        }
    }

    /**
     * Verify wallet funding
     */
    async verifyWalletFunding(reference) {
        try {
            const verification = await paystack.verifyTransaction(reference);

            if (!verification.status || verification.data.status !== 'success') {
                throw new Error('Payment verification failed');
            }

            const { userId } = verification.data.metadata;
            const amount = verification.data.amount / 100;

            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            // Credit wallet
            await wallet.credit(amount, reference, {
                source: 'paystack',
                paystackReference: reference
            });

            console.log('✅ Wallet funded successfully');

            return {
                balance: wallet.balance,
                amount
            };

        } catch (error) {
            console.error('❌ Error verifying wallet funding:', error);
            throw error;
        }
    }

    /**
 * Payout delivery earnings to runner wallet
 * Called after task_completed
 *
 * RUNNER FEE LOCK:
 *   - If runner submitted receipt via Payout page: usedPayoutSystem = true
 *     → runner gets their delivery fee credited to wallet
 *   - If runner bypassed payout system: usedPayoutSystem = false
 *     → runner fee goes to platform instead (runner forfeits it)
 */
    async payoutToRunner(escrowId) {
        const escrow = await Escrow.findById(escrowId);
        if (!escrow) throw new Error('Escrow not found');
        if (escrow.deliveryFeeReleased) throw new Error('Delivery fee already released');

        const runner = await Runner.findById(escrow.runnerId);
        if (!runner) throw new Error('Runner not found');

        const runnerWallet = await Wallet.findOne({ userId: escrow.runnerId, userType: 'runner' });
        if (!runnerWallet) throw new Error('Runner wallet not found');

        // Check if runner used the payout system
        const order = await Order.findOne({ escrowId: escrow._id })
            || await Order.findOne({ orderId: escrow.taskId });

        let usedPayoutSystem = true; // default true for non-errand tasks (pick-up etc.)

        if (order) {
            const payout = await RunnerPayout.findOne({ orderId: order.orderId });
            // Only enforce payout lock for run-errand tasks
            if (payout) {
                usedPayoutSystem = payout.usedPayoutSystem;
            }
        }

        if (usedPayoutSystem) {
            // Runner gets their delivery fee
            await runnerWallet.credit(
                escrow.runnerPayout,
                `delivery-payout-${escrowId}`,
                { escrowId, source: 'delivery_payout', orderId: escrow.taskId }
            );
            console.log(`Runner earned delivery fee: ₦${escrow.runnerPayout}`);
        } else {
            // Runner bypassed payout system — fee goes to platform
            console.warn(`Runner ${escrow.runnerId} did NOT use payout system — forfeiting delivery fee ₦${escrow.runnerPayout}`);
        }

        // Record platform fee regardless
        await PlatformEarnings.create({
            orderId: escrow.taskId,
            escrowId: escrow._id,
            amount: usedPayoutSystem ? escrow.platformFee : escrow.platformFee + escrow.runnerPayout,
            type: usedPayoutSystem ? 'platform_fee' : 'platform_fee_plus_forfeited_runner_fee',
            status: 'pending',
        });

        escrow.deliveryFeeReleased = true;
        escrow.status = escrow.itemBudgetReleased ? 'released' : escrow.status;
        await escrow.save();

        await Runner.findByIdAndUpdate(escrow.runnerId, {
            $inc: {
                totalEarnings: usedPayoutSystem ? escrow.runnerPayout : 0,
                completedOrders: 1,
            },
            activeOrderId: null,
            currentUserId: null,
        });

        console.log(`payoutToRunner complete | usedPayoutSystem: ${usedPayoutSystem} | runner: ₦${usedPayoutSystem ? escrow.runnerPayout : 0} | platform: ₦${usedPayoutSystem ? escrow.platformFee : escrow.platformFee + escrow.runnerPayout}`);

        return {
            runnerPayout: usedPayoutSystem ? escrow.runnerPayout : 0,
            platformFee: usedPayoutSystem ? escrow.platformFee : escrow.platformFee + escrow.runnerPayout,
            usedPayoutSystem,
        };
    }


    /**
 * Release item budget → creates RunnerPayout record
 * Called from handleApproveItems socket handler
 */
    async releaseItemBudget(escrowId) {
        const escrow = await Escrow.findById(escrowId);
        if (!escrow) throw new Error('Escrow not found');
        if (escrow.itemBudgetReleased) throw new Error('Item budget already released');

        const order = await Order.findOne({ escrowId: escrow._id })
            || await Order.findOne({ orderId: escrow.taskId });
        if (!order) throw new Error('Order not found for escrow');

        const existingPayout = await RunnerPayout.findOne({ orderId: order.orderId });
        if (!existingPayout) {
            await RunnerPayout.create({
                orderId: order.orderId,
                chatId: order.chatId,
                runnerId: escrow.runnerId,
                userId: escrow.userId,
                escrowId: escrow._id,
                itemBudget: escrow.itemBudget,
                status: 'pending',
            });
            console.log(`RunnerPayout created: ₦${escrow.itemBudget} for order ${order.orderId}`);
        }

        escrow.itemBudgetReleased = true;
        escrow.status = 'item_approved';
        await escrow.save();

        return { payoutCreated: true, itemBudget: escrow.itemBudget, orderId: order.orderId };
    }

    async lockWalletFunds(userId, amount, escrowId) {
        const wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < amount) {
            throw new Error('Insufficient balance for escrow');
        }

        wallet.balance -= amount;
        wallet.lockedBalance = (wallet.lockedBalance || 0) + amount;
        await wallet.save();

        console.log(`Locked ₦${amount} for escrow ${escrowId}`);
    }

    async unlockWalletFunds(userId, amount) {
        const wallet = await Wallet.findOne({ userId });
        wallet.lockedBalance = Math.max(0, (wallet.lockedBalance || 0) - amount);
        wallet.balance += amount;
        await wallet.save();
    }


    /**
 * Get bank code from bank name
 */
    async getBankCode(bankName) {
        try {
            const banks = await paystack.getBanks();
            const bank = banks.data.find(b =>
                b.name.toLowerCase().includes(bankName.toLowerCase())
            );

            if (!bank) {
                throw new Error(`Bank not found: ${bankName}`);
            }

            return bank.code;
        } catch (error) {
            console.error('Error getting bank code:', error);
            throw error;
        }
    }

    /**
     * Verify vendor account details
     */
    async verifyVendorAccount({ accountNumber, bankName }) {
        try {
            const bankCode = await this.getBankCode(bankName);
            const verification = await paystack.verifyAccountNumber({
                account_number: accountNumber,
                bank_code: bankCode
            });

            if (!verification.status || !verification.data) {
                throw new Error('Account verification failed');
            }

            return {
                accountName: verification.data.account_name,
                accountNumber: verification.data.account_number,
                bankCode: bankCode,
            };
        } catch (error) {
            console.error('Error verifying vendor account:', error);
            throw error;
        }
    }

    /**
     * Transfer item budget to vendor bank account
     * This is called when runner submits receipt with vendor bank details
     */
    async transferToVendor({
        amount,
        bankName,
        accountNumber,
        accountName,
        vendorName,
        orderId,
        runnerId
    }) {
        try {
            // 1. Verify account first
            const verified = await this.verifyVendorAccount({ accountNumber, bankName });

            if (verified.accountName.toLowerCase() !== accountName.toLowerCase()) {
                console.warn(`Account name mismatch: provided="${accountName}" vs verified="${verified.accountName}"`);
                // You can choose to throw error or proceed with verified name
            }

            // 2. Create transfer recipient
            const recipient = await paystack.createTransferRecipient({
                name: verified.accountName,
                account_number: accountNumber,
                bank_code: verified.bankCode
            });

            if (!recipient.status || !recipient.data) {
                throw new Error('Failed to create transfer recipient');
            }

            const recipientCode = recipient.data.recipient_code;

            // 3. Initiate transfer
            const transfer = await paystack.initiateTransfer({
                recipient_code: recipientCode,
                amount: amount, // amount in Naira (paystack config converts to kobo)
                reason: `Payment for items from ${vendorName} - Order ${orderId}`
            });

            if (!transfer.status || !transfer.data) {
                throw new Error('Transfer initiation failed');
            }

            console.log(`✅ Transfer initiated to ${vendorName}: ₦${amount} | ref: ${transfer.data.reference}`);

            return {
                success: true,
                reference: transfer.data.reference,
                transferId: transfer.data.id,
                transferCode: transfer.data.transfer_code,
                recipientCode: recipientCode,
                amount: amount,
                status: transfer.data.status, // 'pending', 'success', 'failed'
            };

        } catch (error) {
            console.error('❌ transferToVendor error:', error);
            return {
                success: false,
                error: error.message || 'Transfer failed',
            };
        }
    }

    /**
     * Upload receipt to Cloudinary
     */
    async uploadReceipt(base64String) {
        const cloudinary = require('../config/cloudinary');

        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(
                base64String,
                {
                    folder: 'payout-receipts',
                    resource_type: 'image',
                    transformation: [
                        { quality: 'auto', fetch_format: 'auto' }
                    ]
                },
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result.secure_url);
                }
            );
        });
    }

    /**
     * Submit payout receipt and process vendor transfer
     */
    async submitPayoutReceipt({
        orderId,
        runnerId,
        userId,
        chatId,
        vendorName,
        amountSpent,
        changeAmount,
        bankName,
        accountNumber,
        accountName,
        receiptBase64,
    }) {
        try {
            // 1. Get payout record
            const payout = await RunnerPayout.findOne({ orderId });
            if (!payout) {
                throw new Error('Payout record not found');
            }

            if (payout.status === 'submitted' || payout.status === 'approved') {
                throw new Error('Receipt already submitted for this order');
            }

            // 2. Check budget
            if (amountSpent > payout.itemBudget) {
                throw new Error(`Amount spent (₦${amountSpent}) exceeds budget (₦${payout.itemBudget})`);
            }

            // 3. Upload receipt
            const receiptUrl = await this.uploadReceipt(receiptBase64);

            // 4. Transfer to vendor
            const transferResult = await this.transferToVendor({
                amount: amountSpent,
                bankName,
                accountNumber,
                accountName,
                vendorName,
                orderId,
                runnerId,
            });

            if (!transferResult.success) {
                throw new Error(transferResult.error || 'Transfer to vendor failed');
            }

            // 5. Update payout record
            const receiptEntry = {
                receiptUrl,
                vendorName,
                amountSpent,
                changeAmount,
                submittedAt: new Date(),
                status: 'pending',
                transferReference: transferResult.reference,
                transferId: transferResult.transferId,
            };

            const updatedPayout = await RunnerPayout.findOneAndUpdate(
                { orderId, runnerId },
                {
                    $set: {
                        vendorName,
                        amountSpent,
                        changeAmount,
                        receiptUrl,
                        status: 'submitted',
                        submittedAt: new Date(),
                        usedPayoutSystem: true,
                        bankDetails: { bankName, accountNumber, accountName },
                        transferReference: transferResult.reference,
                        transferStatus: transferResult.status,
                    },
                    $push: { receiptHistory: receiptEntry },
                },
                { new: true }
            );

            // 6. Notify user via socket
            await this.notifyUserOfPayoutReceipt({
                chatId,
                userId,
                orderId,
                vendorName,
                amountSpent,
                changeAmount,
                receiptUrl,
                runnerId,
            });

            console.log(`✅ Payout receipt submitted: order=${orderId} vendor=${vendorName} amount=₦${amountSpent} ref=${transferResult.reference}`);

            return {
                success: true,
                payout: updatedPayout,
                transferReference: transferResult.reference,
                receiptUrl,
            };

        } catch (error) {
            console.error('❌ submitPayoutReceipt error:', error);
            throw error;
        }
    }

    /**
     * Notify user that runner submitted receipt (via socket)
     */
    async notifyUserOfPayoutReceipt({ chatId, userId, orderId, vendorName, amountSpent, changeAmount, receiptUrl, runnerId }) {
        try {

            const submissionId = `payout-receipt-${Date.now()}`;
            const message = {
                id: submissionId,
                type: 'item_submission',
                messageType: 'item_submission',
                senderId: runnerId,
                senderType: 'runner',
                chatId,
                submissionId,
                items: [{
                    name: `Shopping at ${vendorName}`,
                    quantity: 1,
                    price: amountSpent,
                    note: changeAmount > 0 ? `₦${changeAmount.toLocaleString()} change to be returned` : undefined,
                }],
                receiptUrl,
                totalAmount: amountSpent,
                vendorName,
                changeAmount,
                status: 'pending',
                time: new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }),
                createdAt: new Date(),
            };

            // Save to chat
            const chat = await Chat.findOne({ chatId });
            if (chat) {
                chat.messages.push(message);
                await chat.save();
            }

            // Emit to chat room and user
            const io = getSocketIO();
            if (io) {
                io.to(chatId).emit('message', message);
                io.to(`user-${userId}`).emit('payoutReceiptSubmitted', {
                    orderId,
                    vendorName,
                    amountSpent,
                    changeAmount,
                    receiptUrl,
                    submissionId,
                });
            } else {
                console.log('Socket not ready yet, notification will be sent when user reconnects');
            }

            console.log(`📨 Notified user ${userId} of payout receipt submission`);
        } catch (error) {
            console.error('Error notifying user of payout receipt:', error);
            // Don't throw - notification failure shouldn't fail the whole process
        }
    }
}

module.exports = new PaymentService();