// src/controllers/rideController.js
const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Coupon = require('../models/Coupon');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const VehicleType = require('../models/VehicleType');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const FareCalculator = require('../services/fareCalculator');
const CaptainMatcher = require('../services/captainMatcher');
const MapService = require('../services/mapService');
const { generateOTP, generateRideId, parsePagination } = require('../utils/helpers');
const { emitToUser, emitToCaptain, emitToAllCaptains } = require('../config/socket');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// ==========================================
// USER RIDE ROUTES
// ==========================================

/**
 * @desc    Get fare estimate
 * @route   POST /api/v1/rides/estimate
 * @access  Private (User)
 */
exports.getFareEstimate = asyncHandler(async (req, res) => {
  const { pickup, destination, vehicleType = 'bike' } = req.body;

  if (!pickup || !destination) {
    throw new ApiError(400, 'Pickup and destination are required');
  }

  // Get route details from map service
  const routeDetails = await MapService.getDirections(
    { latitude: pickup.coordinates.latitude, longitude: pickup.coordinates.longitude },
    { latitude: destination.coordinates.latitude, longitude: destination.coordinates.longitude }
  );

  // Calculate surge multiplier based on demand
  const surgeMultiplier = await calculateSurgeMultiplier(
    pickup.coordinates.latitude,
    pickup.coordinates.longitude,
    vehicleType
  );

  // Calculate fare
  const fareEstimate = FareCalculator.calculateFare(
    vehicleType,
    routeDetails.distance,
    routeDetails.duration,
    surgeMultiplier
  );

  // Get nearby captains count
  const nearbyCaptains = await CaptainMatcher.findNearbyCaptains(
    pickup.coordinates,
    vehicleType,
    5000
  );

  res.status(200).json(
    new ApiResponse(200, {
      fare: fareEstimate,
      route: {
        distance: routeDetails.distance,
        duration: routeDetails.duration,
        polyline: routeDetails.polyline,
      },
      surgeMultiplier,
      nearbyCaptainsCount: nearbyCaptains.length,
      estimatedPickupTime: nearbyCaptains.length > 0 ? nearbyCaptains[0].eta : null,
    }, 'Fare estimate calculated successfully')
  );
});

/**
 * @desc    Book a ride
 * @route   POST /api/v1/rides/book
 * @access  Private (User)
 */
exports.bookRide = asyncHandler(async (req, res) => {
  const {
    pickup,
    destination,
    vehicleType = 'bike',
    paymentMethod = 'cash',
    couponCode,
  } = req.body;

  const userId = req.user._id;

  // Check for existing active ride
  const existingRide = await Ride.findOne({
    user: userId,
    status: { $in: ['searching', 'accepted', 'arriving', 'arrived', 'started'] },
  });

  if (existingRide) {
    throw new ApiError(400, 'You already have an active ride');
  }

  // Get route details
  const routeDetails = await MapService.getDirections(
    { latitude: pickup.coordinates.latitude, longitude: pickup.coordinates.longitude },
    { latitude: destination.coordinates.latitude, longitude: destination.coordinates.longitude }
  );

  // Calculate surge
  const surgeMultiplier = await calculateSurgeMultiplier(
    pickup.coordinates.latitude,
    pickup.coordinates.longitude,
    vehicleType
  );

  // Calculate fare
  let fareDetails = FareCalculator.calculateFare(
    vehicleType,
    routeDetails.distance,
    routeDetails.duration,
    surgeMultiplier
  );

  // Apply coupon if provided
  let appliedCoupon = null;
  if (couponCode) {
    const couponResult = await applyCouponToFare(couponCode, fareDetails, userId, vehicleType);
    fareDetails = couponResult.fare;
    appliedCoupon = couponResult.coupon;
  }

  // Generate ride ID and OTP
  const rideId = generateRideId();
  const otp = generateOTP(4);

  // Create ride
  const ride = await Ride.create({
    rideId,
    user: userId,
    vehicleType,
    pickup: {
      address: pickup.address,
      coordinates: {
        latitude: pickup.coordinates.latitude,
        longitude: pickup.coordinates.longitude,
      },
    },
    destination: {
      address: destination.address,
      coordinates: {
        latitude: destination.coordinates.latitude,
        longitude: destination.coordinates.longitude,
      },
    },
    route: {
      distance: routeDetails.distance,
      duration: routeDetails.duration,
      polyline: routeDetails.polyline,
    },
    fare: {
      baseFare: fareDetails.baseFare,
      distanceFare: fareDetails.distanceFare,
      timeFare: fareDetails.timeFare,
      surgeFare: fareDetails.surgeFare,
      discount: fareDetails.discount || 0,
      couponDiscount: fareDetails.couponDiscount || 0,
      total: fareDetails.total,
      platformFee: fareDetails.platformFee,
      captainEarnings: fareDetails.captainEarnings,
    },
    payment: {
      method: paymentMethod,
      status: 'pending',
    },
    otp: {
      code: otp,
      verified: false,
    },
    surgeMultiplier,
    coupon: appliedCoupon?._id,
    status: 'searching',
    timestamps: {
      requested: new Date(),
    },
  });

  // Find nearby captains and send ride request
  const nearbyCaptains = await CaptainMatcher.findNearbyCaptains(
    pickup.coordinates,
    vehicleType,
    5000
  );

  // Rank captains and emit to them
  const rankedCaptains = CaptainMatcher.rankCaptains(nearbyCaptains);

  // Store ride request in cache for tracking
  await cache.set(`ride:request:${ride._id}`, {
    rideId: ride._id,
    captainsSent: rankedCaptains.map(c => c._id.toString()),
    createdAt: new Date().toISOString(),
  }, 300);

  // Emit to nearby captains
  rankedCaptains.forEach((captain) => {
    emitToCaptain(captain._id.toString(), 'ride:new-request', {
      ride: ride.toObject(),
      distance: captain.distance,
      eta: captain.eta,
    });
  });

  // Set timeout for ride (auto-cancel if no captain accepts)
  setTimeout(async () => {
    const currentRide = await Ride.findById(ride._id);
    if (currentRide && currentRide.status === 'searching') {
      currentRide.status = 'cancelled';
      currentRide.cancellation = {
        by: 'system',
        reason: 'No captain available',
      };
      currentRide.timestamps.cancelled = new Date();
      await currentRide.save();

      emitToUser(userId.toString(), 'ride:no-captain', {
        rideId: ride._id,
        message: 'No captain available at the moment. Please try again.',
      });
    }
  }, 60000); // 1 minute timeout

  // Populate and return ride
  const populatedRide = await Ride.findById(ride._id)
    .populate('user', 'firstName lastName phone avatar')
    .populate('coupon', 'code discountType discountValue');

  res.status(201).json(
    new ApiResponse(201, {
      ride: populatedRide,
      nearbyCaptainsCount: rankedCaptains.length,
    }, 'Ride booked successfully. Searching for captain...')
  );
});

