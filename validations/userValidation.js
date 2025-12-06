const Joi = require('joi');
const { commonSchemas, validationMessages, userParamsValidation } = require('./authValidation');

// Custom validation for file uploads (avatars)
const fileValidation = (value, helpers) => {
  if (typeof value === 'string') {
    // URL validation for existing avatars
    try {
      new URL(value);
      return value;
    } catch {
      return helpers.error('any.invalid');
    }
  }

  // For file objects (if handling multipart/form-data)
  if (value && value.mimetype) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimeTypes.includes(value.mimetype)) {
      return helpers.error('any.invalid');
    }

    if (value.size > maxSize) {
      return helpers.error('any.invalid');
    }
  }

  return value;
};

// Custom validation for date of birth (must be at least 13 years old)
const dateOfBirthValidation = (value, helpers) => {
  const minAge = 13;
  const maxAge = 120;
  const today = new Date();
  const birthDate = new Date(value);
  const age = today.getFullYear() - birthDate.getFullYear();

  if (age < minAge) {
    return helpers.error('any.invalid', { message: `Must be at least ${minAge} years old` });
  }

  if (age > maxAge) {
    return helpers.error('any.invalid', { message: `Age cannot exceed ${maxAge} years` });
  }

  return value;
};

// Custom validation for bio/description
const bioValidation = (value, helpers) => {
  const wordCount = value.trim().split(/\s+/).length;

  if (wordCount > 500) {
    return helpers.error('any.invalid', { message: 'Bio cannot exceed 500 words' });
  }

  // Check for inappropriate content (basic example)
  const blockedWords = ['spam', 'badword', 'inappropriate'];
  const containsBlockedWord = blockedWords.some(word =>
    value.toLowerCase().includes(word.toLowerCase())
  );

  if (containsBlockedWord) {
    return helpers.error('any.invalid', { message: 'Bio contains inappropriate content' });
  }

  return value;
};

// Extended common schemas for user validation
const userCommonSchemas = {
  ...commonSchemas,

  avatar: Joi.alternatives()
    .try(
      Joi.string().uri().messages({
        'string.uri': 'Avatar must be a valid URL'
      }),
      Joi.object({
        mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
        size: Joi.number().max(1 * 1024 * 1024) // 5MB
      }).unknown()
    )
    .custom(fileValidation, 'File validation')
    .messages({
      'any.invalid': 'Avatar must be a valid image URL or file (JPEG, PNG, GIF, WebP, max 5MB)'
    }),

  bio: Joi.string()
    .trim()
    .max(2000)
    .custom(bioValidation, 'Bio content validation')
    .messages({
      'string.max': 'Bio cannot exceed 2000 characters',
      'any.invalid': 'Bio contains inappropriate content or exceeds word limit'
    }),

  dateOfBirth: Joi.date()
    .max('now')
    .custom(dateOfBirthValidation, 'Age validation')
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'any.invalid': '{{#message}}'
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer-not-to-say')
    .messages({
      'any.only': 'Gender must be one of: male, female, other, prefer-not-to-say'
    }),

  role: Joi.string()
    .valid('user', 'admin', 'moderator')
    .default('user')
    .messages({
      'any.only': 'Role must be one of: user, admin, moderator'
    }),

  isActive: Joi.boolean()
    .default(true),

  isVerified: Joi.boolean()
    .default(false),

  notificationPreferences: Joi.object({
    email: Joi.object({
      marketing: Joi.boolean().default(true),
      security: Joi.boolean().default(true),
      updates: Joi.boolean().default(true),
      newsletter: Joi.boolean().default(true)
    }).default(),
    push: Joi.object({
      messages: Joi.boolean().default(true),
      updates: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }).default(),
    sms: Joi.object({
      security: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }).default()
  }).default(),
};

