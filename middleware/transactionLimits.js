// const Transaction = require('../models/Transaction');
const { 
  MAX_WALLET_FUNDING_PER_DAY, 
  MAX_SINGLE_TRANSACTION,
  MAX_WITHDRAWAL_PER_DAY,
  MAX_FAILED_PAYMENTS_PER_HOUR,
  KYC_REQUIRED_AMOUNT
} = require('../config/limits');

// const checkTransactionLimits = async (req, res, next) => {
//   try {
//     const userId = req.user._id;
//     const { amount, type } = req.body;

//     if (!amount) return next();

//     // Single transaction limit
//     if (amount > MAX_SINGLE_TRANSACTION) {
//       return res.status(400).json({
//         error: `Transaction limit exceeded. Maximum single transaction is ₦${MAX_SINGLE_TRANSACTION.toLocaleString()}`
//       });
//     }

//     // KYC check for high value
//     if (amount >= KYC_REQUIRED_AMOUNT) {
//       const user = await require('../models/User').findById(userId);
//       if (!user?.kycVerified) {
//         return res.status(403).json({
//           error: 'KYC verification required for transactions above ₦100,000',
//           requiresKyc: true
//         });
//       }
//     }

//     // Daily limits
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     if (type === 'wallet_funding' || req.path.includes('fund')) {
//       const todayFunding = await Transaction.aggregate([
//         {
//           $match: {
//             userId,
//             transactionType: 'wallet_funding',
//             status: 'completed',
//             createdAt: { $gte: today }
//           }
//         },
//         { $group: { _id: null, total: { $sum: '$amount' } } }
//       ]);

//       const totalToday = todayFunding[0]?.total || 0;

//       if (totalToday + amount > MAX_WALLET_FUNDING_PER_DAY) {
//         return res.status(400).json({
//           error: `Daily funding limit reached. Maximum ₦${MAX_WALLET_FUNDING_PER_DAY.toLocaleString()} per day.`
//         });
//       }
//     }

//     if (req.path.includes('withdraw')) {
//       const todayWithdrawals = await Transaction.aggregate([
//         {
//           $match: {
//             userId,
//             transactionType: 'withdrawal',
//             status: { $in: ['completed', 'pending'] },
//             createdAt: { $gte: today }
//           }
//         },
//         { $group: { _id: null, total: { $sum: '$amount' } } }
//       ]);

//       const totalToday = todayWithdrawals[0]?.total || 0;

//       if (totalToday + amount > MAX_WITHDRAWAL_PER_DAY) {
//         return res.status(400).json({
//           error: `Daily withdrawal limit reached. Maximum ₦${MAX_WITHDRAWAL_PER_DAY.toLocaleString()} per day.`
//         });
//       }
//     }

//     next();

//   } catch (error) {
//     console.error('Transaction limit check error:', error);
//     next(); // Don't block on limit check errors
//   }
// };

// Flag suspicious activity
// const checkFraudIndicators = async (userId, type) => {
//   try {
//     const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

//     if (type === 'payment_failed') {
//       const recentFailures = await Transaction.countDocuments({
//         userId,
//         status: 'failed',
//         createdAt: { $gte: oneHourAgo }
//       });

//       if (recentFailures >= MAX_FAILED_PAYMENTS_PER_HOUR) {
//         console.warn(`🚨 FRAUD FLAG: User ${userId} has ${recentFailures} failed payments in 1 hour`);
//         // TODO: notify admin, temporarily lock account
//         return true;
//       }
//     }

//     return false;
//   } catch (error) {
//     console.error('Fraud check error:', error);
//     return false;
//   }
// };

// module.exports = { checkTransactionLimits, checkFraudIndicators };