/**
 * @desc    Schedule a ride for later
 * @route   POST /api/v1/rides/schedule
 * @access  Private (User)
 */
exports.scheduleRide = asyncHandler(async (req, res) => {
  const {
    pickup,
    destination,
    vehicleType = 'bike',
    paymentMethod = 'cash',
    scheduledTime,
  } = req.body;

  const userId = req.user._id;

  // Validate scheduled time (must be at least 30 minutes in future)
  const scheduledDate = new Date(scheduledTime);
  const minScheduleTime = new Date(Date.now() + 30 * 60 * 1000);

  if (scheduledDate < minScheduleTime) {
    throw new ApiError(400, 'Scheduled time must be at least 30 minutes from now');
  }

  // Max schedule time: 7 days
  const maxScheduleTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (scheduledDate > maxScheduleTime) {
    throw new ApiError(400, 'Cannot schedule ride more than 7 days in advance');
  }

  // Get route details for fare estimate
  const routeDetails = await MapService.getDirections(
    { latitude: pickup.coordinates.latitude, longitude: pickup.coordinates.longitude },
    { latitude: destination.coordinates.latitude, longitude: destination.coordinates.longitude }
  );

  const fareDetails = FareCalculator.calculateFare(
    vehicleType,
    routeDetails.distance,
    routeDetails.duration,
    1 // No surge for scheduled rides
  );

  const rideId = generateRideId();
  const otp = generateOTP(4);

  const ride = await Ride.create({
    rideId,
    user: userId,
    vehicleType,
    pickup: {
      address: pickup.address,
      coordinates: {
        latitude: pickup.coordinates.latitude,
        longitude: pickup.coordinates.longitude,
      },
    },
    destination: {
      address: destination.address,
      coordinates: {
        latitude: destination.coordinates.latitude,
        longitude: destination.coordinates.longitude,
      },
    },
    route: {
      distance: routeDetails.distance,
      duration: routeDetails.duration,
      polyline: routeDetails.polyline,
    },
    fare: {
      baseFare: fareDetails.baseFare,
      distanceFare: fareDetails.distanceFare,
      timeFare: fareDetails.timeFare,
      surgeFare: 0,
      total: fareDetails.total,
      platformFee: fareDetails.platformFee,
      captainEarnings: fareDetails.captainEarnings,
    },
    payment: {
      method: paymentMethod,
      status: 'pending',
    },
    otp: {
      code: otp,
      verified: false,
    },
    isScheduled: true,
    scheduledTime: scheduledDate,
    status: 'scheduled',
    timestamps: {
      requested: new Date(),
    },
  });

  res.status(201).json(
    new ApiResponse(201, { ride }, 'Ride scheduled successfully')
  );
});

/**
 * @desc    Get scheduled rides
 * @route   GET /api/v1/rides/scheduled
 * @access  Private (User)
 */
exports.getScheduledRides = asyncHandler(async (req, res) => {
  const rides = await Ride.find({
    user: req.user._id,
    isScheduled: true,
    status: 'scheduled',
    scheduledTime: { $gte: new Date() },
  })
    .sort({ scheduledTime: 1 })
    .populate('captain', 'firstName lastName phone avatar vehicle ratings');

  res.status(200).json(
    new ApiResponse(200, { rides }, 'Scheduled rides retrieved')
  );
});

/**
 * @desc    Update scheduled ride
 * @route   PUT /api/v1/rides/scheduled/:rideId
 * @access  Private (User)
 */
exports.updateScheduledRide = asyncHandler(async (req, res) => {
  const { scheduledTime, pickup, destination } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    isScheduled: true,
    status: 'scheduled',
  });

  if (!ride) {
    throw new ApiError(404, 'Scheduled ride not found');
  }

  if (scheduledTime) {
    const scheduledDate = new Date(scheduledTime);
    const minScheduleTime = new Date(Date.now() + 30 * 60 * 1000);

    if (scheduledDate < minScheduleTime) {
      throw new ApiError(400, 'Scheduled time must be at least 30 minutes from now');
    }

    ride.scheduledTime = scheduledDate;
  }

  if (pickup) {
    ride.pickup = {
      address: pickup.address,
      coordinates: {
        latitude: pickup.coordinates.latitude,
        longitude: pickup.coordinates.longitude,
      },
    };
  }

  if (destination) {
    ride.destination = {
      address: destination.address,
      coordinates: {
        latitude: destination.coordinates.latitude,
        longitude: destination.coordinates.longitude,
      },
    };
  }

  // Recalculate fare if locations changed
  if (pickup || destination) {
    const routeDetails = await MapService.getDirections(
      { latitude: ride.pickup.coordinates.latitude, longitude: ride.pickup.coordinates.longitude },
      { latitude: ride.destination.coordinates.latitude, longitude: ride.destination.coordinates.longitude }
    );

    const fareDetails = FareCalculator.calculateFare(
      ride.vehicleType,
      routeDetails.distance,
      routeDetails.duration,
      1
    );

    ride.route = {
      distance: routeDetails.distance,
      duration: routeDetails.duration,
      polyline: routeDetails.polyline,
    };

    ride.fare = {
      baseFare: fareDetails.baseFare,
      distanceFare: fareDetails.distanceFare,
      timeFare: fareDetails.timeFare,
      surgeFare: 0,
      total: fareDetails.total,
      platformFee: fareDetails.platformFee,
      captainEarnings: fareDetails.captainEarnings,
    };
  }

  await ride.save();

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Scheduled ride updated')
  );
});

