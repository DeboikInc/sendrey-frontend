/**
 * disputeReasons.js
 * utils/disputeReasons.js
 *
 * Single source of truth for Sendrey dispute reasons.
 * Used by:
 *  - DisputeForm          (show reasons based on service type)
 *  - DisputeRaisedMessage (display human-readable label for a saved reason)
 *  - Disputes.jsx         (runner-side form)
 *  - disputeController    (server-side validation)
 */

const RUN_ERRAND_REASONS = [
  {
    value: 'runner_misconduct',
    label: 'Runner misconduct',
    description: 'Unprofessional, threatening, or abusive behaviour',
  },
  {
    value: 'runner_unresponsive',
    label: 'Runner went offline / unresponsive',
    description: 'Runner stopped communicating mid-order',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

const PICK_UP_REASONS = [
  {
    value: 'runner_misconduct',
    label: 'Runner misconduct',
    description: 'Unprofessional, threatening, or abusive behaviour',
  },
  {
    value: 'runner_unresponsive',
    label: 'Runner went offline / unresponsive',
    description: 'Runner stopped communicating mid-order',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

const RUNNER_PICK_UP_REASONS = [
  {
    value: 'user_misconduct',
    label: 'User misconduct',
    description: 'User was abusive, threatening, or acted in bad faith during the order',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

const RUNNER_RUN_ERRAND_REASONS = [
  {
    value: 'user_misconduct',
    label: 'User misconduct',
    description: 'User was abusive, threatening, or acted in bad faith during the order',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

export const DISPUTE_REASONS = {
  'run-errand': RUN_ERRAND_REASONS,
  'pick-up': PICK_UP_REASONS,
};

export const RUNNER_DISPUTE_REASONS = {
  'run-errand': RUNNER_RUN_ERRAND_REASONS,
  'pick-up': RUNNER_PICK_UP_REASONS,
};

export function normaliseServiceType(serviceType = '') {
  const s = (serviceType ?? '').toLowerCase();
  if (s.includes('errand')) return 'run-errand';
  if (s.includes('pick')) return 'pick-up';
  return null;
}

export function getAvailableReasons(serviceType) {
  const type = normaliseServiceType(serviceType);
  if (!type) return [];
  return DISPUTE_REASONS[type] ?? [];
}

export function getAvailableRunnerReasons(serviceType) {
  const type = normaliseServiceType(serviceType);
  if (!type) return [];
  return RUNNER_DISPUTE_REASONS[type] ?? [];
}

export function isReasonValid(serviceType, reason) {
  const type = normaliseServiceType(serviceType);
  if (!type) return false;
  return (DISPUTE_REASONS[type] ?? []).some(r => r.value === reason);
}

export function isRunnerReasonValid(serviceType, reason) {
  const type = normaliseServiceType(serviceType);
  if (!type) return false;
  return (RUNNER_DISPUTE_REASONS[type] ?? []).some(r => r.value === reason);
}

export function getReasonLabel(reasonValue) {
  const all = [
    ...RUN_ERRAND_REASONS,
    ...PICK_UP_REASONS,
    ...RUNNER_PICK_UP_REASONS,
    ...RUNNER_RUN_ERRAND_REASONS,
  ];
  return all.find(r => r.value === reasonValue)?.label ?? reasonValue;
}