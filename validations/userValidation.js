const Joi = require('joi');
const { commonSchemas, validationMessages, userParamsValidation } = require('./authValidation');

const fileValidation = (value, helpers) => {
  if (typeof value === 'string') {
    try {
      new URL(value);
      return value;
    } catch {
      return helpers.error('any.invalid');
    }
  }

  if (value && value.mimetype) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;

    if (!allowedMimeTypes.includes(value.mimetype)) {
      return helpers.error('any.invalid');
    }

    if (value.size > maxSize) {
      return helpers.error('any.invalid');
    }
  }

  return value;
};

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

const bioValidation = (value, helpers) => {
  const wordCount = value.trim().split(/\s+/).length;

  if (wordCount > 500) {
    return helpers.error('any.invalid', { message: 'Bio cannot exceed 500 words' });
  }

  const blockedWords = ['spam', 'badword', 'inappropriate'];
  const containsBlockedWord = blockedWords.some(word =>
    value.toLowerCase().includes(word.toLowerCase())
  );

  if (containsBlockedWord) {
    return helpers.error('any.invalid', { message: 'Bio contains inappropriate content' });
  }

  return value;
};

const userCommonSchemas = {
  ...commonSchemas,

  avatar: Joi.alternatives()
    .try(
      Joi.string().uri().messages({
        'string.uri': 'Avatar must be a valid URL'
      }),
      Joi.object({
        mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
        size: Joi.number().max(1 * 1024 * 1024)
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

  pin: Joi.string()
    .pattern(/^\d{4}$/)
    .messages({
      'string.pattern.base': 'PIN must be exactly 4 digits',
      'string.empty': 'PIN is required',
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

  location: Joi.object({
    name: Joi.string().required().trim().max(50).messages({
      'string.empty': 'Location name is required',
    }),
    address: Joi.string().required().trim().messages({
      'string.empty': 'Full address is required',
    }),
    lat: Joi.number().min(-90).max(90).required().messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
    }),
    lng: Joi.number().min(-180).max(180).required().messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
    }),
  }),
};

// Reusable coordinate schema
const coordinatesSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required()
}).optional().allow(null);