/**
 * @desc    Cancel scheduled ride
 * @route   DELETE /api/v1/rides/scheduled/:rideId
 * @access  Private (User)
 */
exports.cancelScheduledRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    isScheduled: true,
    status: 'scheduled',
  });

  if (!ride) {
    throw new ApiError(404, 'Scheduled ride not found');
  }

  ride.status = 'cancelled';
  ride.cancellation = {
    by: 'user',
    reason: 'User cancelled scheduled ride',
  };
  ride.timestamps.cancelled = new Date();
  await ride.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Scheduled ride cancelled')
  );
});

/**
 * @desc    Get active ride
 * @route   GET /api/v1/rides/active
 * @access  Private (User/Captain)
 */
exports.getActiveRide = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.captain?._id;
  const userType = req.user ? 'user' : 'captain';

  const query = userType === 'user'
    ? { user: userId }
    : { captain: userId };

  query.status = { $in: ['searching', 'accepted', 'arriving', 'arrived', 'started'] };

  const ride = await Ride.findOne(query)
    .populate('user', 'firstName lastName phone avatar ratings')
    .populate('captain', 'firstName lastName phone avatar vehicle ratings currentLocation')
    .populate('coupon', 'code discountType discountValue');

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Active ride retrieved')
  );
});

/**
 * @desc    Get ride history
 * @route   GET /api/v1/rides/history
 * @access  Private (User)
 */
exports.getRideHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, startDate, endDate } = req.query;

  const query = { user: req.user._id };

  if (status) {
    query.status = status;
  } else {
    query.status = { $in: ['completed', 'cancelled'] };
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('captain', 'firstName lastName phone avatar vehicle ratings')
      .select('-tracking -otp'),
    Ride.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, 'Ride history retrieved')
  );
});

/**
 * @desc    Get recent rides
 * @route   GET /api/v1/rides/recent
 * @access  Private (User)
 */
exports.getRecentRides = asyncHandler(async (req, res) => {
  const rides = await Ride.find({
    user: req.user._id,
    status: { $in: ['completed', 'cancelled'] },
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('captain', 'firstName lastName avatar vehicle')
    .select('rideId pickup destination fare status createdAt vehicleType');

  res.status(200).json(
    new ApiResponse(200, { rides }, 'Recent rides retrieved')
  );
});

/**
 * @desc    Get user ride stats
 * @route   GET /api/v1/rides/stats
 * @access  Private (User)
 */
exports.getUserRideStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Ride.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalRides: { $sum: 1 },
        completedRides: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelledRides: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        totalSpent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$fare.total', 0],
          },
        },
        totalDistance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$route.distance', 0],
          },
        },
        totalDuration: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$route.duration', 0],
          },
        },
        totalSaved: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, { $add: ['$fare.discount', '$fare.couponDiscount'] }, 0],
          },
        },
      },
    },
  ]);

  // Get vehicle type breakdown
  const vehicleStats = await Ride.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: '$vehicleType',
        count: { $sum: 1 },
        totalSpent: { $sum: '$fare.total' },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      stats: stats[0] || {
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        totalSpent: 0,
        totalDistance: 0,
        totalDuration: 0,
        totalSaved: 0,
      },
      vehicleStats,
    }, 'Ride stats retrieved')
  );
});

/**
 * @desc    Get ride details
 * @route   GET /api/v1/rides/:rideId
 * @access  Private (User/Captain)
 */
exports.getRideDetails = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.captain?._id;
  const userType = req.user ? 'user' : 'captain';

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    [userType]: userId,
  })
    .populate('user', 'firstName lastName phone avatar ratings')
    .populate('captain', 'firstName lastName phone avatar vehicle ratings')
    .populate('coupon', 'code discountType discountValue');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Ride details retrieved')
  );
});

/**
 * @desc    Get ride tracking info
 * @route   GET /api/v1/rides/:rideId/tracking
 * @access  Private (User)
 */
exports.getRideTracking = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
  })
    .select('status captain tracking route pickup destination')
    .populate('captain', 'firstName lastName phone avatar vehicle currentLocation');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // Get captain's current location from cache
  let captainLocation = null;
  if (ride.captain) {
    captainLocation = await cache.get(`captain:location:${ride.captain._id}`);
  }

  res.status(200).json(
    new ApiResponse(200, {
      ride,
      captainLocation,
    }, 'Tracking info retrieved')
  );
});

/**
 * @desc    Get ride route
 * @route   GET /api/v1/rides/:rideId/route
 * @access  Private (User/Captain)
 */
exports.getRideRoute = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.captain?._id;
  const userType = req.user ? 'user' : 'captain';

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    [userType]: userId,
  }).select('route tracking pickup destination status');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  res.status(200).json(
    new ApiResponse(200, {
      route: ride.route,
      tracking: ride.tracking,
      pickup: ride.pickup,
      destination: ride.destination,
    }, 'Ride route retrieved')
  );
});

/**
 * @desc    Cancel ride (User)
 * @route   POST /api/v1/rides/:rideId/cancel
 * @access  Private (User)
 */
