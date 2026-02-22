/**
 * platformSettlementCron.js
 * 
 * Runs daily at midnight — sweeps all pending platform earnings
 * and transfers them to your Paystack account via bulk transfer.
 * 
 * Setup in app.js:
 *   const { startPlatformSettlementCron } = require('./cron/platformSettlementCron');
 *   startPlatformSettlementCron();
 */

const cron = require('node-cron');
const PlatformEarnings = require('../models/PlatformEarnings');
const paystack = require('../config/paystack');

// Your platform's Paystack recipient code
// Get this by creating a transfer recipient on Paystack dashboard
// or via API: POST https://api.paystack.co/transferrecipient
const PLATFORM_RECIPIENT_CODE = process.env.PLATFORM_PAYSTACK_RECIPIENT_CODE;
const PLATFORM_BANK_ACCOUNT = process.env.PLATFORM_BANK_ACCOUNT; // for logging

const settlePlatformEarnings = async () => {
  console.log(' Platform settlement cron started...');

  try {
    // Get all unsettled platform earnings
    const pending = await PlatformEarnings.find({ status: 'pending' });

    if (pending.length === 0) {
      console.log('No pending platform earnings to settle.');
      return;
    }

    const totalAmount = pending.reduce((sum, e) => sum + e.amount, 0);
    console.log(`Found ${pending.length} pending earnings totalling ₦${totalAmount.toLocaleString()}`);

    if (totalAmount < 100) {
      console.log('Total too small to transfer (min ₦100). Skipping.');
      return;
    }

    if (!PLATFORM_RECIPIENT_CODE) {
      console.error('PLATFORM_PAYSTACK_RECIPIENT_CODE not set in env. Skipping transfer.');
      return;
    }

    // Initiate Paystack transfer
    const transfer = await paystack.initiateTransfer({
      source: 'balance',
      recipient: PLATFORM_RECIPIENT_CODE,
      amount: totalAmount * 100, // Paystack uses kobo
      reason: `Platform fees settlement - ${new Date().toISOString().split('T')[0]} - ${pending.length} orders`,
      currency: 'NGN',
    });

    const transferCode = transfer?.data?.transfer_code || null;

    // Mark all as settled
    const ids = pending.map(e => e._id);
    await PlatformEarnings.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'settled',
          settledAt: new Date(),
          paystackTransferCode: transferCode,
        }
      }
    );

    console.log(`✅ Platform settlement complete: ₦${totalAmount.toLocaleString()} transferred. Code: ${transferCode}`);

  } catch (error) {
    console.error('❌ Platform settlement cron failed:', error.message);
    // Don't throw — cron should keep running
  }
};

const startPlatformSettlementCron = () => {
  // Runs every day at midnight
  cron.schedule('0 0 * * *', settlePlatformEarnings, {
    timezone: 'Africa/Lagos'
  });

  console.log('Platform settlement cron scheduled (daily midnight Lagos time)');
};

// Allow manual trigger for testing
const runSettlementNow = settlePlatformEarnings;

module.exports = { startPlatformSettlementCron, runSettlementNow };

// create a transfer recipient on Paystack dashboard under Transfers → Recipients,