module.exports = {
  // Wallet limits
  MAX_WALLET_FUNDING_PER_DAY: 500000,    // ₦500k per day
  MAX_SINGLE_TRANSACTION: 200000,         // ₦200k per transaction
  MIN_WITHDRAWAL: 100,                    // ₦100 minimum
  MAX_WITHDRAWAL_PER_DAY: 300000,         // ₦300k per day
  
  // KYC thresholds
  KYC_REQUIRED_AMOUNT: 100000,            // Require KYC above ₦100k
  
  // Fraud flags
  MAX_FAILED_PAYMENTS_PER_HOUR: 3,        // Flag after 3 failed payments
  MAX_DISPUTES_PER_USER: 5,               // Flag user after 5 disputes
};