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
 *   → item_delivered → task_completed → completed
 *
 * Pick-up status flow (no vendor payment step):
 *   accepted → runner_en_route_to_pickup → arrived_at_pickup_location
 *   → item_collected → en_route_to_delivery → arrived_at_delivery_location
 *   → item_delivered → task_completed → completed
 *
 * windowClosesAfter: the statuses AFTER which this reason is no longer
 * actionable — i.e. admin cannot do anything meaningful about it anymore.
 *
 * Reasoning per reason:
 *
 *  proof_fraud            → closes at purchase_completed
 *                           Vendor already paid, nothing to reverse on the item.
 *
 *  item_not_delivered     → closes at item_delivered
 *                           Once runner marks delivered and task completes,
 *                           raising this post-completion is a scam vector.
 *
 *  item_damaged_in_transit → stays open until completed
 *                           User may only notice damage after opening the package.
 *                           Admin can still partial-refund from escrow.
 *
 *  runner_misconduct      → stays open until completed
 *                           Abuse/threatening behaviour is reportable
 *                           even after the order ends.
 *
 *  runner_unresponsive    → closes at task_completed
 *                           If the task completed, the runner wasn't unresponsive
 *                           enough to matter. Nothing actionable post-completion.
 *
 *  other                  → stays open until completed
 *                           Catch-all; admin judges case by case.
 *
 *  item_not_collected     → closes at en_route_to_delivery (pick-up only)
 *                           Once runner is en route they have the item.
 *
 *  wrong_item_collected   → closes at en_route_to_delivery (pick-up only)
 *                           Same logic as above.
 */

const RUN_ERRAND_REASONS = [
  {
    value: 'proof_fraud',
    label: "Proof photo doesn't match item",
    description: 'Runner submitted a misleading or fake proof image',
    windowClosesAfter: [
      'purchase_completed',
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'item_delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'item_not_delivered',
    label: 'Item not delivered',
    description: 'Runner marked as delivered but item never arrived',
    // Close at item_delivered — post-completion claims are a scam vector
    windowClosesAfter: [
      'item_delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'item_damaged_in_transit',
    label: 'Item damaged in transit',
    description: 'Item arrived visibly damaged after collection',
    // Keep open past task_completed — user may only notice on unpacking
    windowClosesAfter: [
      'completed',
    ],
  },
  {
    value: 'runner_misconduct',
    label: 'Runner misconduct',
    description: 'Unprofessional, threatening, or abusive behaviour',
    // Reportable even after order ends
    windowClosesAfter: [
      'completed',
    ],
  },
  {
    value: 'runner_unresponsive',
    label: 'Runner went offline / unresponsive',
    description: 'Runner stopped communicating mid-order',
    // If task completed, unresponsiveness didn't affect outcome — nothing actionable
    windowClosesAfter: [
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    // Catch-all — admin judges; keep open until fully archived
    windowClosesAfter: [
      'completed',
    ],
  },
];

const PICK_UP_REASONS = [
  {
    value: 'item_not_collected',
    label: 'Item not collected',
    description: 'Runner claimed to collect but item was not picked up',
    // Once runner is en route they have the item — moot to dispute collection
    windowClosesAfter: [
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'item_delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'wrong_item_collected',
    label: 'Wrong item collected',
    description: 'Runner picked up a different item from the specified location',
    windowClosesAfter: [
      'en_route_to_delivery',
      'arrived_at_delivery_location',
      'item_delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'item_not_delivered',
    label: 'Item not delivered',
    description: 'Runner marked as delivered but item never arrived',
    windowClosesAfter: [
      'item_delivered',
      'task_completed',
      'completed',
    ],
  },
  {
    value: 'item_damaged_in_transit',
    label: 'Item damaged in transit',
    description: 'Item arrived visibly damaged after collection',
    windowClosesAfter: [
      'completed',
    ],
  },
  {
    value: 'runner_misconduct',
    label: 'Runner misconduct',
    description: 'Unprofessional, threatening, or abusive behaviour',
    windowClosesAfter: [
      'completed',
    ],
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

export const DISPUTE_REASONS = {
  'run-errand': RUN_ERRAND_REASONS,
  'pick-up':    PICK_UP_REASONS,
};

/** Normalise the loose serviceType strings your DB/socket may emit */
export function normaliseServiceType(serviceType = '') {
  const s = serviceType.toLowerCase();
  if (s.includes('errand')) return 'run-errand';
  if (s.includes('pick'))   return 'pick-up';
  return null;
}

/**
 * Returns reasons still actionable at the given order status.
 * Used by DisputeForm and Disputes.jsx to filter the visible list.
 */
export function getAvailableReasons(serviceType, orderStatus) {
  const type = normaliseServiceType(serviceType);
  if (!type) return [];
  return (DISPUTE_REASONS[type] ?? []).filter(
    (r) => !r.windowClosesAfter.includes(orderStatus)
  );
}

/**
 * Returns the human-readable label for a saved reason value.
 * Works across both service types — used by DisputeRaisedMessage.
 */
export function getReasonLabel(reasonValue) {
  const all = [...RUN_ERRAND_REASONS, ...PICK_UP_REASONS];
  return all.find((r) => r.value === reasonValue)?.label ?? reasonValue;
}

/**
 * Returns true if a specific reason is still valid for the given status.
 * Used by the backend controller for per-reason server-side validation.
 */
export function isReasonValid(serviceType, orderStatus, reason) {
  const type = normaliseServiceType(serviceType);
  if (!type) return false;
  const match = (DISPUTE_REASONS[type] ?? []).find((r) => r.value === reason);
  if (!match) return false;
  return !match.windowClosesAfter.includes(orderStatus);
}