// User validation schemas
const userValidation = {
  // Update user profile
  updateProfile: Joi.object({
    firstName: userCommonSchemas?.name?.optional(),
    lastName: userCommonSchemas?.name?.optional(),
    phone: userCommonSchemas?.phone?.optional(),
    avatar: userCommonSchemas?.avatar?.optional(),
    bio: userCommonSchemas?.bio?.optional(),
    dateOfBirth: userCommonSchemas?.dateOfBirth?.optional(),
    gender: userCommonSchemas?.gender?.optional(),
    notificationPreferences: userCommonSchemas?.notificationPreferences?.optional(),
    address: userCommonSchemas?.address?.optional(),
    fleetType: Joi.string()
      .valid('cycling', 'bike', 'car', 'van', 'pedestran')
      .messages({
        'any.empty': 'Provide fleet type'
      }),
    serviceType: Joi.string()
      .valid('pick-up', 'run-errand')
      .messages({
        'any.empty': 'Provide service type'
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
  })
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided for update',
      ...validationMessages
    }),

  // Change email address
  changeEmail: Joi.object({
    newEmail: userCommonSchemas?.email
      .messages({
        'string.email': 'Please provide a valid new email address',
        'string.empty': 'New email is required',
        'any.required': 'New email is required'
      }),
    currentPassword: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'Current password is required to change email',
        'any.required': 'Current password is required to change email'
      })
  }).messages(validationMessages),

  // Update notification preferences
  updateNotifications: Joi.object({
    email: Joi.object({
      marketing: Joi.boolean().optional(),
      security: Joi.boolean().optional(),
      updates: Joi.boolean().optional(),
      newsletter: Joi.boolean().optional()
    }).optional(),
    push: Joi.object({
      messages: Joi.boolean().optional(),
      updates: Joi.boolean().optional(),
      promotions: Joi.boolean().optional()
    }).optional(),
    sms: Joi.object({
      security: Joi.boolean().optional(),
      promotions: Joi.boolean().optional()
    }).optional()
  })
    .min(1)
    .messages({
      'object.min': 'At least one notification preference must be provided',
      ...validationMessages
    }),

  // Update user role (admin only)
  updateRole: Joi.object({
    role: userCommonSchemas?.role
      .required()
      .messages({
        'any.required': 'Role is required'
      })
  }).messages(validationMessages),

  // Update user status (admin only)
  updateStatus: Joi.object({
    isActive: Joi.boolean()
      .required()
      .messages({
        'any.required': 'Status is required'
      }),
    reason: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Reason must not exceed 500 characters'
      })
  }).messages(validationMessages),

  // Bulk user actions (admin only)
  bulkAction: Joi.object({
    userIds: Joi.array()
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one user ID is required',
        'array.max': 'Cannot process more than 100 users at once',
        'any.required': 'User IDs are required',
        'string.pattern.base': 'Invalid user ID format'
      }),
    action: Joi.string()
      .valid('activate', 'deactivate', 'delete', 'assign-role')
      .required()
      .messages({
        'any.only': 'Action must be one of: activate, deactivate, delete, assign-role',
        'any.required': 'Action is required'
      }),
    role: userCommonSchemas?.role.when('action', {
      is: 'assign-role',
      then: Joi.required(),
      otherwise: Joi.optional()
    }).messages({
      'any.required': 'Role is required when action is assign-role'
    })
  }).messages(validationMessages),

  // Search users with filters
  searchUsers: Joi.object({
    query: Joi.string()
      .trim()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Search query must not exceed 100 characters'
      }),
    role: userCommonSchemas?.role.optional(),
    isActive: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    hasPhone: Joi.boolean().optional(),
    hasAvatar: Joi.boolean().optional()
  }).messages(validationMessages),

  // Import users (admin only)
  importUsers: Joi.array()
    .items(
      Joi.object({
        email: userCommonSchemas?.email,
        firstName: userCommonSchemas?.name.required(),
        lastName: userCommonSchemas?.name.required(),
        phone: userCommonSchemas?.phone.optional(),
        role: userCommonSchemas?.role.optional(),
      })
    )
    .min(1)
    .max(1000)
    .messages({
      'array.min': 'At least one user record is required',
      'array.max': 'Cannot import more than 1000 users at once',
      ...validationMessages
    }),

  // Export users (admin only)
  exportUsers: Joi.object({
    format: Joi.string()
      .valid('csv', 'json', 'xlsx')
      .default('csv')
      .messages({
        'any.only': 'Format must be one of: csv, json, xlsx'
      }),
    fields: Joi.array()
      .items(Joi.string().valid(
        'id', 'email', 'firstName', 'lastName', 'phone', 'role',
        'isActive', 'isVerified', 'createdAt', 'lastLogin'
      ))
      .default(['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'])
      .messages({
        'any.only': 'Invalid field selected for export'
      }),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional()
  }).messages(validationMessages)
};

// Query validation for user listing
const userQueryValidation = {
  listUsers: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    search: Joi.string()
      .trim()
      .max(100)
      .optional(),
    role: userCommonSchemas?.role.optional(),
    isActive: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(),
    sortBy: Joi.string()
      .valid('createdAt', 'updatedAt', 'lastLogin', 'firstName', 'lastName', 'email')
      .default('createdAt')
      .messages({
        'any.only': 'Sort by must be one of: createdAt, updatedAt, lastLogin, firstName, lastName, email'
      }),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
      .messages({
        'any.only': 'Sort order must be either asc or desc'
      }),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional()
  }).messages(validationMessages)
};

module.exports = {
  userValidation,
  userQueryValidation,
  userParamsValidation,
  userCommonSchemas
};