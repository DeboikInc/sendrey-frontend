const Joi = require('joi');
const { passwordStrength } = require('check-password-strength');
const { parsePhoneNumberFromString } = require("libphonenumber-js");

// Custom password strength validation
const passwordComplexity = (value, helpers) => {
  const strength = passwordStrength(value);

  if (strength.id < 2) { // 0: Too weak, 1: Weak, 2: Medium, 3: Strong
    return helpers.error('any.invalid');
  }

  return value;
};

// Converts and validates phone number format
const formatToLocal = (value, helpers) => {
  const phoneNumber = parsePhoneNumberFromString(value, 'NG'); // Default to Nigeria

  if (!phoneNumber || !phoneNumber.isValid()) {
    return helpers.error('any.invalid'); // Invalid number
  }

  // Get national number (e.g. "8134714125")
  let nationalNumber = phoneNumber.nationalNumber;

  // Add leading zero if missing (e.g. "08134714125")
  if (nationalNumber.length === 10) {
    nationalNumber = '0' + nationalNumber;
  }

  return nationalNumber; // Joi will replace the input value with this
};

// Custom objectId validation (for MongoDB)
const objectIdValidation = (value, helpers) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  if (!objectIdRegex.test(value)) {
    return helpers.error('any.invalid');
  }

  return value;
};

// Common validation messages
const validationMessages = {
  'string.empty': '{#label} is required',
  'any.required': '{#label} is required',
  'string.email': 'Please provide a valid email address',
  'string.min': '{#label} should be at least {#limit} characters',
  'string.max': '{#label} should not exceed {#limit} characters',
  'any.invalid': '{#label} is not strong enough',
  'any.only': '{#label} does not match',
  'string.pattern.base': 'Please provide a valid {#label}'
};

// Reusable validation schemas
const commonSchemas = {

  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .custom(passwordComplexity, 'Password strength validation')
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'any.invalid': 'Password is too weak. Include uppercase, lowercase, numbers, and special characters',
    }),

  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s\-']+$/)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 100 characters'
    }),

  phone: Joi.string()
    .trim()
    .required()
    .custom(formatToLocal, 'Phone number validation')
    .messages({
      'any.invalid': 'Please provide a valid phone number with country code (e.g., +1234567890)'
    }),

  address: Joi.string()
    .trim()
    .messages({
      'string.empty': 'Address is required',
    }),

  token: Joi.string()
    .trim()
    .min(1)
    .required()
    .messages({
      'string.empty': 'Token is required',
      'any.required': 'Token is required'
    }),

  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required'
    })
};

// Validation schemas for different auth operations
const authValidation = {

  //mobile user Register validation
  registerRunner: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password.optional(),
    phone: commonSchemas.phone.required(),
    address: commonSchemas.address,
    firstName: commonSchemas.name
      .optional()
      .messages({
        'string.empty': 'First name is required',
        'any.required': 'First name is required'
      }),
    lastName: commonSchemas.name
      .optional()
      .messages({
        'string.empty': 'Last name is required',
        'any.required': 'Last name is required'
      }),
    buidingName: Joi.string()
      .messages({
        'any.empty': 'You must provide building name',
      }),
    flatNumber: Joi.string()
      .messages({
        'any.empty': 'You must provide flat number',
      }),
    nearestBusStop: Joi.string()
      .messages({
        'any.empty': 'You must provide nearest bustop',
      }),
    gender: Joi.string()
      .valid('male', 'female')
      .messages({
        'any.empty': 'Gender must be one of: male, female'
      }),
    fleetType: Joi.string()
      .valid('cycling', 'bike', 'car', 'van', 'pedestran')
      .messages({
        'any.empty': 'Provide fleet type'
      }),
    levelOfEducation: Joi.string()
      .valid('graduate', 'undergraduate', 'high-school')
      .messages({
        'any.empty': 'Provide the level of your education'
      }),
    nameOfInstitution: Joi.string()
      .messages({
        'any.empty': 'Provide the name of your institution'
      }),
    role: Joi.string()
      .valid('user', 'runner', 'sales', 'manager', 'admin', 'super-admin')
      .default('user')
      .messages({
        'any.only': 'Role must be one of: user, admin, moderator'
      }),
  }),

  registerUser: Joi.object({
    email: commonSchemas.email.optional(), 
    password: commonSchemas.password.optional(),
    phone: commonSchemas.phone.required(),
    firstName: commonSchemas.name
      .messages({
        'string.empty': 'First name is required',
      }),
    lastName: commonSchemas.name
      .messages({
        'string.empty': 'Last name is required',
      })
  }),

  // // Login validation
  login: Joi.object({
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    password: Joi.string()
      .min(1).optional(),
    rememberMe: Joi.boolean().optional()
  }).messages(validationMessages),

  // Email verification validation
  verifyEmail: Joi.object({
    token: commonSchemas.token
  }).messages(validationMessages),

  // Resend verification email validation
  resendVerification: Joi.object({
    email: commonSchemas.email
  }).messages(validationMessages),

  // Forgot password validation
  forgotPassword: Joi.object({
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
  }).messages(validationMessages),

  // Reset password validation
  resetPassword: Joi.object({
    token: commonSchemas.token,
    newPassword: commonSchemas.password,
  }).messages(validationMessages),

  // Change password validation (authenticated user)
  changePassword: Joi.object({
    currentPassword: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'Current password is required',
        'any.required': 'Current password is required'
      }),
    newPassword: commonSchemas.password,
  }).messages(validationMessages),

  // Phone verification request validation
  requestPhoneVerification: Joi.object({
    phone: commonSchemas.phone.required().messages({
      'any.required': 'Phone number is required'
    })
  }).messages(validationMessages),

  // Verify phone with OTP validation
  verifyPhone: Joi.object({
    otp: commonSchemas.otp
  }).messages(validationMessages),

  // Social login validation
  socialLogin: Joi.object({
    provider: Joi.string()
      .valid('google', 'facebook', 'apple', 'github')
      .required()
      .messages({
        'any.only': 'Provider must be one of: google, facebook, apple, github',
        'any.required': 'Provider is required'
      }),
    accessToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Access token is required'
      }),
    firstName: commonSchemas.name.optional(),
    lastName: commonSchemas.name.optional(),
    avatar: Joi.string().uri().optional()
  }).messages(validationMessages),

  // Logout validation (optional - for token blacklisting)
  logout: Joi.object({}).messages(validationMessages),

  // Admin user creation validation
  createAdmin: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    firstName: commonSchemas.name.required(),
    lastName: commonSchemas.name.required(),
    phone: commonSchemas.phone.optional(),
    role: Joi.string()
      .valid('user', 'runner', 'sales', 'manager', 'admin', 'super-admin')
      .default('user')
      .messages({
        'any.only': 'Role must be one of: user, admin, moderator'
      }),
    isActive: Joi.boolean().default(true),
    sendWelcomeEmail: Joi.boolean().default(true)
  }).messages(validationMessages),
};

// Params validation for user IDs
const userParamsValidation = {
  userId: Joi.object({
    userId: Joi.string().required().custom(objectIdValidation, 'ObjectId validation')
      .messages({ 'any.invalid': 'Invalid userId format' })
  })
};

// Validation middleware helper
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorDetails
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Validate query parameters
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query parameter validation failed',
        errors: errorDetails
      });
    }

    req.query = value;
    next();
  };
};

// Export everything
module.exports = {
  authValidation,
  validate,
  validateQuery,
  commonSchemas,
  validationMessages,
  userParamsValidation
};