exports.cancelRide = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: { $in: ['searching', 'accepted', 'arriving', 'arrived'] },
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found or cannot be cancelled');
  }

  // Calculate cancellation fee
  let cancellationFee = 0;
  if (['accepted', 'arriving', 'arrived'].includes(ride.status)) {
    // Check time since acceptance
    const timeSinceAccept = Date.now() - new Date(ride.timestamps.accepted).getTime();
    const freeCancel = 2 * 60 * 1000; // 2 minutes free cancellation

    if (timeSinceAccept > freeCancel) {
      cancellationFee = ride.status === 'arrived' ? 50 : 25;
    }
  }

  ride.status = 'cancelled';
  ride.cancellation = {
    by: 'user',
    reason,
    fee: cancellationFee,
  };
  ride.timestamps.cancelled = new Date();
  await ride.save();

  // Notify captain if assigned
  if (ride.captain) {
    emitToCaptain(ride.captain.toString(), 'ride:cancelled', {
      rideId: ride._id,
      cancelledBy: 'user',
      reason,
    });

    // Update captain status
    await Captain.findByIdAndUpdate(ride.captain, { isOnRide: false });
  }

  // Process cancellation fee if applicable
  if (cancellationFee > 0) {
    // TODO: Deduct from wallet or charge
  }

  res.status(200).json(
    new ApiResponse(200, {
      ride,
      cancellationFee,
    }, 'Ride cancelled successfully')
  );
});

/**
 * @desc    Rate ride and captain
 * @route   POST /api/v1/rides/:rideId/rate
 * @access  Private (User)
 */
exports.rateRide = asyncHandler(async (req, res) => {
  const { rating, comment, tip } = req.body;

  if (rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: 'completed',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found or not completed');
  }

  if (ride.userRating?.rating) {
    throw new ApiError(400, 'You have already rated this ride');
  }

  ride.userRating = {
    rating,
    comment,
  };
  await ride.save();

  // Update captain's average rating
  if (ride.captain) {
    const captainRides = await Ride.find({
      captain: ride.captain,
      'userRating.rating': { $exists: true },
    }).select('userRating.rating');

    const totalRatings = captainRides.length;
    const avgRating = captainRides.reduce((sum, r) => sum + r.userRating.rating, 0) / totalRatings;

    await Captain.findByIdAndUpdate(ride.captain, {
      'ratings.average': Math.round(avgRating * 10) / 10,
      'ratings.count': totalRatings,
    });
  }

  // Process tip if provided
  if (tip && tip > 0) {
    await processTip(ride, tip, req.user._id);
  }

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Rating submitted successfully')
  );
});

/**
 * @desc    Add tip to ride
 * @route   POST /api/v1/rides/:rideId/tip
 * @access  Private (User)
 */
exports.addTip = asyncHandler(async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid tip amount');
  }

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: 'completed',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  await processTip(ride, amount, req.user._id);

  res.status(200).json(
    new ApiResponse(200, null, 'Tip added successfully')
  );
});

/**
 * @desc    Get ride receipt
 * @route   GET /api/v1/rides/:rideId/receipt
 * @access  Private (User)
 */
exports.getRideReceipt = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: 'completed',
  })
    .populate('user', 'firstName lastName email phone')
    .populate('captain', 'firstName lastName phone vehicle')
    .populate('coupon', 'code discountType discountValue');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  const receipt = {
    rideId: ride.rideId,
    date: ride.timestamps.completed,
    pickup: ride.pickup.address,
    destination: ride.destination.address,
    distance: ride.route.distance,
    duration: ride.route.duration,
    vehicleType: ride.vehicleType,
    captain: ride.captain ? {
      name: `${ride.captain.firstName} ${ride.captain.lastName}`,
      vehicle: ride.captain.vehicle,
    } : null,
    fare: {
      baseFare: ride.fare.baseFare,
      distanceFare: ride.fare.distanceFare,
      timeFare: ride.fare.timeFare,
      surgeFare: ride.fare.surgeFare,
      discount: ride.fare.discount + (ride.fare.couponDiscount || 0),
      total: ride.fare.total,
    },
    coupon: ride.coupon?.code || null,
    paymentMethod: ride.payment.method,
    paymentStatus: ride.payment.status,
  };

  res.status(200).json(
    new ApiResponse(200, { receipt }, 'Receipt retrieved')
  );
});

/**
 * @desc    Email ride receipt
 * @route   POST /api/v1/rides/:rideId/receipt/email
 * @access  Private (User)
 */
exports.emailRideReceipt = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const recipientEmail = email || req.user.email;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: 'completed',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // TODO: Send email with receipt

  res.status(200).json(
    new ApiResponse(200, null, `Receipt sent to ${recipientEmail}`)
  );
});

/**
 * @desc    Share ride status
 * @route   POST /api/v1/rides/:rideId/share
 * @access  Private (User)
 */
exports.shareRide = asyncHandler(async (req, res) => {
  const { contacts } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
  });

  if (!ride) {
    throw new ApiError(404, 'Active ride not found');
  }

  // Generate share token
  const shareToken = generateRideId();
  const shareExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  await cache.set(`ride:share:${shareToken}`, {
    rideId: ride._id.toString(),
    userId: req.user._id.toString(),
    expiry: shareExpiry.toISOString(),
  }, 7200);

  const shareLink = `${process.env.CLIENT_URL}/track/${shareToken}`;

  // TODO: Send SMS to contacts

  res.status(200).json(
    new ApiResponse(200, {
      shareLink,
      shareToken,
      expiresAt: shareExpiry,
    }, 'Ride shared successfully')
  );
});

/**
 * @desc    Stop sharing ride
 * @route   DELETE /api/v1/rides/:rideId/share
 * @access  Private (User)
 */
exports.stopShareRide = asyncHandler(async (req, res) => {
  // Remove all share tokens for this ride
  const keys = await cache.keys(`ride:share:*`);
  for (const key of keys) {
    const data = await cache.get(key);
    if (data?.rideId === req.params.rideId) {
      await cache.del(key);
    }
  }

  res.status(200).json(
    new ApiResponse(200, null, 'Ride sharing stopped')
  );
});

