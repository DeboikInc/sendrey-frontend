const Order = require('../models/Order');

// Valid transitions map
const VALID_TRANSITIONS = {
  'pending': ['payment_pending', 'cancelled'],
  'pending_payment': ['paid', 'in_progress', 'items_submitted', 'cancelled'], // mock payment skips steps
  'paid': ['in_progress', 'items_submitted', 'disputed', 'cancelled'],           // items_submitted if in_progress skipped
  'in_progress': ['items_submitted', 'delivered', 'disputed'],
  'items_submitted': ['items_approved', 'in_progress', 'disputed'],            // in_progress = rejected, resubmit
  'items_approved': ['delivered', 'disputed'],
  'delivered': ['completed', 'disputed', 'in_progress'],
  'completed': ['archived', 'disputed'],
  'disputed': ['dispute_resolved'],
  'dispute_resolved': ['archived'],
  'archived': [], // terminal state
  'cancelled': [], // terminal state
};

// Timestamp map - which field to set for each status
const STATUS_TIMESTAMPS = {
  'paid': 'timestamps.paidAt',
  'in_progress': 'timestamps.acceptedAt',
  'items_submitted': 'timestamps.itemsSubmittedAt',
  'items_approved': 'timestamps.itemsApprovedAt',
  'delivered': 'timestamps.deliveredAt',
  'completed': 'timestamps.completedAt',
  'disputed': 'timestamps.disputedAt',
  'archived': 'timestamps.archivedAt',
  'pending_payment': 'timestamps.paidAt',
};

/**
 * Transition order to a new status with validation
 */
const transition = async (orderId, newStatus, {
  triggeredBy = 'system',
  triggeredById = null,
  note = null
} = {}) => {

  const order = await Order.findOne({ orderId }).sort({ createdAt: -1 });
  if (!order) throw new Error(`Order ${orderId} not found`);

  const currentStatus = order.status;
  const validNext = VALID_TRANSITIONS[currentStatus] || [];

  // Same-state retry — treat as no-op so a failed upload retry doesn't blow up
  if (currentStatus === newStatus) {
    console.log(`⏭️  Order ${orderId}: already in '${newStatus}', skipping transition`);
    return order;
  }

  // Validate transition
  if (!validNext.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${currentStatus} → ${newStatus}. ` +
      `Allowed: ${validNext.join(', ') || 'none (terminal state)'}`
    );
  }

  // Build update
  const historyEntry = {
    status: newStatus,
    timestamp: new Date(),
    triggeredBy,
    triggeredById: triggeredById?.toString() || null,
    note
  };

  const update = {
    status: newStatus,
    $push: { statusHistory: historyEntry }
  };

  // Set timestamp field if applicable
  const timestampField = STATUS_TIMESTAMPS[newStatus];
  if (timestampField) {
    update[timestampField] = new Date();
  }

  const updatedOrder = await Order.findOneAndUpdate(
    { orderId },
    update,
    { new: true }
  );

  console.log(`✅ Order ${orderId}: ${currentStatus} → ${newStatus} (by ${triggeredBy})`);
  return updatedOrder;
};

/**
 * Check if a transition is valid without executing it
 */
const canTransition = (currentStatus, newStatus) => {
  const validNext = VALID_TRANSITIONS[currentStatus] || [];
  return validNext.includes(newStatus);
};

/**
 * Get current valid next states for an order
 */
const getValidNextStates = (currentStatus) => {
  return VALID_TRANSITIONS[currentStatus] || [];
};

/**
 * Archive completed/resolved orders (run as cron job)
 */
const archiveOldOrders = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const ordersToArchive = await Order.find({
    status: { $in: ['completed', 'dispute_resolved'] },
    updatedAt: { $lt: thirtyDaysAgo }
  });

  let archived = 0;
  for (const order of ordersToArchive) {
    try {
      await transition(order.orderId, 'archived', {
        triggeredBy: 'system',
        note: 'Auto-archived after 30 days'
      });
      archived++;
    } catch (err) {
      console.error(`Failed to archive order ${order.orderId}:`, err.message);
    }
  }

  console.log(`✅ Archived ${archived} orders`);
  return archived;
};

module.exports = {
  transition,
  canTransition,
  getValidNextStates,
  archiveOldOrders,
  VALID_TRANSITIONS
};