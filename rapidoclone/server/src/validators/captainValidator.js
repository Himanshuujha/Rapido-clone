const Joi = require('joi');

/**
 * UPDATE CAPTAIN PROFILE
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
 * VEHICLE DETAILS
 */
const validateVehicle = (req, res, next) => {
  const schema = Joi.object({
    type: Joi.string().valid('bike', 'auto', 'car').required(),
    make: Joi.string().trim().min(2).max(50).required(),
    model: Joi.string().trim().min(1).max(50).required(),
    year: Joi.number().integer().min(1990).max(new Date().getFullYear()),
    color: Joi.string().trim().min(2).max(30),
    registrationNumber: Joi.string().trim().min(5).max(20).required(),
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
 * BANK DETAILS
 */
const validateBankDetails = (req, res, next) => {
  const schema = Joi.object({
    accountNumber: Joi.string().pattern(/^\d{9,18}$/).required(),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
    accountHolderName: Joi.string().trim().min(3).max(100).required(),
    bankName: Joi.string().trim().min(3).max(100).required(),
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
 * DOCUMENT UPLOAD
 */
const validateDocument = (req, res, next) => {
  const allowedTypes = [
    'driving_license',
    'vehicle_rc',
    'insurance',
    'aadhar',
    'pan',
    'profile_photo',
  ];

  if (!allowedTypes.includes(req.params.documentType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid document type',
    });
  }

  next();
};

module.exports = {
  validateUpdateProfile,
  validateVehicle,
  validateBankDetails,
  validateDocument,
};