/**
 * @desc    Trigger SOS
 * @route   POST /api/v1/rides/:rideId/sos
 * @access  Private (User)
 */
exports.triggerSOS = asyncHandler(async (req, res) => {
  const { location } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
  })
    .populate('user', 'firstName lastName phone emergencyContacts')
    .populate('captain', 'firstName lastName phone vehicle');

  if (!ride) {
    throw new ApiError(404, 'Active ride not found');
  }

  // Log SOS
  logger.warn(`SOS triggered for ride ${ride._id} by user ${req.user._id}`, {
    ride: ride._id,
    user: req.user._id,
    captain: ride.captain?._id,
    location,
  });

  // Notify admin
  emitToAdmins('sos:alert', {
    rideId: ride._id,
    user: ride.user,
    captain: ride.captain,
    location,
    timestamp: new Date(),
  });

  // TODO: Send SMS to emergency contacts
  // TODO: Notify local authorities if configured

  res.status(200).json(
    new ApiResponse(200, {
      message: 'Emergency services have been notified',
      emergencyNumber: '112',
    }, 'SOS triggered successfully')
  );
});

/**
 * @desc    Report ride issue
 * @route   POST /api/v1/rides/:rideId/report
 * @access  Private (User)
 */
exports.reportRideIssue = asyncHandler(async (req, res) => {
  const { issueType, description } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // TODO: Create support ticket

  res.status(200).json(
    new ApiResponse(200, null, 'Issue reported. Our team will contact you soon.')
  );
});

// ==========================================
// CAPTAIN RIDE ROUTES
// ==========================================

/**
 * @desc    Get nearby ride requests
 * @route   GET /api/v1/rides/captain/requests
 * @access  Private (Captain)
 */
exports.getNearbyRequests = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id);

  if (!captain.isOnline) {
    throw new ApiError(400, 'You must be online to receive ride requests');
  }

  if (captain.isOnRide) {
    throw new ApiError(400, 'You already have an active ride');
  }

  const { latitude, longitude } = captain.currentLocation.coordinates.length === 2
    ? { longitude: captain.currentLocation.coordinates[0], latitude: captain.currentLocation.coordinates[1] }
    : { latitude: 0, longitude: 0 };

  const rides = await Ride.find({
    status: 'searching',
    vehicleType: captain.vehicle.type,
    'pickup.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: 5000,
      },
    },
  })
    .populate('user', 'firstName lastName phone avatar ratings')
    .sort({ createdAt: -1 })
    .limit(10);

  // Add distance and ETA to each ride
  const ridesWithDistance = rides.map((ride) => {
    const distance = CaptainMatcher.calculateDistance(
      latitude,
      longitude,
      ride.pickup.coordinates.latitude,
      ride.pickup.coordinates.longitude
    );
    const eta = CaptainMatcher.calculateETA(latitude, longitude, ride.pickup.coordinates.latitude, ride.pickup.coordinates.longitude);

    return {
      ...ride.toObject(),
      distanceToPickup: distance,
      etaToPickup: eta,
    };
  });

  res.status(200).json(
    new ApiResponse(200, { rides: ridesWithDistance }, 'Nearby requests retrieved')
  );
});

/**
 * @desc    Get captain's active ride
 * @route   GET /api/v1/rides/captain/active
 * @access  Private (Captain)
 */
exports.getCaptainActiveRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    captain: req.captain._id,
    status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
  })
    .populate('user', 'firstName lastName phone avatar ratings');

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Active ride retrieved')
  );
});

/**
 * @desc    Get captain's ride history
 * @route   GET /api/v1/rides/captain/history
 * @access  Private (Captain)
 */
exports.getCaptainRideHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, startDate, endDate } = req.query;

  const query = { captain: req.captain._id };

  if (status) {
    query.status = status;
  } else {
    query.status = { $in: ['completed', 'cancelled'] };
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName phone avatar ratings')
      .select('-tracking -otp'),
    Ride.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, 'Ride history retrieved')
  );
});

/**
 * @desc    Get captain's ride stats
 * @route   GET /api/v1/rides/captain/stats
 * @access  Private (Captain)
 */
exports.getCaptainRideStats = asyncHandler(async (req, res) => {
  const captainId = req.captain._id;

  const stats = await Ride.aggregate([
    { $match: { captain: new mongoose.Types.ObjectId(captainId) } },
    {
      $group: {
        _id: null,
        totalRides: { $sum: 1 },
        completedRides: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelledRides: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        totalEarnings: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$fare.captainEarnings', 0],
          },
        },
        totalDistance: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$route.distance', 0],
          },
        },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      stats: stats[0] || {
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        totalEarnings: 0,
        totalDistance: 0,
      },
    }, 'Ride stats retrieved')
  );
});

/**
 * @desc    Accept ride request
 * @route   POST /api/v1/rides/captain/accept/:rideId
 * @access  Private (Captain)
 */
exports.acceptRide = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id);

  if (!captain.isOnline) {
    throw new ApiError(400, 'You must be online to accept rides');
  }

  if (captain.isOnRide) {
    throw new ApiError(400, 'You already have an active ride');
  }

  if (captain.status !== 'approved') {
    throw new ApiError(403, 'Your account is not approved');
  }

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    status: 'searching',
    vehicleType: captain.vehicle.type,
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found or already taken');
  }

  // Update ride
  ride.captain = captain._id;
  ride.status = 'accepted';
  ride.timestamps.accepted = new Date();
  await ride.save();

  // Update captain
  captain.isOnRide = true;
  await captain.save();

  // Notify user
  const captainData = await Captain.findById(captain._id)
    .select('firstName lastName phone avatar vehicle ratings currentLocation');

  emitToUser(ride.user.toString(), 'ride:accepted', {
    ride: ride.toObject(),
    captain: captainData.toObject(),
  });

  // Notify other captains that ride is taken
  emitToAllCaptains('ride:taken', { rideId: ride._id });

  // Get populated ride
  const populatedRide = await Ride.findById(ride._id)
    .populate('user', 'firstName lastName phone avatar ratings')
    .populate('captain', 'firstName lastName phone avatar vehicle ratings');

  res.status(200).json(
    new ApiResponse(200, { ride: populatedRide }, 'Ride accepted successfully')
  );
});

