const Joi = require('joi');

/**
 * =========================
 * UPDATE PROFILE
 * =========================
 */
const validateUpdateProfile = (req, res, next) => {
  const schema = Joi.object({
    firstName: Joi.string().trim().min(2).max(50),
    lastName: Joi.string().trim().min(2).max(50),
    email: Joi.string().email(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/),
  }).min(1);

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  next();
};

/**
 * =========================
 * SAVED LOCATION
 * =========================
 */
const validateSavedLocation = (req, res, next) => {
  const schema = Joi.object({
    label: Joi.string().trim().min(2).max(30).required(),
    type: Joi.string().valid('home', 'work', 'other').required(),
    name: Joi.string().trim().min(2).max(100).required(),
    address: Joi.string().trim().min(5).max(255).required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  next();
};

/**
 * =========================
 * EMERGENCY CONTACT
 * =========================
 */
const validateEmergencyContact = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    relation: Joi.string().trim().min(2).max(30).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  next();
};

/**
 * =========================
 * USER PREFERENCES
 * =========================
 */
const validatePreferences = (req, res, next) => {
  const schema = Joi.object({
    preferredPayment: Joi.string().valid('cash', 'wallet', 'upi', 'card'),
    notifications: Joi.object({
      email: Joi.boolean(),
      sms: Joi.boolean(),
      push: Joi.boolean(),
    }),
  }).min(1);

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  next();
};

module.exports = {
  validateUpdateProfile,
  validateSavedLocation,
  validateEmergencyContact,
  validatePreferences,
};
