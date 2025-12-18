const Joi = require('joi');

/**
 * Common helpers
 */
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

/**
 * ==============================
 * Fare Estimate Validation
 * ==============================
 */
const validateFareEstimate = (req, res, next) => {
  const schema = Joi.object({
    pickup: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().optional(),
    }).required(),

    destination: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().optional(),
    }).required(),

    vehicleType: Joi.string()
      .valid('bike', 'auto', 'cab')
      .required(),
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
 * ==============================
 * Book Ride Validation
 * ==============================
 */
const validateBookRide = (req, res, next) => {
  const schema = Joi.object({
    pickup: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required(),
    }).required(),

    destination: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required(),
    }).required(),

    vehicleType: Joi.string()
      .valid('bike', 'auto', 'cab')
      .required(),

    estimatedFare: Joi.number().positive().required(),
    distance: Joi.number().positive().required(),
    duration: Joi.number().positive().required(),

    paymentMethod: Joi.string()
      .valid('cash', 'wallet', 'online')
      .required(),
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
 * ==============================
 * Schedule Ride Validation
 * ==============================
 */
const validateScheduleRide = (req, res, next) => {
  const schema = Joi.object({
    pickup: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required(),
    }).required(),

    destination: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required(),
    }).required(),

    vehicleType: Joi.string()
      .valid('bike', 'auto', 'cab')
      .required(),

    scheduledAt: Joi.date().greater('now').required(),
    paymentMethod: Joi.string()
      .valid('cash', 'wallet', 'online')
      .required(),
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
 * ==============================
 * Cancel Ride Validation
 * ==============================
 */
const validateCancelRide = (req, res, next) => {
  const schema = Joi.object({
    rideId: objectId.required(),
    reason: Joi.string().max(200).optional(),
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
 * ==============================
 * Rate Ride Validation
 * ==============================
 */
const validateRateRide = (req, res, next) => {
  const schema = Joi.object({
    rideId: objectId.required(),
    rating: Joi.number().min(1).max(5).required(),
    feedback: Joi.string().max(300).optional(),
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
 * ==============================
 * Start Ride Validation (Captain)
 * ==============================
 */
const validateStartRide = (req, res, next) => {
  const schema = Joi.object({
    rideId: objectId.required(),
    otp: Joi.string().length(4).required(),
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

module.exports = {
  validateFareEstimate,
  validateBookRide,
  validateScheduleRide,
  validateCancelRide,
  validateRateRide,
  validateStartRide,
};
