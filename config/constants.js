const ROLE = ['user', 'runner', 'admin', 'super-admin']; // 'sales', 'manager', 
const GENDER = ['male', 'female'];
const FLEET = ['cycling', 'bike', 'car', 'van', 'pedestrian'];
const EDUCATION = ['graduate', 'undergraduate', 'high-school'];
SERVICE_TYPE = ['pick-up', 'run-errand'];

BUSINESS_STATUS = ['active', 'suspended', 'banned']
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
  RUN_ERRAND: 'run-errand', // includes market and shopping
  PICK_UP: 'pick-up' // includes simple pickup and delivery tasks 
};

const STATUS_FLOWS = {
  [TASK_TYPES.RUN_ERRAND]: [
    'arrived_at_market',
    'purchase_in_progress',
    'purchase_completed',
    'en_route_to_delivery',
    'item_delivered',
    'arrived_at_delivery_location',
    'task_completed'
  ],
  [TASK_TYPES.PICK_UP]: [
    'arrived_at_pickup_location',
    'item_collected',
    'en_route_to_delivery',
    'arrived_at_delivery_location',
    'item_delivered',
    'task_completed'
  ]
};

const ALL_STATUSES = [
  ...new Set([ // remove duplicates
    ...STATUS_FLOWS[TASK_TYPES.RUN_ERRAND],
    ...STATUS_FLOWS[TASK_TYPES.PICK_UP]
  ])
];

// in meters, 1000 = 1km
const PICKUP_MAX_DISTANCE  = 99999999; // runner model, runner to pickup/market to delivery for pedestrian 1km
const TOTAL_MAX_DISTANCE = 99999999; // runner to market/pickup location, user model

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
  STATUS_FLOWS,
  TOTAL_MAX_DISTANCE,
  PICKUP_MAX_DISTANCE,
  BUSINESS_STATUS
}