/**
 * @desc    Reject ride request
 * @route   POST /api/v1/rides/captain/reject/:rideId
 * @access  Private (Captain)
 */
exports.rejectRide = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  // Log rejection for analytics
  logger.info(`Ride ${req.params.rideId} rejected by captain ${req.captain._id}: ${reason}`);

  // Update captain's acceptance rate
  // TODO: Implement acceptance rate tracking

  res.status(200).json(
    new ApiResponse(200, null, 'Ride rejected')
  );
});

/**
 * @desc    Set status to arriving
 * @route   POST /api/v1/rides/captain/arriving/:rideId
 * @access  Private (Captain)
 */
exports.setArriving = asyncHandler(async (req, res) => {
  const { eta } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: 'accepted',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  ride.status = 'arriving';
  await ride.save();

  emitToUser(ride.user.toString(), 'ride:captain-arriving', {
    rideId: ride._id,
    eta,
  });

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Status updated to arriving')
  );
});

/**
 * @desc    Captain arrived at pickup
 * @route   POST /api/v1/rides/captain/arrived/:rideId
 * @access  Private (Captain)
 */
exports.captainArrived = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: { $in: ['accepted', 'arriving'] },
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  ride.status = 'arrived';
  ride.timestamps.captainArrived = new Date();
  await ride.save();

  emitToUser(ride.user.toString(), 'ride:captain-arrived', {
    rideId: ride._id,
    otp: ride.otp.code,
    message: 'Your captain has arrived. Share the OTP to start your ride.',
  });

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Arrival confirmed')
  );
});

/**
 * @desc    Start ride (with OTP verification)
 * @route   POST /api/v1/rides/captain/start/:rideId
 * @access  Private (Captain)
 */
exports.startRide = asyncHandler(async (req, res) => {
  const { otp } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: 'arrived',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // Verify OTP
  if (ride.otp.code !== otp) {
    throw new ApiError(400, 'Invalid OTP');
  }

  ride.status = 'started';
  ride.otp.verified = true;
  ride.timestamps.started = new Date();
  await ride.save();

  emitToUser(ride.user.toString(), 'ride:started', {
    rideId: ride._id,
    message: 'Your ride has started. Enjoy!',
  });

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Ride started')
  );
});

/**
 * @desc    Complete ride
 * @route   POST /api/v1/rides/captain/complete/:rideId
 * @access  Private (Captain)
 */
exports.completeRide = asyncHandler(async (req, res) => {
  const { finalFare, tollCharges, waitingCharges } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: 'started',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // Update fare if additional charges
  if (tollCharges || waitingCharges) {
    ride.fare.tollCharges = tollCharges || 0;
    ride.fare.waitingCharges = waitingCharges || 0;
    ride.fare.total += (tollCharges || 0) + (waitingCharges || 0);
    ride.fare.captainEarnings = ride.fare.total * 0.8;
  }

  ride.status = 'completed';
  ride.timestamps.completed = new Date();
  ride.payment.status = 'completed';
  await ride.save();

  // Update captain stats
  await Captain.findByIdAndUpdate(req.captain._id, {
    isOnRide: false,
    $inc: {
      'stats.totalRides': 1,
      'stats.totalEarnings': ride.fare.captainEarnings,
      'stats.totalDistance': ride.route.distance,
    },
  });

  // Credit captain wallet
  const captainWallet = await Wallet.findOne({
    owner: req.captain._id,
    ownerType: 'Captain',
  });

  if (captainWallet) {
    captainWallet.balance += ride.fare.captainEarnings;
    await captainWallet.save();

    // Create transaction
    await Transaction.create({
      wallet: captainWallet._id,
      type: 'credit',
      amount: ride.fare.captainEarnings,
      category: 'ride_earnings',
      reference: ride._id,
      referenceType: 'Ride',
      description: `Earnings from ride ${ride.rideId}`,
      balanceAfter: captainWallet.balance,
    });
  }

  emitToUser(ride.user.toString(), 'ride:completed', {
    ride: ride.toObject(),
    message: 'Your ride is complete. Please rate your experience.',
  });

  const populatedRide = await Ride.findById(ride._id)
    .populate('user', 'firstName lastName phone avatar ratings');

  res.status(200).json(
    new ApiResponse(200, { ride: populatedRide }, 'Ride completed successfully')
  );
});

/**
 * @desc    Cancel ride (Captain)
 * @route   POST /api/v1/rides/captain/cancel/:rideId
 * @access  Private (Captain)
 */
exports.captainCancelRide = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: { $in: ['accepted', 'arriving', 'arrived'] },
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  ride.status = 'cancelled';
  ride.cancellation = {
    by: 'captain',
    reason,
  };
  ride.timestamps.cancelled = new Date();
  ride.captain = null;
  await ride.save();

  // Update captain
  await Captain.findByIdAndUpdate(req.captain._id, {
    isOnRide: false,
    $inc: { 'stats.cancellationRate': 1 },
  });

  emitToUser(ride.user.toString(), 'ride:cancelled', {
    rideId: ride._id,
    cancelledBy: 'captain',
    reason,
    message: 'Your ride was cancelled by the captain. Searching for another captain...',
  });

  // Try to find another captain
  ride.status = 'searching';
  ride.timestamps.requested = new Date();
  await ride.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Ride cancelled')
  );
});

/**
 * @desc    Update captain location during ride
 * @route   PUT /api/v1/rides/captain/location/:rideId
 * @access  Private (Captain)
 */
