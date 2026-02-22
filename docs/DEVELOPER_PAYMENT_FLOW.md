# Sendrey Payment Flow - Developer Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Payment Methods](#payment-methods)
3. [Escrow System](#escrow-system)
4. [API Endpoints](#api-endpoints)
5. [Socket Events](#socket-events)
6. [State Machine](#state-machine)
7. [Error Handling](#error-handling)
8. [Testing](#testing)

---

## Architecture Overview

### High-Level Flow
```
User Request → Runner Accept → Payment → Escrow Lock → Task Execution → Approval → Release
```

### Components
- **Frontend**: React (Redux for state management)
- **Backend**: Node.js + Express + MongoDB
- **Payment Provider**: Paystack
- **Real-time**: Socket.io
- **File Storage**: Cloudinary

---

## Payment Methods

### 1. Wallet Payment
Users can fund their wallet and pay directly from balance.

**Flow:**
```javascript
// 1. Fund wallet
POST /api/v1/payment/wallet/fund
Body: { amount: 10000, paymentMethod: 'card' }
Response: { reference, authorizationUrl }

// 2. User redirected to Paystack, completes payment

// 3. Webhook receives confirmation
POST /api/v1/payment/webhook
Body: { event: 'charge.success', data: { reference, amount } }

// 4. Wallet balance updated
Wallet.balance += amount
Transaction.create({ type: 'wallet_funding', amount, status: 'completed' })
```

**Code Example:**
```javascript
// Frontend: Fund wallet
const fundWallet = async (amount) => {
  const response = await api.post('/payment/wallet/fund', { 
    amount, 
    paymentMethod: 'card' 
  });
  
  // Open Paystack popup
  window.open(response.data.authorizationUrl, '_blank');
};

// Backend: Webhook handler
router.post('/webhook', async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
    
  if (hash !== req.headers['x-paystack-signature']) {
    return res.sendStatus(400);
  }
  
  const { event, data } = req.body;
  
  if (event === 'charge.success') {
    await Wallet.findOneAndUpdate(
      { userId: data.metadata.userId },
      { $inc: { balance: data.amount / 100 } }
    );
  }
  
  res.sendStatus(200);
});
```

### 2. Direct Card Payment
Pay directly for a task using card without pre-funding wallet.

**Flow:**
```javascript
// 1. Create payment intent
POST /api/v1/payment/intent
Body: { orderId, paymentMethod: 'card' }
Response: { reference, amount, authorizationUrl }

// 2. User completes payment on Paystack

// 3. Webhook confirms payment
// 4. Escrow created and funds locked
```

---

## Escrow System

### Escrow Lifecycle
```
pending → funded → item_approved → delivery_pending → released
                     ↓
                  disputed → resolved
```

### Creating Escrow

**Automatic Creation:**
Escrow is automatically created when payment is confirmed.
```javascript
// Backend: After payment verification
const escrow = await Escrow.create({
  taskId: order.orderId,
  orderId: order._id,
  userId: order.userId,
  runnerId: order.runnerId,
  taskType: order.taskType,
  
  // Amounts
  itemBudget: order.itemBudget,
  deliveryFee: order.deliveryFee,
  totalAmount: order.totalAmount,
  platformFee: order.platformFee,
  runnerPayout: order.runnerPayout,
  
  status: 'funded',
  paymentStatus: 'paid'
});

// Debit user wallet
await Wallet.findOneAndUpdate(
  { userId: order.userId },
  { $inc: { balance: -order.totalAmount } }
);
```

### Fee Calculation
```javascript
// Delivery fee = 20% of total task budget
const DELIVERY_FEE_PERCENTAGE = 0.20;
const totalBudget = itemBudget / (1 - DELIVERY_FEE_PERCENTAGE);
const deliveryFee = Math.round(totalBudget - itemBudget);

// Platform fee = 57% of delivery fee
const PLATFORM_FEE_PERCENTAGE = 0.57;
const platformFee = Math.round(deliveryFee * PLATFORM_FEE_PERCENTAGE);
const runnerPayout = deliveryFee - platformFee;

// Example:
// itemBudget: 5000
// totalBudget: 6250
// deliveryFee: 1250
// platformFee: 712.5 (rounded to 713)
// runnerPayout: 537.5 (rounded to 537)
```

### Releasing Funds

**Item Budget Release (Shopping Tasks Only):**
```javascript
// After user approves items
socket.on('approveItems', async (data) => {
  const { submissionId, escrowId, userId } = data;
  
  // Update escrow
  await Escrow.findByIdAndUpdate(escrowId, {
    itemBudgetReleased: true,
    itemsApprovedAt: new Date()
  });
  
  // Credit runner wallet
  const escrow = await Escrow.findById(escrowId);
  await Wallet.findOneAndUpdate(
    { userId: escrow.runnerId },
    { $inc: { balance: escrow.itemBudget } }
  );
  
  // Log transaction
  await Transaction.create({
    userId: escrow.runnerId,
    transactionType: 'item_budget_release',
    amount: escrow.itemBudget,
    status: 'completed'
  });
});
```

**Delivery Fee Release:**
```javascript
// After user confirms delivery
socket.on('confirmDelivery', async (data) => {
  const { orderId, userId } = data;
  
  const order = await Order.findOne({ orderId });
  const escrow = await Escrow.findById(order.escrowId);
  
  // Update escrow
  escrow.deliveryFeeReleased = true;
  escrow.deliveryConfirmedAt = new Date();
  escrow.status = 'released';
  await escrow.save();
  
  // Credit runner with delivery payout (after platform fee)
  await Wallet.findOneAndUpdate(
    { userId: escrow.runnerId },
    { $inc: { balance: escrow.runnerPayout } }
  );
  
  // Log transaction
  await Transaction.create({
    userId: escrow.runnerId,
    transactionType: 'payout',
    amount: escrow.runnerPayout,
    status: 'completed'
  });
});
```

---

## API Endpoints

### Payment Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/payment/intent` | ✅ | Create payment intent for order |
| POST | `/api/v1/payment/verify` | ✅ | Verify payment reference |
| POST | `/api/v1/payment/wallet/fund` | ✅ | Fund user wallet |
| POST | `/api/v1/payment/webhook` | ❌ | Paystack webhook handler |
| GET | `/api/v1/payment/wallet/balance` | ✅ | Get wallet balance |
| GET | `/api/v1/payment/wallet/transactions` | ✅ | Get transaction history |
| POST | `/api/v1/payment/wallet/withdraw` | ✅ | Withdraw from wallet (runners only) |

### Request/Response Examples

**Create Payment Intent:**
```http
POST /api/v1/payment/intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "ORD-ABC123",
  "paymentMethod": "wallet"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-ABC123",
    "amount": 6500,
    "paymentMethod": "wallet",
    "escrowId": "65f1a2b3c4d5e6f7g8h9i0j1",
    "message": "Payment successful"
  }
}
```

**Get Transaction History:**
```http
GET /api/v1/payment/wallet/transactions?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "65f...",
        "transactionType": "wallet_funding",
        "amount": 10000,
        "status": "completed",
        "createdAt": "2025-02-18T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

---

## Socket Events

### Payment Events

**Client → Server:**
```javascript
// Payment confirmed (emitted after Paystack success)
socket.emit('paymentSuccess', {
  orderId: 'ORD-ABC123',
  reference: 'pay_xyz789'
});
```

**Server → Client:**
```javascript
// Payment confirmed
socket.on('paymentConfirmed', (data) => {
  console.log(data);
  // {
  //   orderId: 'ORD-ABC123',
  //   escrowId: '65f...',
  //   status: 'paid'
  // }
});

// Order created (sent to runner after payment)
socket.on('orderCreated', (data) => {
  console.log(data);
  // {
  //   orderId: 'ORD-ABC123',
  //   escrowId: '65f...',
  //   totalAmount: 6500,
  //   taskType: 'shopping'
  // }
});
```

### Escrow Release Events
```javascript
// Server → Client: Item budget released
socket.on('itemBudgetReleased', (data) => {
  // { escrowId, amount, runnerId }
});

// Server → Client: Delivery fee released
socket.on('deliveryFeeReleased', (data) => {
  // { escrowId, amount, runnerId }
});
```

---

## State Machine

### Order Status Flow
```javascript
const VALID_TRANSITIONS = {
  'pending':          ['pending_payment', 'cancelled'],
  'pending_payment':  ['paid', 'cancelled'],
  'paid':             ['in_progress', 'disputed'],
  'in_progress':      ['items_submitted', 'delivered', 'disputed'],
  'items_submitted':  ['items_approved', 'in_progress', 'disputed'],
  'items_approved':   ['delivered', 'disputed'],
  'delivered':        ['completed', 'disputed'],
  'completed':        ['archived'],
  'disputed':         ['dispute_resolved'],
  'dispute_resolved': ['archived'],
  'archived':         [],
  'cancelled':        []
};
```

**Usage:**
```javascript
const orderStateMachine = require('./services/orderStateMachine');

// Transition with validation
await orderStateMachine.transition(orderId, 'paid', {
  triggeredBy: 'user',
  triggeredById: userId,
  note: 'Payment confirmed via wallet'
});

// This will throw if transition is invalid
// Error: Invalid transition: pending → completed
```

---

## Error Handling

### Payment Errors
```javascript
// Insufficient wallet balance
{
  "success": false,
  "error": "Insufficient wallet balance. Current: ₦1000, Required: ₦6500"
}

// Payment verification failed
{
  "success": false,
  "error": "Payment verification failed. Please contact support."
}

// Escrow creation failed
{
  "success": false,
  "error": "Failed to create escrow. Payment has been refunded."
}
```

### Frontend Error Handling
```javascript
try {
  const response = await api.post('/payment/intent', { 
    orderId, 
    paymentMethod: 'wallet' 
  });
  
  // Success
  showSuccessMessage(response.data.message);
  
} catch (error) {
  if (error.response?.status === 400) {
    // Client error - show to user
    showErrorMessage(error.response.data.error);
  } else if (error.response?.status === 500) {
    // Server error
    showErrorMessage('Something went wrong. Please try again.');
  } else {
    // Network error
    showErrorMessage('Connection error. Check your internet.');
  }
}
```

---

## Testing

### Unit Tests
```javascript
describe('Escrow Creation & Splitting', () => {
  test('platform fee is 57% of delivery fee', () => {
    const deliveryFee = 1500;
    const platformFee = Math.round(deliveryFee * 0.57); // 855
    const runnerPayout = deliveryFee - platformFee; // 645
    
    expect(platformFee).toBe(855);
    expect(runnerPayout).toBe(645);
  });
  
  test('delivery fee is 20% of total task budget', () => {
    const itemBudget = 5000;
    const totalBudget = itemBudget / (1 - 0.20); // 6250
    const deliveryFee = Math.round(totalBudget - itemBudget); // 1250
    
    expect(deliveryFee).toBe(1250);
    expect(deliveryFee / totalBudget).toBeCloseTo(0.20, 1);
  });
});
```

### Integration Tests
```javascript
describe('Payment Flow', () => {
  test('wallet payment creates escrow', async () => {
    // Fund wallet
    const wallet = await Wallet.create({ 
      userId: user._id, 
      balance: 10000 
    });
    
    // Create order
    const order = await Order.create({
      orderId: 'TEST-001',
      userId: user._id,
      runnerId: runner._id,
      totalAmount: 6500,
      status: 'pending_payment'
    });
    
    // Pay from wallet
    await paymentService.payForOrder(order.orderId, {
      paymentMethod: 'wallet',
      amount: 6500
    });
    
    // Verify escrow created
    const escrow = await Escrow.findOne({ taskId: order.orderId });
    expect(escrow).toBeDefined();
    expect(escrow.status).toBe('funded');
    
    // Verify wallet debited
    const updatedWallet = await Wallet.findOne({ userId: user._id });
    expect(updatedWallet.balance).toBe(3500);
  });
});
```

### Manual Testing Checklist

- [ ] Fund wallet with ₦10,000
- [ ] Create order with ₦6,500 total
- [ ] Pay from wallet - verify escrow created
- [ ] Runner submits items - verify item budget locked
- [ ] User approves items - verify runner receives item budget
- [ ] Runner marks delivered - verify escrow status changes
- [ ] User confirms delivery - verify runner receives delivery payout
- [ ] Check transaction history shows all movements
- [ ] Verify platform fee deducted correctly
- [ ] Test insufficient balance error
- [ ] Test payment failure scenario

---

## Security Considerations

### Webhook Verification
Always verify Paystack webhook signatures:
```javascript
const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  .update(JSON.stringify(req.body))
  .digest('hex');
  
if (hash !== req.headers['x-paystack-signature']) {
  return res.sendStatus(400);
}
```

### Rate Limiting
```javascript
const { checkTransactionLimits } = require('./middleware/transactionLimits');

router.post('/wallet/fund', 
  auth, 
  checkTransactionLimits, // ← Enforces daily limits
  paymentController.fundWallet
);
```

### Amount Validation
```javascript
// Always validate amounts match
if (paymentAmount !== order.totalAmount) {
  throw new Error('Payment amount mismatch');
}
```

---

## Troubleshooting

### Common Issues

**Issue: Escrow not created after payment**
- Check webhook logs for failures
- Verify payment reference in Transaction table
- Check if wallet was debited but escrow creation failed
- Solution: Manually create escrow and link to order

**Issue: Double payment**
- Check for duplicate payment references
- Verify idempotency in payment handler
- Solution: Refund duplicate payment

**Issue: Funds not released to runner**
- Check escrow status - should be `delivery_pending`
- Verify order status is `completed`
- Check if `deliveryFeeReleased` flag is true
- Solution: Manually trigger payout

---

## Additional Resources

- [Paystack API Documentation](https://paystack.com/docs/api/)
- [Socket.io Documentation](https://socket.io/docs/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)

---

**Last Updated:** February 18, 2025  
**Version:** 1.0.0  
**Contact:** dev@sendrey.com


<!-- issue, regsitration still goes on if fleettype was wrong for runner?  -->