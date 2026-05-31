/**
 * disputeReasons.js
 * utils/disputeReasons.js
 *
 * Single source of truth for Sendrey dispute reasons.
 * Used by:
 *  - DisputeForm          (show/hide reasons based on live order status)
 *  - DisputeRaisedMessage (display human-readable label for a saved reason)
 *  - Disputes.jsx         (runner-side form, same filtering)
 *  - disputeController    (server-side per-reason validation)
 *
 * Run-errand status flow:
 *   accepted → runner_en_route_to_vendor → arrived_at_vendor
 *   → purchase_completed  ← vendor paid; item-level disputes close here
 *   → en_route_to_delivery → arrived_at_delivery_location
 *   → delivered → task_completed → completed
 *
 * Pick-up status flow (no vendor payment step):
 *   accepted → arrived_at_pickup_location
 *   → item_collected → en_route_to_delivery → arrived_at_delivery_location
 *   → delivered → task_completed → completed
 *
 * windowClosesAfter: the statuses AFTER which this reason is no longer
 * actionable — i.e. admin cannot do anything meaningful about it anymore.
 *
 * windowOpensAt: optional — the status at which this reason first becomes
 * relevant. getAvailableReasons filters it out before that point.
 */

const RUN_ERRAND_REASONS = [
  {
    value: 'item_damaged_in_transit',
    label: 'Item damaged in transit',
    description: 'Item arrived visibly damaged after collection',
    windowOpensAt: 'item_delivered',
    windowClosesAfter: [],
  },
  {
    value: 'runner_misconduct',
    label: 'Runner misconduct',
    description: 'Unprofessional, threatening, or abusive behaviour',
    windowClosesAfter: [],
  },
  {
    value: 'runner_unresponsive',
    label: 'Runner went offline / unresponsive',
    description: 'Runner stopped communicating mid-order',
    windowClosesAfter: [
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    windowClosesAfter: [
      'completed',
    ],
  },
];

// ─── USER reasons for pick-up orders ────────────────────────────────────────
// Payment is not part of the pick-up flow, so item_not_collected and
// wrong_item_collected are always available from the start.

const PICK_UP_REASONS = [
  {
    value: 'item_not_collected',
    label: 'Item not collected',
    description: 'Runner claimed to collect but item was not picked up',
    windowOpensAt: 'item_collected',
    // Once runner is en route they physically have the item — moot to dispute
    windowClosesAfter: [
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'wrong_item_collected',
    label: 'Wrong item collected',
    description: 'Runner picked up a different item from the specified location',
    windowOpensAt: 'item_collected',
    windowClosesAfter: [
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'item_damaged_in_transit',
    label: 'Item damaged in transit',
    description: 'Item arrived visibly damaged after collection',
    windowOpensAt: 'item_delivered',
    windowClosesAfter: [
      'completed',
    ],
  },
  {
    value: 'runner_misconduct',
    label: 'Runner misconduct',
    description: 'Unprofessional, threatening, or abusive behaviour',
    windowClosesAfter: [],
  },
  {
    value: 'runner_unresponsive',
    label: 'Runner went offline / unresponsive',
    description: 'Runner stopped communicating mid-order',
    // If task completed the runner wasn't unresponsive enough to matter
    windowClosesAfter: [
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    windowClosesAfter: [],
  },
];

// ─── RUNNER reasons for pick-up orders ───────────────────────────────────────
// Runners can raise disputes when users obstruct or make the order unsafe.
// windowOpensAt: the status at which this reason first becomes actionable.
// Reasons without windowOpensAt are available immediately.

const RUNNER_PICK_UP_REASONS = [
  {
    value: 'user_wont_confirm_delivery',
    label: 'User refusing to confirm delivery',
    description: 'Item was delivered but user is withholding confirmation',
    // Only relevant once runner has marked delivered
    windowOpensAt: 'item_delivered',
    windowClosesAfter: [
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'wrong_item_given_by_sender',
    label: 'Wrong item given by sender',
    description: 'The item at pickup did not match the order description',
    // Closes once en route — runner accepted and carried it, no longer actionable
    windowClosesAfter: [
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'item_delivered',
      'delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'dangerous_pickup_location',
    label: 'Unsafe or dangerous pickup location',
    description: 'The pickup location was unsafe, inaccessible, or posed a risk to the runner',
    windowClosesAfter: [
      'picked_up',
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'item_delivered',
      'delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'dangerous_delivery_location',
    label: 'Unsafe or dangerous delivery location',
    description: 'The delivery location was unsafe, inaccessible, or posed a risk to the runner',
    // Only relevant once en route to delivery
    windowOpensAt: 'en_route_to_delivery',
    windowClosesAfter: [
      'item_delivered',
      'delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'user_misconduct',
    label: 'User misconduct',
    description: 'User was abusive, threatening, or acted in bad faith during the order',
    windowClosesAfter: [],
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    windowClosesAfter: [],
  },
];

// ─── RUNNER reasons for run-errand orders ────────────────────────────────────

const RUNNER_RUN_ERRAND_REASONS = [
  {
    value: 'user_wont_confirm_delivery',
    label: 'User refusing to confirm delivery',
    description: 'Item was delivered but user is withholding confirmation',
    windowOpensAt: 'item_delivered',
    windowClosesAfter: [
      'task_completed',
      'completed',
    ],
  },

  {
    value: 'user_misconduct',
    label: 'User misconduct',
    description: 'User was abusive, threatening, or acted in bad faith during the order',
    windowClosesAfter: [],
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    windowClosesAfter: [],
  },
];

// ─── Exports ─────────────────────────────────────────────────────────────────

export const DISPUTE_REASONS = {
  'run-errand': RUN_ERRAND_REASONS,
  'pick-up': PICK_UP_REASONS,
};

export const RUNNER_DISPUTE_REASONS = {
  'run-errand': RUNNER_RUN_ERRAND_REASONS,
  'pick-up': RUNNER_PICK_UP_REASONS,
};

const CHAT_FLOW_STATUSES = [
  'accepted',
  'shopping',
  'items_submitted',
  'items_approved',
  // run-errand flow
  'arrived_at_market',
  'purchase_in_progress',
  'purchase_completed',
  // pick-up flow
  'arrived_at_pickup_location',
  'item_collected',
  // shared delivery flow
  'en_route_to_delivery',
  'arrived_at_delivery_location',
  'item_delivered',
  'task_completed',
];



/** Normalise the loose serviceType strings your DB/socket may emit */
export function normaliseServiceType(serviceType = '') {
  const s = (serviceType ?? '').toLowerCase();
  if (s.includes('errand')) return 'run-errand';
  if (s.includes('pick')) return 'pick-up';
  return null;
}

/**
 * Returns user-side reasons still actionable at the given order status.
 * Used by DisputeForm and Disputes.jsx to filter the visible list.
*/
export function getAvailableReasons(serviceType, orderStatus) {
  const type = normaliseServiceType(serviceType);
  if (!type) return [];

  const currentIdx = CHAT_FLOW_STATUSES.indexOf(orderStatus);
  if (currentIdx === -1) {
    console.warn('[getAvailableReasons] Unrecognised orderStatus:', orderStatus);
  }

  return (DISPUTE_REASONS[type] ?? []).filter((r) => {
    if (r.windowClosesAfter.includes(orderStatus)) return false;
    if (r.windowOpensAt) {
      const opensIdx = CHAT_FLOW_STATUSES.indexOf(r.windowOpensAt);
      if (currentIdx < opensIdx) return false;
    }
    return true;
  });
}


/**
 * Returns runner-side reasons still actionable at the given order status.
 * Respects both windowOpensAt and windowClosesAfter.
 * Used by Disputes.jsx (runner screen).
*/
export function getAvailableRunnerReasons(serviceType, orderStatus, options = {}) {
  const { deliveryDisputeWindowOpen = false } = options;
  const type = normaliseServiceType(serviceType);
  if (!type) return [];

  const currentIdx = CHAT_FLOW_STATUSES.indexOf(orderStatus);
  if (currentIdx === -1) {
    console.warn('[getAvailableRunnerReasons] Unrecognised orderStatus:', orderStatus);
  }

  return (RUNNER_DISPUTE_REASONS[type] ?? []).filter((r) => {
    if (r.value === 'user_wont_confirm_delivery' && !deliveryDisputeWindowOpen) return false;
    if (r.windowClosesAfter.includes(orderStatus)) return false;
    if (r.windowOpensAt) {
      const opensIdx = CHAT_FLOW_STATUSES.indexOf(r.windowOpensAt);
      if (currentIdx < opensIdx) return false;
    }
    return true;
  });
}


/**
 * Returns the human-readable label for a saved reason value.
 * Works across all service types and both user runner reasons.
 */
export function getReasonLabel(reasonValue) {
  const all = [
    ...RUN_ERRAND_REASONS,
    ...PICK_UP_REASONS,
    ...RUNNER_PICK_UP_REASONS,
    ...RUNNER_RUN_ERRAND_REASONS,
  ];
  // dedupe by value — first match wins
  return all.find((r) => r.value === reasonValue)?.label ?? reasonValue;
}

/**
 * Returns true if a specific user-side reason is still valid for the given status.
 * Used by the backend controller for per-reason server-side validation.
 */
export function isReasonValid(serviceType, orderStatus, reason) {
  const type = normaliseServiceType(serviceType);
  if (!type) return false;
  const match = (DISPUTE_REASONS[type] ?? []).find((r) => r.value === reason);
  if (!match) return false;
  return !match.windowClosesAfter.includes(orderStatus);
}

/**
 * Returns true if a specific runner-side reason is still valid.
 * Used by the backend controller.
 */
export function isRunnerReasonValid(serviceType, orderStatus, reason) {
  const type = normaliseServiceType(serviceType);
  if (!type) return false;
  const match = (RUNNER_DISPUTE_REASONS[type] ?? []).find((r) => r.value === reason);
  if (!match) return false;
  if (match.windowClosesAfter.includes(orderStatus)) return false;
  if (match.windowOpensAt) {
    // reuse the ordered list from getAvailableRunnerReasons
    const allStatuses = [
      'accepted', 'arrived_at_pickup',
      'item_collected',
      'en_route_to_delivery',
      'arrived_at_delivery',
      'item_delivered',
      'delivered',
      'task_completed',
      'completed',
      'arrived_at_market', 'purchase_in_progress', 'purchase_completed',
    ];
    const currentIdx = allStatuses.indexOf(orderStatus);
    const opensIdx = allStatuses.indexOf(match.windowOpensAt);
    if (currentIdx < opensIdx) return false;
  }
  return true;
}