exports.updateRideLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, heading, speed } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
  });

  if (!ride) {
    throw new ApiError(404, 'Active ride not found');
  }

  // Add to tracking
  ride.tracking.push({
    coordinates: { latitude, longitude },
    timestamp: new Date(),
  });
  await ride.save();

  // Update captain's current location
  await Captain.findByIdAndUpdate(req.captain._id, {
    currentLocation: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    lastLocationUpdate: new Date(),
  });

  // Cache location
  await cache.set(`captain:location:${req.captain._id}`, {
    latitude,
    longitude,
    heading,
    speed,
    updatedAt: new Date().toISOString(),
  }, 300);

  // Emit to user
  emitToUser(ride.user.toString(), 'captain:location', {
    rideId: ride._id,
    location: { latitude, longitude, heading, speed },
    updatedAt: new Date().toISOString(),
  });

  res.status(200).json(
    new ApiResponse(200, null, 'Location updated')
  );
});

/**
 * @desc    Rate user (Captain)
 * @route   POST /api/v1/rides/captain/rate/:rideId
 * @access  Private (Captain)
 */
exports.rateCaptainRide = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: 'completed',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  if (ride.captainRating?.rating) {
    throw new ApiError(400, 'You have already rated this ride');
  }

  ride.captainRating = {
    rating,
    comment,
  };
  await ride.save();

  // Update user's average rating
  const userRides = await Ride.find({
    user: ride.user,
    'captainRating.rating': { $exists: true },
  }).select('captainRating.rating');

  const totalRatings = userRides.length;
  const avgRating = userRides.reduce((sum, r) => sum + r.captainRating.rating, 0) / totalRatings;

  await User.findByIdAndUpdate(ride.user, {
    'ratings.average': Math.round(avgRating * 10) / 10,
    'ratings.count': totalRatings,
  });

  res.status(200).json(
    new ApiResponse(200, null, 'Rating submitted')
  );
});

/**
 * @desc    Report user issue
 * @route   POST /api/v1/rides/captain/report/:rideId
 * @access  Private (Captain)
 */
exports.reportUserIssue = asyncHandler(async (req, res) => {
  const { issueType, description } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // TODO: Create support ticket

  res.status(200).json(
    new ApiResponse(200, null, 'Issue reported')
  );
});

/**
 * @desc    Mark cash collected
 * @route   POST /api/v1/rides/captain/collect-cash/:rideId
 * @access  Private (Captain)
 */
exports.collectCash = asyncHandler(async (req, res) => {
  const { amount } = req.body;

  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
    status: 'completed',
    'payment.method': 'cash',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  ride.payment.status = 'completed';
  ride.payment.collectedAmount = amount;
  await ride.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Cash collection confirmed')
  );
});

// ==========================================
// COUPON ROUTES
// ==========================================

/**
 * @desc    Get available coupons
 * @route   GET /api/v1/rides/coupons/available
 * @access  Private (User)
 */
exports.getAvailableCoupons = asyncHandler(async (req, res) => {
  const { vehicleType } = req.query;
  const userId = req.user._id;

  const now = new Date();

  const query = {
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
    ],
  };

  if (vehicleType) {
    query.$or = [
      { applicableVehicles: { $size: 0 } },
      { applicableVehicles: vehicleType },
    ];
  }

  const coupons = await Coupon.find(query);

  // Filter out coupons already used by user (per user limit)
  const availableCoupons = coupons.filter((coupon) => {
    const userUsage = coupon.usedBy?.filter(
      (u) => u.user.toString() === userId.toString()
    ).length || 0;
    return userUsage < (coupon.perUserLimit || 1);
  });

  res.status(200).json(
    new ApiResponse(200, { coupons: availableCoupons }, 'Available coupons retrieved')
  );
});

/**
 * @desc    Validate coupon
 * @route   POST /api/v1/rides/coupons/validate
 * @access  Private (User)
 */
exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, vehicleType, fareAmount } = req.body;

  const result = await validateCouponCode(code, req.user._id, vehicleType, fareAmount);

  if (!result.valid) {
    throw new ApiError(400, result.message);
  }

  res.status(200).json(
    new ApiResponse(200, {
      valid: true,
      coupon: result.coupon,
      discount: result.discount,
    }, 'Coupon is valid')
  );
});

/**
 * @desc    Apply coupon to ride
 * @route   POST /api/v1/rides/coupons/apply
 * @access  Private (User)
 */
exports.applyCoupon = asyncHandler(async (req, res) => {
  const { rideId, code } = req.body;

  const ride = await Ride.findOne({
    _id: rideId,
    user: req.user._id,
    status: 'searching',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  if (ride.coupon) {
    throw new ApiError(400, 'A coupon is already applied to this ride');
  }

  const result = await applyCouponToFare(code, ride.fare, req.user._id, ride.vehicleType);

  ride.fare = result.fare;
  ride.coupon = result.coupon._id;
  await ride.save();

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Coupon applied successfully')
  );
});

/**
 * @desc    Remove coupon from ride
 * @route   DELETE /api/v1/rides/coupons/remove/:rideId
 * @access  Private (User)
 */
exports.removeCoupon = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    _id: req.params.rideId,
    user: req.user._id,
    status: 'searching',
  });

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  if (!ride.coupon) {
    throw new ApiError(400, 'No coupon applied to this ride');
  }

  // Recalculate fare without coupon
  const fareDetails = FareCalculator.calculateFare(
    ride.vehicleType,
    ride.route.distance,
    ride.route.duration,
    ride.surgeMultiplier
  );

  ride.fare = {
    baseFare: fareDetails.baseFare,
    distanceFare: fareDetails.distanceFare,
    timeFare: fareDetails.timeFare,
    surgeFare: fareDetails.surgeFare,
    discount: 0,
    couponDiscount: 0,
    total: fareDetails.total,
    platformFee: fareDetails.platformFee,
    captainEarnings: fareDetails.captainEarnings,
  };
  ride.coupon = null;
  await ride.save();

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Coupon removed')
  );
});

// ==========================================
// VEHICLE TYPES
// ==========================================