const userValidation = {

  saveLocation: userCommonSchemas.location,

  locationParams: Joi.object({
    locationId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'Invalid location ID format',
    }),
  }),

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
    serviceType: Joi.string()
      .valid('pick-up', 'run-errand')
      .optional()
      .messages({
        'any.only': 'Service type must be either "pick-up" or "run-errand"'
      }),
    fleetType: Joi.string()
      .valid('cycling', 'bike', 'car', 'van', 'pedestrian')
      .optional()
      .messages({
        'any.only': 'Fleet type must be one of: cycling, bike, car, van, pedestrian'
      }),
    role: Joi.string()
      .valid('runner', 'user', 'admin')
      .optional(),

    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),

    currentRequest: Joi.object({
      serviceType: Joi.string().valid('pick-up', 'run-errand').required()
        .messages({
          'any.only': 'Service type must be either "pick-up" or "run-errand"',
          'any.required': 'Service type is required'
        }),

      fleetType: Joi.string().valid('cycling', 'bike', 'car', 'van', 'pedestrian').required()
        .messages({
          'any.only': 'Fleet type must be one of: cycling, bike, car, van, pedestrian',
          'any.required': 'Fleet type is required'
        }),

      // Common fields for both services
      deliveryLocation: Joi.string().required()
        .messages({
          'string.empty': 'Delivery location is required',
          'any.required': 'Delivery location is required'
        }),

      dropoffPhone: Joi.string().allow('').optional()
        .messages({
          'string.empty': 'Dropoff phone cannot be empty'
        }),

      userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
        .messages({
          'string.pattern.base': 'Invalid user ID format',
          'any.required': 'User ID is required'
        }),

      timestamp: Joi.date().default(Date.now)
        .messages({
          'date.base': 'Timestamp must be a valid date'
        }),

      status: Joi.string()
        .valid('idle', 'searching', 'active', 'awaiting_runner_connection', 'completed', 'cancelled')
        .default('awaiting_runner_connection')
        .messages({
          'any.only': 'Status must be one of: idle, searching, active, awaiting_runner_connection, completed, cancelled'
        }),

    }).when(Joi.object({ serviceType: Joi.valid('run-errand') }), {
      then: Joi.object({
        // Errand-specific fields
        marketLocation: Joi.string().required()
          .messages({
            'string.empty': 'Market location is required for errand service',
            'any.required': 'Market location is required for errand service'
          }),

        marketItems: Joi.string().required()
          .messages({
            'string.empty': 'Market items are required for errand service',
            'any.required': 'Market items are required for errand service'
          }),

        budget: Joi.number().positive().optional()
          .messages({
            'number.base': 'Budget must be a number',
            'number.positive': 'Budget must be a positive number'
          }),

        budgetFlexibility: Joi.string()
          .valid('stay within budget', 'can adjust slightly')
          .default('stay within budget')
          .messages({
            'any.only': 'Budget flexibility must be either "stay within budget" or "can adjust slightly"'
          }),

        // Coordinates — both delivery and market allowed for run-errand
        marketCoordinates: coordinatesSchema,
        deliveryCoordinates: coordinatesSchema,

        // Pickup fields forbidden for errands
        pickupLocation: Joi.forbidden()
          .messages({ 'any.unknown': 'pickupLocation is not allowed for errand service' }),
        pickupPhone: Joi.forbidden()
          .messages({ 'any.unknown': 'pickupPhone is not allowed for errand service' }),
        pickupItems: Joi.forbidden()
          .messages({ 'any.unknown': 'pickupItems is not allowed for errand service' }),
        pickupCoordinates: Joi.forbidden()
          .messages({ 'any.unknown': 'pickupCoordinates is not allowed for errand service' }),

      }).unknown(true), // inherit base fields without errors

      otherwise: Joi.object({
        // Pickup-specific fields
        pickupLocation: Joi.string().required()
          .messages({
            'string.empty': 'Pickup location is required for pickup service',
            'any.required': 'Pickup location is required for pickup service'
          }),

        pickupPhone: Joi.string().allow('').optional()
          .messages({
            'string.empty': 'Pickup phone cannot be empty'
          }),

        pickupItems: Joi.string().allow('').optional()
          .messages({
            'string.empty': 'Pickup items cannot be empty'
          }),

        // Coordinates — both delivery and pickup allowed for pick-up
        pickupCoordinates: coordinatesSchema,
        deliveryCoordinates: coordinatesSchema,

        // Errand fields forbidden for pickup
        marketLocation: Joi.forbidden()
          .messages({ 'any.unknown': 'marketLocation is not allowed for pickup service' }),
        marketItems: Joi.forbidden()
          .messages({ 'any.unknown': 'marketItems is not allowed for pickup service' }),
        budget: Joi.forbidden()
          .messages({ 'any.unknown': 'budget is not allowed for pickup service' }),
        budgetFlexibility: Joi.forbidden()
          .messages({ 'any.unknown': 'budgetFlexibility is not allowed for pickup service' }),
        marketCoordinates: Joi.forbidden()
          .messages({ 'any.unknown': 'marketCoordinates is not allowed for pickup service' }),

      }).unknown(true), // inherit base fields without errors
    }).optional().allow(null),

    isActive: Joi.boolean().optional(),
    isAvailable: Joi.boolean().optional(),
    isOnline: Joi.boolean().optional(),
    reason: Joi.string().optional().max(500)
  })
    .min(1)
    .messages({
      'object.min': 'At least one field must be provided for update',
      ...validationMessages
    }),

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

  updateRole: Joi.object({
    role: userCommonSchemas?.role
      .required()
      .messages({
        'any.required': 'Role is required'
      })
  }).messages(validationMessages),

  updateStatus: Joi.object({
    isActive: Joi.boolean()
      .required()
      .messages({
        'any.required': 'Status is required'
      }),
    isAvailable: Joi.boolean()
      .optional()
      .messages({
        'any.required': 'Availability status is required'
      }),
    isOnline: Joi.boolean()
      .optional()
      .messages({
        'any.required': 'Online status is required'
      }),
    reason: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Reason must not exceed 500 characters'
      })
  }).messages(validationMessages),

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