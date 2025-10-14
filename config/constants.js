const ROLE = ['user', 'runner', 'sales', 'manager', 'admin', 'super-admin'];
const GENDER = ['male', 'female'];
const FLEET = ['cycling', 'bike', 'car', 'van', 'pedestran'];
const EDUCATION = ['graduate', 'undergraduate', 'high-school'];
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
  ACTIVITIES,
  SEVERITY,
  STATUS
}