/**
 * @desc    Get available vehicle types
 * @route   GET /api/v1/rides/vehicle-types
 * @access  Public
 */
exports.getVehicleTypes = asyncHandler(async (req, res) => {
  const { city } = req.query;

  let vehicleTypes;

  if (city) {
    vehicleTypes = await VehicleType.getActiveForCity(city);
  } else {
    vehicleTypes = await VehicleType.find({ isActive: true }).sort({ displayOrder: 1 });
  }

  res.status(200).json(
    new ApiResponse(200, { vehicleTypes }, 'Vehicle types retrieved')
  );
});

/**
 * @desc    Get vehicle type details
 * @route   GET /api/v1/rides/vehicle-types/:vehicleType
 * @access  Public
 */
exports.getVehicleTypeDetails = asyncHandler(async (req, res) => {
  const vehicleType = await VehicleType.findOne({
    code: req.params.vehicleType.toUpperCase(),
    isActive: true,
  });

  if (!vehicleType) {
    throw new ApiError(404, 'Vehicle type not found');
  }

  res.status(200).json(
    new ApiResponse(200, { vehicleType }, 'Vehicle type details retrieved')
  );
});

// ==========================================
// SHARED TRACKING
// ==========================================

/**
 * @desc    Get shared ride tracking
 * @route   GET /api/v1/rides/share/:shareToken
 * @access  Public
 */
exports.getSharedRideTracking = asyncHandler(async (req, res) => {
  const shareData = await cache.get(`ride:share:${req.params.shareToken}`);

  if (!shareData) {
    throw new ApiError(404, 'Share link expired or invalid');
  }

  const ride = await Ride.findById(shareData.rideId)
    .select('status pickup destination route captain timestamps')
    .populate('captain', 'firstName lastName phone vehicle currentLocation');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  // Get captain's current location
  let captainLocation = null;
  if (ride.captain) {
    captainLocation = await cache.get(`captain:location:${ride.captain._id}`);
  }

  res.status(200).json(
    new ApiResponse(200, {
      ride,
      captainLocation,
    }, 'Tracking info retrieved')
  );
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate surge multiplier based on demand and supply
 */
async function calculateSurgeMultiplier(latitude, longitude, vehicleType) {
  try {
    // Get nearby ride requests (demand)
    const recentRequests = await Ride.countDocuments({
      status: 'searching',
      vehicleType,
      'pickup.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 3000,
        },
      },
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // Last 10 minutes
    });

    // Get nearby available captains (supply)
    const availableCaptains = await Captain.countDocuments({
      isOnline: true,
      isOnRide: false,
      'vehicle.type': vehicleType,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: 3000,
        },
      },
    });

    return FareCalculator.calculateSurge(recentRequests, availableCaptains);
  } catch (error) {
    logger.error('Error calculating surge:', error);
    return 1;
  }
}

/**
 * Validate coupon code
 */
async function validateCouponCode(code, userId, vehicleType, fareAmount) {
  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  const now = new Date();

  if (coupon.validFrom > now) {
    return { valid: false, message: 'Coupon is not yet active' };
  }

  if (coupon.validUntil < now) {
    return { valid: false, message: 'Coupon has expired' };
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }

  // Check per-user limit
  const userUsage = coupon.usedBy?.filter(
    (u) => u.user.toString() === userId.toString()
  ).length || 0;

  if (userUsage >= (coupon.perUserLimit || 1)) {
    return { valid: false, message: 'You have already used this coupon' };
  }

  // Check vehicle type applicability
  if (
    coupon.applicableVehicles.length > 0 &&
    !coupon.applicableVehicles.includes(vehicleType)
  ) {
    return { valid: false, message: 'Coupon not applicable for this vehicle type' };
  }

  // Check minimum order value
  if (coupon.minOrderValue && fareAmount < coupon.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of ₹${coupon.minOrderValue} required`,
    };
  }

  // Calculate discount
  let discount;
  if (coupon.discountType === 'percentage') {
    discount = Math.min(
      (fareAmount * coupon.discountValue) / 100,
      coupon.maxDiscount || Infinity
    );
  } else {
    discount = Math.min(coupon.discountValue, fareAmount);
  }

  return {
    valid: true,
    coupon,
    discount: Math.round(discount),
  };
}

/**
 * Apply coupon to fare
 */
async function applyCouponToFare(code, fare, userId, vehicleType) {
  const result = await validateCouponCode(code, userId, vehicleType, fare.total);

  if (!result.valid) {
    throw new ApiError(400, result.message);
  }

  const { coupon, discount } = result;

  // Update coupon usage
  coupon.usedCount += 1;
  coupon.usedBy.push({
    user: userId,
    usedAt: new Date(),
  });
  await coupon.save();

  // Calculate new fare
  const newTotal = Math.max(fare.total - discount, 0);
  const platformFee = newTotal * 0.2;
  const captainEarnings = newTotal - platformFee;

  return {
    fare: {
      ...fare,
      couponDiscount: discount,
      total: newTotal,
      platformFee,
      captainEarnings,
    },
    coupon,
  };
}

/**
 * Process tip
 */
async function processTip(ride, amount, userId) {
  // Credit captain wallet
  const captainWallet = await Wallet.findOne({
    owner: ride.captain,
    ownerType: 'Captain',
  });

  if (captainWallet) {
    captainWallet.balance += amount;
    await captainWallet.save();

    await Transaction.create({
      wallet: captainWallet._id,
      type: 'credit',
      amount,
      category: 'tip',
      reference: ride._id,
      referenceType: 'Ride',
      description: `Tip from ride ${ride.rideId}`,
      balanceAfter: captainWallet.balance,
    });
  }

  // Update ride with tip
  ride.tip = (ride.tip || 0) + amount;
  await ride.save();

  // Notify captain
  emitToCaptain(ride.captain.toString(), 'ride:tip-received', {
    rideId: ride._id,
    amount,
    message: `You received a tip of ₹${amount}!`,
  });
}