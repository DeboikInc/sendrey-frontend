const ROLE = ['user', 'runner', 'sales', 'manager', 'admin', 'super-admin'];
const GENDER = ['male', 'female'];
const FLEET = ['cycling', 'bike', 'car', 'van', 'pedestrian'];
const EDUCATION = ['graduate', 'undergraduate', 'high-school'];
SERVICE_TYPE = ['pick-up', 'run-errand'];

const RUNNER_STATUS = [
  'pending_verification',
  'approved_limited', //  Basic verification complete, limited operations, like no kyc
  'approved_full', // Full verification complete, all operations allowed
  'suspended',
  'banned'
]

// For individual document/KYC verification status
const VERIFICATION_STATUS = [
  'not_submitted',
  'pending_review',
  'approved',
  'rejected'
];

const TASK_TYPES = {
  SHOPPING: 'shopping', // includes market
  PICKUP_DELIVERY: 'pickup_delivery'
};

const STATUS_FLOWS = {
  [TASK_TYPES.SHOPPING]: [
    'arrived_at_market',
    'purchase_in_progress',
    'purchase_completed',
    'en_route_to_delivery',
    'task_completed'
  ],
  [TASK_TYPES.PICKUP_DELIVERY]: [
    'arrived_at_pickup_location',
    'item_collected',
    'en_route_to_delivery',
    'task_completed'
  ]
};

const ALL_STATUSES = [
  ...new Set([ // remove duplicates
    ...STATUS_FLOWS[TASK_TYPES.SHOPPING],
    ...STATUS_FLOWS[TASK_TYPES.PICKUP_DELIVERY]
  ])
];

const ACTIVITIES = ['login',
  'logout',
  'register',
  'profile_update',
  'password_change',
  'email_change',
  'phone_verification',
  'email_verification',
  'password_reset_request',
  'password_reset_success',
  'social_login',
  'account_deactivated',
  'account_reactivated',
  'preferences_updated',
  'avatar_updated',
  'two_factor_enabled',
  'two_factor_disabled',
  'api_key_created',
  'api_key_revoked'
];

const SEVERITY = ['low', 'medium', 'high', 'critical'];
const STATUS = ['success', 'failed', 'pending']

module.exports = {
  ROLE,
  GENDER,
  FLEET,
  EDUCATION,
  RUNNER_STATUS,
  ACTIVITIES,
  SEVERITY,
  STATUS,
  SERVICE_TYPE,
  VERIFICATION_STATUS,
  ALL_STATUSES,
  TASK_TYPES,
  STATUS_FLOWS
}