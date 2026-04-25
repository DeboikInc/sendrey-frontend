const paystack = require('../config/paystack');
const orderStateMachine = require('../services/orderStateMachine');
const { notifyEscrowReleased } = require('./notificationService');
const { withTransaction } = require('../utils/withTransaction');
const { calculateFeeSplit } = require('../config/pricing');

const Wallet = require('../models/Wallet');
const Escrow = require('../models/Escrows');
const Order = require('../models/Order');
const User = require('../models/User');
const Runner = require('../models/Runner');
const RunnerPayout = require('../models/RunnerPayout');
const PlatformEarnings = require('../models/PlatformEarnings');
const LedgerEntry = require('../models/LedgerEntry');
const { Chat } = require('../models/Chat');

let ioInstance;
const getSocketIO = () => {
  if (ioInstance) return ioInstance;
  try {
    const socketModule = require('../socket');
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

class PaymentService {

  async createVirtualAccount(userId, email, fullName) {
    try {
      const customer = await paystack.createCustomer({
        email,
        first_name: fullName.split(' ')[0],
        last_name: fullName.split(' ').slice(1).join(' ') || fullName,
        metadata: { userId: userId.toString() }
      });

      const customerCode = customer.data.customer_code;

      const virtualAccount = await paystack.createDedicatedVirtualAccount({
        customer: customerCode,
        preferred_bank: process.env.NODE_ENV === 'production' ? 'wema-bank' : 'test-bank'
      });

      await User.findByIdAndUpdate(userId, {
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

  async payForOrder(orderId, paymentMethod, userId, userEmail) {
    const order = await Order.findOne({ orderId }).lean();
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'paid') throw new Error('Order already paid');

    const feeSplit = calculateFeeSplit(order.deliveryFee);

    if (paymentMethod === 'wallet') {
      // ── Pre-fetch wallet OUTSIDE transaction (read-only check) ──────────
      const walletCheck = await Wallet.findOne({ userId }).lean();
      if (!walletCheck || walletCheck.balance < order.totalAmount) {
        throw new Error('Insufficient wallet balance');
      }

      return withTransaction(async (session) => {
        // ── All writes in parallel where possible ────────────────────────
        const lockedOrder = await Order.findOneAndUpdate(
          { orderId, paymentStatus: { $ne: 'paid' } },
          { $set: { paymentStatus: 'processing' } },
          { new: true, session }
        );
        if (!lockedOrder) throw new Error('Order already paid or not found');

        // Wallet deduct + escrow create + ledger — wallet must go first
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet || wallet.balance < order.totalAmount) {
          throw new Error('Insufficient wallet balance');
        }

        wallet.balance -= order.totalAmount;
        wallet.lockedBalance = (wallet.lockedBalance || 0) + order.totalAmount;

        const escrowDoc = {
          taskId: orderId,
          userId: order.userId,
          runnerId: order.runnerId,
          taskType: order.taskType,
          itemBudget: order.itemBudget,
          deliveryFee: order.deliveryFee,
          totalAmount: order.totalAmount,
          platformFee: feeSplit.platformFee,
          runnerPayout: feeSplit.runnerPayout,
          providerFee: feeSplit.providerFee,
          netPlatformFee: feeSplit.netPlatformFee,
          status: 'funded',
          paymentStatus: 'paid',
        };

        // Fire wallet save + escrow create in parallel
        const [, [escrow]] = await Promise.all([
          wallet.save({ session }),
          Escrow.create([escrowDoc], { session }),
        ]);

        // Order update + ledger in parallel
        await Promise.all([
          Order.findOneAndUpdate(
            { orderId },
            { $set: { escrowId: escrow._id, paymentStatus: 'paid', status: 'paid' } },
            { session }
          ),
          LedgerEntry.create([{
            userId: order.userId,
            userModel: 'User',
            runnerId: order.runnerId,
            type: 'escrow_lock',
            grossAmount: order.totalAmount,
            netAmount: order.totalAmount - feeSplit.providerFee,
            providerFee: feeSplit.providerFee,
            platformFee: feeSplit.platformFee,
            netPlatformFee: feeSplit.netPlatformFee,
            runnerFee: feeSplit.runnerPayout,
            provider: 'wallet',
            orderId,
            escrowId: escrow._id,
            description: `Escrow funded via wallet for order ${orderId}`,
            status: 'completed',
          }], { session }),
        ]);

        return {
          escrowId: escrow._id,
          paymentStatus: 'paid',
          totalAmount: order.totalAmount,
          feeSplit,
        };
      });

    } else if (paymentMethod === 'card') {
      const paystackResponse = await paystack.initializeTransaction({
        email: userEmail,
        amount: order.totalAmount,
        metadata: { orderId, userId: userId.toString() },
      });

      return {
        reference: paystackResponse.data.reference,
        authorizationUrl: paystackResponse.data.authorization_url,
        amount: order.totalAmount,
        paymentStatus: 'pending',
        feeSplit,
      };
    }
  }

  async verifyPayment(reference) {
    const verification = await paystack.verifyTransaction(reference);

    if (!verification.status || verification.data.status !== 'success') {
      throw new Error('Payment verification failed');
    }

    const { orderId } = verification.data.metadata;

    const result = await withTransaction(async (session) => {

      const order = await Order.findOneAndUpdate(
        { orderId, paymentStatus: { $ne: 'paid' } },
        { $set: { paymentStatus: 'processing' } },
        { new: true, session }
      );
      if (!order) return { alreadyPaid: true };

      // Use the delivery fee stored on the order — set at creation using distance calc
      const feeSplit = calculateFeeSplit(order.deliveryFee);

      const [escrow] = await Escrow.create([{
        taskId: orderId,
        userId: order.userId,
        runnerId: order.runnerId,
        taskType: order.taskType,
        itemBudget: order.itemBudget,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        platformFee: feeSplit.platformFee,
        runnerPayout: feeSplit.runnerPayout,
        providerFee: feeSplit.providerFee,
        netPlatformFee: feeSplit.netPlatformFee,
        status: 'funded',
        paymentStatus: 'paid',
        paystackReference: reference,
      }], { session });

      await Order.findOneAndUpdate(
        { orderId },
        { $set: { escrowId: escrow._id, paymentStatus: 'paid', status: 'paid' } },
        { session }
      );

      await LedgerEntry.create([{
        userId: order.userId,
        userModel: 'User',
        runnerId: order.runnerId,
        type: 'escrow_lock',
        grossAmount: order.totalAmount,
        netAmount: order.totalAmount - feeSplit.providerFee,
        providerFee: feeSplit.providerFee,
        platformFee: feeSplit.platformFee,
        netPlatformFee: feeSplit.netPlatformFee,
        runnerFee: feeSplit.runnerPayout,
        provider: 'paystack',
        providerReference: reference,
        orderId,
        escrowId: escrow._id,
        description: `Escrow funded via card for order ${orderId}`,
        status: 'completed',
      }], { session });

      console.log(`✅ Card payment verified | runner: ₦${feeSplit.runnerPayout} | platform net: ₦${feeSplit.netPlatformFee} | paystack fee: ₦${feeSplit.providerFee}`);
      return { escrow, order, feeSplit };
    });

    // ← emit AFTER transaction commits
    if (!result.alreadyPaid) {
      const io = getSocketIO();
      if (io && result.order?.chatId) {
        io.to(result.order.chatId).emit('paymentSuccess', {
          orderId,
          escrowId: result.escrow._id,
          paymentStatus: 'paid',
        });
        console.log(`✅ paymentSuccess emitted to room ${result.order.chatId}`);
      }
    }

    return result;
  }

  async fundWallet(userId, amount, userEmail) {
    if (amount < 100) throw new Error('Minimum funding amount is ₦100');

    const paystackResponse = await paystack.initializeTransaction({
      email: userEmail,
      amount,
      metadata: { userId: userId.toString(), type: 'wallet_funding' }
    });

    console.log('✅ Wallet funding initialized');
    return {
      reference: paystackResponse.data.reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    };
  }

  async verifyWalletFunding(reference) {
    const verification = await paystack.verifyTransaction(reference);

    if (!verification.status || verification.data.status !== 'success') {
      throw new Error('Payment verification failed');
    }

    const { userId } = verification.data.metadata;
    const grossAmount = verification.data.amount / 100;

    return withTransaction(async (session) => {
      const existing = await LedgerEntry.findOne({ providerReference: reference }).session(session);
      if (existing) {
        console.warn(`verifyWalletFunding: duplicate webhook for ref ${reference}`);
        return { alreadyProcessed: true };
      }

      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) throw new Error('Wallet not found');

      wallet.balance += grossAmount;
      await wallet.save({ session });

      await LedgerEntry.create([{
        userId,
        userModel: 'User',
        type: 'deposit',
        grossAmount,
        netAmount: grossAmount,
        providerFee: 0,
        provider: 'paystack',
        providerReference: reference,
        description: `Wallet funded via Paystack`,
        status: 'completed',
      }], { session });

      console.log(`✅ Wallet funded: ₦${grossAmount} for user ${userId}`);
      return { balance: wallet.balance, amount: grossAmount };
    });
  }

  async lockWalletFunds(userId, amount, escrowId) {
    return withTransaction(async (session) => {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet || wallet.balance < amount) {
        throw new Error('Insufficient balance for escrow');
      }

      wallet.balance -= amount;
      wallet.lockedBalance = (wallet.lockedBalance || 0) + amount;
      await wallet.save({ session });

      console.log(`🔒 Locked ₦${amount} for escrow ${escrowId}`);
    });
  }

  async unlockWalletFunds(userId, amount) {
    return withTransaction(async (session) => {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) throw new Error('Wallet not found');

      wallet.lockedBalance = Math.max(0, (wallet.lockedBalance || 0) - amount);
      wallet.balance += amount;
      await wallet.save({ session });

      console.log(`Unlocked ₦${amount} for user ${userId}`);
    });
  }

  async payoutToRunner(escrowId) {
    return withTransaction(async (session) => {
      const escrow = await Escrow.findById(escrowId).session(session);
      if (!escrow) throw new Error('Escrow not found');

      console.log(`[payoutToRunner] escrowId=${escrowId} | runnerId=${escrow.runnerId} | taskId=${escrow.taskId}`);

      if (escrow.deliveryFeeReleased) throw new Error('Delivery fee already released');

      const runner = await Runner.findById(escrow.runnerId).session(session);
      if (!runner) throw new Error('Runner not found');

      let runnerWallet = await Wallet.findOne({
        userId: escrow.runnerId,
        userType: 'runner',
      }).session(session);

      if (!runnerWallet) {
        [runnerWallet] = await Wallet.create([{
          userId: escrow.runnerId,
          userType: 'runner',
          balance: 0,
          lockedBalance: 0,
        }], { session });
        console.log(`Created missing wallet for runner ${escrow.runnerId}`);
      }

      const order = await Order.findOne({
        $or: [{ escrowId: escrow._id }, { orderId: escrow.taskId }]
      }).session(session);

      console.log(`[payoutToRunner] order found=${!!order} | orderId=${order?.orderId} | serviceType=${order?.serviceType}`);

      let usedPayoutSystem = false;

      if (order) {
        if (order.serviceType === 'run-errand' || order.serviceType === 'run_errand') {
          const payout = await RunnerPayout.findOne({ orderId: order.orderId }).session(session);
          console.log(`[payoutToRunner] RunnerPayout found=${!!payout} | usedPayoutSystem=${payout?.usedPayoutSystem} | status=${payout?.status}`);
          if (payout) usedPayoutSystem = payout.usedPayoutSystem;
        } else {
          usedPayoutSystem = true;
          console.log(`[payoutToRunner] pick-up order — usedPayoutSystem forced true`);
        }
      } else {
        console.warn(`[payoutToRunner] NO ORDER FOUND for escrow ${escrowId}`);
      }

      // Use stored fee split from escrow; recalculate only as fallback
      const providerFee = escrow.providerFee ?? calculateFeeSplit(escrow.deliveryFee).providerFee;
      const netPlatformFee = escrow.netPlatformFee ?? (escrow.platformFee - providerFee);

      if (usedPayoutSystem) {
        runnerWallet.balance += escrow.runnerPayout;
        await runnerWallet.save({ session });
        console.log(`✅ Runner credited ₦${escrow.runnerPayout}`);
      } else {
        console.warn(`⚠️ Runner ${escrow.runnerId} forfeiting delivery fee ₦${escrow.runnerPayout}`);
      }

      await PlatformEarnings.create([{
        orderId: escrow.taskId,
        escrowId: escrow._id,
        amount: usedPayoutSystem
          ? netPlatformFee
          : netPlatformFee + escrow.runnerPayout,
        providerFee,
        type: usedPayoutSystem
          ? 'platform_fee'
          : 'platform_fee_plus_forfeited_runner_fee',
        status: 'pending',
      }], { session });

      await LedgerEntry.create([
        {
          userId: escrow.userId,
          userModel: 'User',
          runnerId: escrow.runnerId,
          type: 'escrow_release',
          grossAmount: escrow.runnerPayout,
          netAmount: escrow.runnerPayout,
          providerFee: 0,
          runnerFee: escrow.runnerPayout,
          provider: 'paystack',
          orderId: escrow.taskId,
          escrowId: escrow._id,
          description: `Delivery fee released to runner for order ${escrow.taskId}`,
          status: 'completed',
        },
        {
          userId: escrow.userId,
          userModel: 'User',
          type: 'platform_earning',
          grossAmount: escrow.platformFee,
          netAmount: netPlatformFee,
          providerFee,
          netPlatformFee,
          provider: 'paystack',
          orderId: escrow.taskId,
          escrowId: escrow._id,
          description: `Platform fee for order ${escrow.taskId}`,
          status: 'completed',
        },
        {
          userId: escrow.userId,
          userModel: 'User',
          type: 'provider_fee',
          grossAmount: providerFee,
          netAmount: providerFee,
          providerFee,
          provider: 'paystack',
          orderId: escrow.taskId,
          escrowId: escrow._id,
          description: `Paystack fee for order ${escrow.taskId}`,
          status: 'completed',
        },
      ], { session });

      escrow.deliveryFeeReleased = true;
      escrow.status = escrow.itemBudgetReleased ? 'released' : escrow.status;
      await escrow.save({ session });

      await Runner.findByIdAndUpdate(
        escrow.runnerId,
        {
          $inc: {
            totalEarnings: usedPayoutSystem ? escrow.runnerPayout : 0,
            completedOrders: 1,
          },
          activeOrderId: null,
          currentUserId: null,
        },
        { session }
      );

      console.log(`payoutToRunner | runner: ₦${usedPayoutSystem ? escrow.runnerPayout : 0} | platform net: ₦${netPlatformFee} | paystack fee: ₦${providerFee}`);

      return {
        runnerPayout: usedPayoutSystem ? escrow.runnerPayout : 0,
        platformFee: netPlatformFee,
        providerFee,
        usedPayoutSystem,
      };
    });
  }

  async releaseItemBudget(escrowId) {
    return withTransaction(async (session) => {
      const escrow = await Escrow.findById(escrowId).session(session);
      if (!escrow) throw new Error('Escrow not found');
      if (escrow.itemBudgetReleased) throw new Error('Item budget already released');

      const order = await Order.findOne({
        $or: [{ escrowId: escrow._id }, { orderId: escrow.taskId }]
      }).session(session);
      if (!order) throw new Error('Order not found for escrow');

      const existingPayout = await RunnerPayout.findOne({ orderId: order.orderId }).session(session);

      if (!existingPayout) {
        await RunnerPayout.create([{
          orderId: order.orderId,
          chatId: order.chatId,
          runnerId: escrow.runnerId,
          userId: escrow.userId,
          escrowId: escrow._id,
          itemBudget: escrow.itemBudget,
          status: 'pending',
          usedPayoutSystem: false,
        }], { session });

        await LedgerEntry.create([{
          userId: escrow.userId,
          userModel: 'User',
          runnerId: escrow.runnerId,
          type: 'item_budget',
          grossAmount: escrow.itemBudget,
          netAmount: escrow.itemBudget,
          providerFee: 0,
          provider: 'system',
          orderId: order.orderId,
          escrowId: escrow._id,
          description: `Item budget of ₦${escrow.itemBudget} released for order ${order.orderId}`,
          status: 'completed',
        }], { session });

        console.log(`RunnerPayout created: ₦${escrow.itemBudget} for order ${order.orderId}`);
      }

      escrow.itemBudgetReleased = true;
      escrow.status = 'item_approved';
      await escrow.save({ session });

      return {
        payoutCreated: !existingPayout,
        itemBudget: escrow.itemBudget,
        orderId: order.orderId,
      };
    });
  }

  async getBankCode(bankName) {
    const banks = await paystack.getBanks();
    const bank = banks.data.find(b => b.name.toLowerCase().includes(bankName.toLowerCase()));
    if (!bank) throw new Error(`Bank not found: ${bankName}`);
    return bank.code;
  }

  async verifyVendorAccount({ accountNumber, bankName }) {
    const bankCode = await this.getBankCode(bankName);
    const verification = await paystack.verifyAccountNumber({ account_number: accountNumber, bank_code: bankCode });

    if (!verification.status || !verification.data) {
      throw new Error('Account verification failed');
    }

    return {
      accountName: verification.data.account_name,
      accountNumber: verification.data.account_number,
      bankCode,
    };
  }

  async transferToVendor({ amount, bankName, accountNumber, accountName, vendorName, orderId, runnerId }) {
    // ── DEV MOCK ───────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  transferToVendor: DEV mock — skipping real Paystack transfer');
      return {
        success: true,
        reference: `mock-ref-${Date.now()}`,
        transferId: `mock-id-${Date.now()}`,
        transferCode: `mock-code-${Date.now()}`,
        recipientCode: `mock-recipient-${Date.now()}`,
        amount,
        status: 'success',
      };
    }
    // ── PRODUCTION ─────────────────────────────────────────

    try {
      const verified = await this.verifyVendorAccount({ accountNumber, bankName });

      if (verified.accountName.toLowerCase() !== accountName.toLowerCase()) {
        console.warn(`Account name mismatch: provided="${accountName}" vs verified="${verified.accountName}"`);
      }

      const recipient = await paystack.createTransferRecipient({
        name: verified.accountName,
        account_number: accountNumber,
        bank_code: verified.bankCode,
      });
      if (!recipient.status || !recipient.data) throw new Error('Failed to create transfer recipient');

      const transfer = await paystack.initiateTransfer({
        recipient_code: recipient.data.recipient_code,
        amount,
        reason: `Payment for items from ${vendorName} - Order ${orderId}`,
      });
      if (!transfer.status || !transfer.data) throw new Error('Transfer initiation failed');

      console.log(`Transfer initiated to ${vendorName}: ₦${amount} | ref: ${transfer.data.reference}`);

      return {
        success: true,
        reference: transfer.data.reference,
        transferId: transfer.data.id,
        transferCode: transfer.data.transfer_code,
        recipientCode: recipient.data.recipient_code,
        amount,
        status: transfer.data.status,
      };
    } catch (error) {
      console.error('❌ transferToVendor error:', error);
      return { success: false, error: error.message || 'Transfer failed' };
    }
  }

  async uploadReceipt(base64String) {
    const cloudinary = require('../config/cloudinary');
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        base64String,
        {
          folder: 'payout-receipts',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result.secure_url);
        }
      );
    });
  }

  async getTransactionHistory(userId, page = 1, limit = 20) {

    console.log('getTransactionHistory userId:', userId, typeof userId);

    const skip = (page - 1) * limit;
    const hiddenTypes = ['platform_earning', 'provider_fee', 'escrow_release'];

    const entries = await LedgerEntry.find({
      userId: userId.toString(),
      type: { $nin: hiddenTypes }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await LedgerEntry.countDocuments({
      userId,
      type: { $nin: hiddenTypes },
    });
    console.log('Total ledger entries for user:', total);

    return {
      transactions: entries.map(e => ({
        ...e,
        amount: e.grossAmount,
        type: e.type === 'deposit' || e.type === 'escrow_release'
          ? 'credit'
          : 'debit',
        label: e.type === 'escrow_lock'
          ? 'Order Payment'
          : e.type === 'deposit'
            ? 'Wallet Funding'
            : e.type === 'escrow_release'
              ? 'Delivery Fee'
              : e.type === 'item_budget'
                ? 'Item Budget'
                : e.type,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    };
  }

  async submitPayoutReceipt({
    orderId, runnerId, userId, chatId,
    vendorName, amountSpent, changeAmount,
    bankName, accountNumber, accountName, receiptBase64,
  }) {
    const payout = await RunnerPayout.findOne({ orderId });
    if (!payout) throw new Error('Payout record not found');
    if (payout.status === 'submitted' || payout.status === 'approved') {
      throw new Error('Receipt already submitted for this order');
    }
    if (amountSpent > payout.itemBudget) {
      throw new Error(`Amount spent (₦${amountSpent}) exceeds budget (₦${payout.itemBudget})`);
    }

    const receiptUrl = await this.uploadReceipt(receiptBase64);

    const transferResult = await this.transferToVendor({
      amount: amountSpent, bankName, accountNumber,
      accountName, vendorName, orderId, runnerId,
    });
    if (!transferResult.success) throw new Error(transferResult.error || 'Transfer to vendor failed');

    const result = await withTransaction(async (session) => {
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
            vendorName, amountSpent, changeAmount, receiptUrl,
            status: 'submitted',
            submittedAt: new Date(),
            usedPayoutSystem: true,
            bankDetails: { bankName, accountNumber, accountName },
            transferReference: transferResult.reference,
            transferStatus: transferResult.status,
          },
          $push: { receiptHistory: receiptEntry },
        },
        { new: true, session }
      );

      console.log(`✅ Payout receipt submitted: order=${orderId} vendor=${vendorName} amount=₦${amountSpent} ref=${transferResult.reference}`);

      return {
        success: true,
        payout: updatedPayout,
        transferReference: transferResult.reference,
        receiptUrl,
      };
    });

    await this.notifyUserOfPayoutReceipt({
      chatId, userId, orderId, vendorName,
      amountSpent, changeAmount, receiptUrl, runnerId,
    }).catch(err => console.error('notifyUserOfPayoutReceipt failed (non-critical):', err.message));

    return result;
  }

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
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        createdAt: new Date(),
      };

      const chat = await Chat.findOne({ chatId });
      if (chat) {
        chat.messages.push(message);
        await chat.save();
      }

      const io = getSocketIO();
      if (io) {
        io.to(chatId).emit('message', message);
        io.to(`user-${userId}`).emit('payoutReceiptSubmitted', {
          orderId, vendorName, amountSpent, changeAmount, receiptUrl, submissionId,
        });
      }

      console.log(`Notified user ${userId} of payout receipt submission`);
    } catch (error) {
      console.error('Error notifying user of payout receipt:', error);
    }
  }

  async withdrawFromWallet(runnerId, amount, bankDetails, options = {}) {
    return withTransaction(async (session) => {
      const wallet = await Wallet.findOne({ userId: runnerId, userType: 'runner' }).session(session);
      if (!wallet) throw new Error('Wallet not found');
      if (wallet.balance < amount) throw new Error('Insufficient wallet balance');

      // Verify bank account before deducting
      const verification = await paystack.verifyAccountNumber({
        account_number: bankDetails.accountNumber,
        bank_code: bankDetails.bankCode,
      });
      if (!verification.status || !verification.data) {
        throw new Error('Bank account verification failed');
      }

      // Deduct from wallet
      wallet.balance -= amount;
      await wallet.save({ session });

      // Create transfer recipient
      const recipient = await paystack.createTransferRecipient({
        name: verification.data.account_name,
        account_number: bankDetails.accountNumber,
        bank_code: bankDetails.bankCode,
      });
      if (!recipient.status || !recipient.data) throw new Error('Failed to create transfer recipient');

      // Initiate transfer
      const transfer = await paystack.initiateTransfer({
        recipient_code: recipient.data.recipient_code,
        amount,
        reason: `Sendrey runner withdrawal`,
      });
      if (!transfer.status || !transfer.data) throw new Error('Transfer initiation failed');

      // Ledger entry
      await LedgerEntry.create([{
        userId: runnerId,
        userModel: 'Runner',
        type: 'withdrawal',
        grossAmount: amount,
        netAmount: amount,
        providerFee: 0,
        provider: 'paystack',
        providerReference: transfer.data.reference,
        description: `Withdrawal to ${bankDetails.accountName || verification.data.account_name} - ${bankDetails.bankCode}`,
        status: 'completed',
      }], { session });

      console.log(`✅ Runner ${runnerId} withdrawal: ₦${amount} | ref: ${transfer.data.reference}`);

      return {
        reference: transfer.data.reference,
        transferCode: transfer.data.transfer_code,
        amount,
        status: transfer.data.status,
      };
    });
  }
}

module.exports = new PaymentService();