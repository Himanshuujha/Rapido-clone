// src/controllers/captainController.js
const Captain = require('../models/Captain');
const Vehicle = require('../models/Vehicle');
const Ride = require('../models/Ride');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const CaptainLocationHistory = require('../models/CaptainLocationHistory');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { deleteFile, extractPublicId } = require('../config/cloudinary');
const { cache } = require('../config/redis');
const { parsePagination } = require('../utils/helpers');
const logger = require('../utils/logger');

// ==========================================
// PROFILE
// ==========================================

/**
 * @desc    Get captain profile
 * @route   GET /api/v1/captains/profile
 * @access  Private (Captain)
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id)
    .populate('wallet')
    .select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { captain }, 'Profile retrieved successfully')
  );
});

/**
 * @desc    Update captain profile
 * @route   PUT /api/v1/captains/profile
 * @access  Private (Captain)
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;

  // Check if email/phone already exists
  if (email && email !== req.captain.email) {
    const existingEmail = await Captain.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.captain._id },
    });
    if (existingEmail) {
      throw new ApiError(400, 'Email already in use');
    }
  }

  if (phone && phone !== req.captain.phone) {
    const existingPhone = await Captain.findOne({
      phone,
      _id: { $ne: req.captain._id },
    });
    if (existingPhone) {
      throw new ApiError(400, 'Phone number already in use');
    }
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    {
      firstName: firstName || req.captain.firstName,
      lastName: lastName || req.captain.lastName,
      email: email ? email.toLowerCase() : req.captain.email,
      phone: phone || req.captain.phone,
    },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { captain }, 'Profile updated successfully')
  );
});

/**
 * @desc    Update captain avatar
 * @route   PUT /api/v1/captains/avatar
 * @access  Private (Captain)
 */
exports.updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please upload an image');
  }

  // Delete old avatar
  if (req.captain.avatar) {
    const publicId = extractPublicId(req.captain.avatar);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    { avatar: req.file.path },
    { new: true }
  ).select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { captain }, 'Avatar updated successfully')
  );
});

/**
 * @desc    Remove captain avatar
 * @route   DELETE /api/v1/captains/avatar
 * @access  Private (Captain)
 */
exports.removeAvatar = asyncHandler(async (req, res) => {
  if (req.captain.avatar) {
    const publicId = extractPublicId(req.captain.avatar);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    { avatar: '' },
    { new: true }
  ).select('-password -refreshToken');

  res.status(200).json(
    new ApiResponse(200, { captain }, 'Avatar removed successfully')
  );
});

// ==========================================
// DOCUMENTS
// ==========================================

/**
 * @desc    Get all documents
 * @route   GET /api/v1/captains/documents
 * @access  Private (Captain)
 */
exports.getDocuments = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('documents');

  res.status(200).json(
    new ApiResponse(200, { documents: captain.documents }, 'Documents retrieved')
  );
});

/**
 * @desc    Get document verification status
 * @route   GET /api/v1/captains/documents/status
 * @access  Private (Captain)
 */
exports.getDocumentStatus = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('documents status');

  const documentStatus = {
    drivingLicense: {
      uploaded: !!captain.documents?.drivingLicense?.image,
      verified: captain.documents?.drivingLicense?.verified || false,
      rejectionReason: captain.documents?.drivingLicense?.rejectionReason,
    },
    vehicleRC: {
      uploaded: !!captain.documents?.vehicleRC?.image,
      verified: captain.documents?.vehicleRC?.verified || false,
      rejectionReason: captain.documents?.vehicleRC?.rejectionReason,
    },
    insurance: {
      uploaded: !!captain.documents?.insurance?.image,
      verified: captain.documents?.insurance?.verified || false,
      rejectionReason: captain.documents?.insurance?.rejectionReason,
    },
    aadhar: {
      uploaded: !!captain.documents?.aadhar?.image,
      verified: captain.documents?.aadhar?.verified || false,
      rejectionReason: captain.documents?.aadhar?.rejectionReason,
    },
    pan: {
      uploaded: !!captain.documents?.pan?.image,
      verified: captain.documents?.pan?.verified || false,
      rejectionReason: captain.documents?.pan?.rejectionReason,
    },
    profilePhoto: {
      uploaded: !!captain.documents?.profilePhoto?.image,
      verified: captain.documents?.profilePhoto?.verified || false,
      rejectionReason: captain.documents?.profilePhoto?.rejectionReason,
    },
  };

  const allVerified = Object.values(documentStatus).every(doc => doc.verified);
  const allUploaded = Object.values(documentStatus).every(doc => doc.uploaded);

  res.status(200).json(
    new ApiResponse(200, {
      documents: documentStatus,
      allUploaded,
      allVerified,
      captainStatus: captain.status,
    }, 'Document status retrieved')
  );
});

/**
 * @desc    Upload a document
 * @route   POST /api/v1/captains/documents/:documentType
 * @access  Private (Captain)
 */
exports.uploadDocument = asyncHandler(async (req, res) => {
  const { documentType } = req.params;
  const { number, expiryDate } = req.body;

  const validTypes = ['drivingLicense', 'vehicleRC', 'insurance', 'aadhar', 'pan', 'profilePhoto'];
  if (!validTypes.includes(documentType)) {
    throw new ApiError(400, 'Invalid document type');
  }

  if (!req.file) {
    throw new ApiError(400, 'Please upload a document');
  }

  // Delete old document if exists
  const oldDoc = req.captain.documents?.[documentType]?.image;
  if (oldDoc) {
    const publicId = extractPublicId(oldDoc);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  const updateData = {
    [`documents.${documentType}.image`]: req.file.path,
    [`documents.${documentType}.verified`]: false,
    [`documents.${documentType}.rejectionReason`]: null,
  };

  if (number) {
    updateData[`documents.${documentType}.number`] = number;
  }
  if (expiryDate) {
    updateData[`documents.${documentType}.expiryDate`] = new Date(expiryDate);
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    updateData,
    { new: true }
  ).select('documents');

  res.status(200).json(
    new ApiResponse(200, { documents: captain.documents }, 'Document uploaded successfully')
  );
});

/**
 * @desc    Update a document
 * @route   PUT /api/v1/captains/documents/:documentType
 * @access  Private (Captain)
 */
exports.updateDocument = asyncHandler(async (req, res) => {
  const { documentType } = req.params;
  const { number, expiryDate } = req.body;

  const validTypes = ['drivingLicense', 'vehicleRC', 'insurance', 'aadhar', 'pan', 'profilePhoto'];
  if (!validTypes.includes(documentType)) {
    throw new ApiError(400, 'Invalid document type');
  }

  const updateData = {
    [`documents.${documentType}.verified`]: false,
    [`documents.${documentType}.rejectionReason`]: null,
  };

  if (req.file) {
    // Delete old document
    const oldDoc = req.captain.documents?.[documentType]?.image;
    if (oldDoc) {
      const publicId = extractPublicId(oldDoc);
      if (publicId) {
        await deleteFile(publicId);
      }
    }
    updateData[`documents.${documentType}.image`] = req.file.path;
  }

  if (number) {
    updateData[`documents.${documentType}.number`] = number;
  }
  if (expiryDate) {
    updateData[`documents.${documentType}.expiryDate`] = new Date(expiryDate);
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    updateData,
    { new: true }
  ).select('documents');

  res.status(200).json(
    new ApiResponse(200, { documents: captain.documents }, 'Document updated successfully')
  );
});

/**
 * @desc    Delete a document
 * @route   DELETE /api/v1/captains/documents/:documentType
 * @access  Private (Captain)
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const { documentType } = req.params;

  const doc = req.captain.documents?.[documentType]?.image;
  if (doc) {
    const publicId = extractPublicId(doc);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  await Captain.findByIdAndUpdate(req.captain._id, {
    [`documents.${documentType}`]: null,
  });

  res.status(200).json(
    new ApiResponse(200, null, 'Document deleted successfully')
  );
});

// ==========================================
// VEHICLE
// ==========================================

/**
 * @desc    Get vehicle details
 * @route   GET /api/v1/captains/vehicle
 * @access  Private (Captain)
 */
exports.getVehicle = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('vehicle');

  res.status(200).json(
    new ApiResponse(200, { vehicle: captain.vehicle }, 'Vehicle retrieved')
  );
});

/**
 * @desc    Update vehicle details
 * @route   PUT /api/v1/captains/vehicle
 * @access  Private (Captain)
 */
exports.updateVehicle = asyncHandler(async (req, res) => {
  const { type, make, model, year, color, registrationNumber } = req.body;

  // Check if registration number exists
  if (registrationNumber && registrationNumber !== req.captain.vehicle?.registrationNumber) {
    const existing = await Captain.findOne({
      'vehicle.registrationNumber': registrationNumber.toUpperCase(),
      _id: { $ne: req.captain._id },
    });
    if (existing) {
      throw new ApiError(400, 'Vehicle registration number already registered');
    }
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    {
      'vehicle.type': type || req.captain.vehicle?.type,
      'vehicle.make': make || req.captain.vehicle?.make,
      'vehicle.model': model || req.captain.vehicle?.model,
      'vehicle.year': year || req.captain.vehicle?.year,
      'vehicle.color': color || req.captain.vehicle?.color,
      'vehicle.registrationNumber': registrationNumber?.toUpperCase() || req.captain.vehicle?.registrationNumber,
    },
    { new: true }
  ).select('vehicle');

  res.status(200).json(
    new ApiResponse(200, { vehicle: captain.vehicle }, 'Vehicle updated successfully')
  );
});

/**
 * @desc    Upload vehicle images
 * @route   POST /api/v1/captains/vehicle/images
 * @access  Private (Captain)
 */
exports.uploadVehicleImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'Please upload at least one image');
  }

  const images = {};
  req.files.forEach((file, index) => {
    const imageType = req.body.imageTypes?.[index] || `image${index + 1}`;
    images[imageType] = file.path;
  });

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    { 'vehicle.images': { ...req.captain.vehicle?.images, ...images } },
    { new: true }
  ).select('vehicle');

  res.status(200).json(
    new ApiResponse(200, { vehicle: captain.vehicle }, 'Vehicle images uploaded')
  );
});

/**
 * @desc    Delete vehicle image
 * @route   DELETE /api/v1/captains/vehicle/images/:imageType
 * @access  Private (Captain)
 */
exports.deleteVehicleImage = asyncHandler(async (req, res) => {
  const { imageType } = req.params;

  const imageUrl = req.captain.vehicle?.images?.[imageType];
  if (imageUrl) {
    const publicId = extractPublicId(imageUrl);
    if (publicId) {
      await deleteFile(publicId);
    }
  }

  await Captain.findByIdAndUpdate(req.captain._id, {
    [`vehicle.images.${imageType}`]: null,
  });

  res.status(200).json(
    new ApiResponse(200, null, 'Vehicle image deleted')
  );
});

// ==========================================
// STATUS
// ==========================================

/**
 * @desc    Get captain status
 * @route   GET /api/v1/captains/status
 * @access  Private (Captain)
 */
exports.getStatus = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id)
    .select('isOnline isOnRide status currentLocation lastLocationUpdate');

  res.status(200).json(
    new ApiResponse(200, {
      isOnline: captain.isOnline,
      isOnRide: captain.isOnRide,
      accountStatus: captain.status,
      currentLocation: captain.currentLocation,
      lastLocationUpdate: captain.lastLocationUpdate,
    }, 'Status retrieved')
  );
});

/**
 * @desc    Toggle online/offline status
 * @route   PUT /api/v1/captains/status
 * @access  Private (Captain)
 */
exports.toggleStatus = asyncHandler(async (req, res) => {
  const { isOnline, latitude, longitude } = req.body;

  if (req.captain.status !== 'approved') {
    throw new ApiError(403, 'Your account is not approved yet');
  }

  const updateData = { isOnline };

  if (isOnline && latitude && longitude) {
    updateData.currentLocation = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
    updateData.lastLocationUpdate = new Date();

    // Cache location in Redis
    await cache.set(`captain:location:${req.captain._id}`, {
      latitude,
      longitude,
      isOnline: true,
      updatedAt: new Date().toISOString(),
    }, 300);
  } else if (!isOnline) {
    await cache.del(`captain:location:${req.captain._id}`);
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    updateData,
    { new: true }
  ).select('isOnline isOnRide currentLocation');

  res.status(200).json(
    new ApiResponse(200, { captain }, `You are now ${isOnline ? 'online' : 'offline'}`)
  );
});

/**
 * @desc    Go online
 * @route   PUT /api/v1/captains/go-online
 * @access  Private (Captain)
 */
exports.goOnline = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;

  if (req.captain.status !== 'approved') {
    throw new ApiError(403, 'Your account is not approved yet');
  }

  if (!latitude || !longitude) {
    throw new ApiError(400, 'Location is required to go online');
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    {
      isOnline: true,
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      lastLocationUpdate: new Date(),
    },
    { new: true }
  ).select('isOnline isOnRide currentLocation');

  await cache.set(`captain:location:${req.captain._id}`, {
    latitude,
    longitude,
    isOnline: true,
    updatedAt: new Date().toISOString(),
  }, 300);

  res.status(200).json(
    new ApiResponse(200, { captain }, 'You are now online')
  );
});

/**
 * @desc    Go offline
 * @route   PUT /api/v1/captains/go-offline
 * @access  Private (Captain)
 */
exports.goOffline = asyncHandler(async (req, res) => {
  if (req.captain.isOnRide) {
    throw new ApiError(400, 'Cannot go offline while on a ride');
  }

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    { isOnline: false },
    { new: true }
  ).select('isOnline isOnRide');

  await cache.del(`captain:location:${req.captain._id}`);

  res.status(200).json(
    new ApiResponse(200, { captain }, 'You are now offline')
  );
});

/**
 * @desc    Get approval status
 * @route   GET /api/v1/captains/approval-status
 * @access  Private (Captain)
 */
exports.getApprovalStatus = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id)
    .select('status documents');

  const pendingDocuments = [];
  const rejectedDocuments = [];

  const docTypes = ['drivingLicense', 'vehicleRC', 'insurance', 'aadhar', 'pan', 'profilePhoto'];

  docTypes.forEach(docType => {
    const doc = captain.documents?.[docType];
    if (!doc?.image) {
      pendingDocuments.push(docType);
    } else if (!doc.verified && doc.rejectionReason) {
      rejectedDocuments.push({
        type: docType,
        reason: doc.rejectionReason,
      });
    } else if (!doc.verified) {
      pendingDocuments.push(docType);
    }
  });

  res.status(200).json(
    new ApiResponse(200, {
      status: captain.status,
      pendingDocuments,
      rejectedDocuments,
      message: captain.status === 'pending' 
        ? 'Your application is under review' 
        : captain.status === 'approved'
          ? 'Your account is approved'
          : 'Please check rejected documents',
    }, 'Approval status retrieved')
  );
});

// ==========================================
// LOCATION
// ==========================================

/**
 * @desc    Update current location
 * @route   PUT /api/v1/captains/location
 * @access  Private (Captain)
 */
exports.updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, heading, speed, accuracy } = req.body;

  if (!latitude || !longitude) {
    throw new ApiError(400, 'Latitude and longitude are required');
  }

  // Update in database
  await Captain.findByIdAndUpdate(req.captain._id, {
    currentLocation: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    lastLocationUpdate: new Date(),
  });

  // Update in Redis cache
  await cache.set(`captain:location:${req.captain._id}`, {
    latitude,
    longitude,
    heading,
    speed,
    accuracy,
    isOnline: true,
    updatedAt: new Date().toISOString(),
  }, 300);

  // If on ride, store in location history
  if (req.captain.isOnRide) {
    const activeRide = await Ride.findOne({
      captain: req.captain._id,
      status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
    });

    if (activeRide) {
      await CaptainLocationHistory.create({
        captain: req.captain._id,
        ride: activeRide._id,
        latitude,
        longitude,
        coordinates: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        heading,
        speed,
        accuracy,
        captainStatus: 'on_ride',
      });

      // Emit location to user via socket
      if (global.io) {
        global.io.to(activeRide.user.toString()).emit('captain:location', {
          rideId: activeRide._id,
          location: { latitude, longitude, heading, speed },
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  res.status(200).json(
    new ApiResponse(200, null, 'Location updated')
  );
});

/**
 * @desc    Get location history
 * @route   GET /api/v1/captains/location/history
 * @access  Private (Captain)
 */
exports.getLocationHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate, rideId } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  const query = { captain: req.captain._id };

  if (rideId) {
    query.ride = rideId;
  }

  if (startDate || endDate) {
    query.recordedAt = {};
    if (startDate) query.recordedAt.$gte = new Date(startDate);
    if (endDate) query.recordedAt.$lte = new Date(endDate);
  }

  const [history, total] = await Promise.all([
    CaptainLocationHistory.find(query)
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('latitude longitude speed heading recordedAt'),
    CaptainLocationHistory.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, 'Location history retrieved')
  );
});

// ==========================================
// EARNINGS
// ==========================================

/**
 * @desc    Get earnings summary
 * @route   GET /api/v1/captains/earnings
 * @access  Private (Captain)
 */
exports.getEarnings = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id)
    .select('stats wallet')
    .populate('wallet');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayEarnings, weeklyEarnings] = await Promise.all([
    Ride.aggregate([
      {
        $match: {
          captain: req.captain._id,
          status: 'completed',
          'timestamps.completed': { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$fare.captainEarnings' },
          rides: { $sum: 1 },
        },
      },
    ]),
    Ride.aggregate([
      {
        $match: {
          captain: req.captain._id,
          status: 'completed',
          'timestamps.completed': {
            $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$fare.captainEarnings' },
          rides: { $sum: 1 },
        },
      },
    ]),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      walletBalance: captain.wallet?.balance || 0,
      totalEarnings: captain.stats?.totalEarnings || 0,
      totalRides: captain.stats?.totalRides || 0,
      todayEarnings: todayEarnings[0]?.total || 0,
      todayRides: todayEarnings[0]?.rides || 0,
      weeklyEarnings: weeklyEarnings[0]?.total || 0,
      weeklyRides: weeklyEarnings[0]?.rides || 0,
    }, 'Earnings retrieved')
  );
});

/**
 * @desc    Get today's earnings
 * @route   GET /api/v1/captains/earnings/today
 * @access  Private (Captain)
 */
exports.getTodayEarnings = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const earnings = await Ride.aggregate([
    {
      $match: {
        captain: req.captain._id,
        status: 'completed',
        'timestamps.completed': { $gte: today },
      },
    },
    {
      $group: {
        _id: { $hour: '$timestamps.completed' },
        earnings: { $sum: '$fare.captainEarnings' },
        rides: { $sum: 1 },
        distance: { $sum: '$route.distance' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const total = earnings.reduce((sum, e) => sum + e.earnings, 0);
  const totalRides = earnings.reduce((sum, e) => sum + e.rides, 0);

  res.status(200).json(
    new ApiResponse(200, {
      total,
      totalRides,
      hourlyBreakdown: earnings,
    }, 'Today earnings retrieved')
  );
});

/**
 * @desc    Get weekly earnings
 * @route   GET /api/v1/captains/earnings/week
 * @access  Private (Captain)
 */
exports.getWeeklyEarnings = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const earnings = await Ride.aggregate([
    {
      $match: {
        captain: req.captain._id,
        status: 'completed',
        'timestamps.completed': { $gte: weekStart },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$timestamps.completed' },
        earnings: { $sum: '$fare.captainEarnings' },
        rides: { $sum: 1 },
        distance: { $sum: '$route.distance' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const total = earnings.reduce((sum, e) => sum + e.earnings, 0);
  const totalRides = earnings.reduce((sum, e) => sum + e.rides, 0);

  res.status(200).json(
    new ApiResponse(200, {
      total,
      totalRides,
      dailyBreakdown: earnings,
    }, 'Weekly earnings retrieved')
  );
});

/**
 * @desc    Get monthly earnings
 * @route   GET /api/v1/captains/earnings/month
 * @access  Private (Captain)
 */
exports.getMonthlyEarnings = asyncHandler(async (req, res) => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const earnings = await Ride.aggregate([
    {
      $match: {
        captain: req.captain._id,
        status: 'completed',
        'timestamps.completed': { $gte: monthStart },
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: '$timestamps.completed' },
        earnings: { $sum: '$fare.captainEarnings' },
        rides: { $sum: 1 },
        distance: { $sum: '$route.distance' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const total = earnings.reduce((sum, e) => sum + e.earnings, 0);
  const totalRides = earnings.reduce((sum, e) => sum + e.rides, 0);

  res.status(200).json(
    new ApiResponse(200, {
      total,
      totalRides,
      dailyBreakdown: earnings,
    }, 'Monthly earnings retrieved')
  );
});

/**
 * @desc    Get earnings history
 * @route   GET /api/v1/captains/earnings/history
 * @access  Private (Captain)
 */
exports.getEarningsHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const { page, limit, skip } = parsePagination(req.query);

  const query = {
    captain: req.captain._id,
    status: 'completed',
  };

  if (startDate || endDate) {
    query['timestamps.completed'] = {};
    if (startDate) query['timestamps.completed'].$gte = new Date(startDate);
    if (endDate) query['timestamps.completed'].$lte = new Date(endDate);
  }

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ 'timestamps.completed': -1 })
      .skip(skip)
      .limit(limit)
      .select('rideId fare route timestamps vehicleType pickup destination'),
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
    }, 'Earnings history retrieved')
  );
});

/**
 * @desc    Get earnings breakdown
 * @route   GET /api/v1/captains/earnings/breakdown
 * @access  Private (Captain)
 */
exports.getEarningsBreakdown = asyncHandler(async (req, res) => {
  const { period = 'week' } = req.query;

  let startDate;
  const today = new Date();

  switch (period) {
    case 'day':
      startDate = new Date(today.setHours(0, 0, 0, 0));
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    default: // week
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const breakdown = await Ride.aggregate([
    {
      $match: {
        captain: req.captain._id,
        status: 'completed',
        'timestamps.completed': { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        baseFare: { $sum: '$fare.baseFare' },
        distanceFare: { $sum: '$fare.distanceFare' },
        timeFare: { $sum: '$fare.timeFare' },
        surgeFare: { $sum: '$fare.surgeFare' },
        tips: { $sum: '$fare.tip' },
        totalEarnings: { $sum: '$fare.captainEarnings' },
        totalRides: { $sum: 1 },
        totalDistance: { $sum: '$route.distance' },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      period,
      breakdown: breakdown[0] || {
        baseFare: 0,
        distanceFare: 0,
        timeFare: 0,
        surgeFare: 0,
        tips: 0,
        totalEarnings: 0,
        totalRides: 0,
        totalDistance: 0,
      },
    }, 'Earnings breakdown retrieved')
  );
});

// ==========================================
// STATS
// ==========================================

/**
 * @desc    Get performance stats
 * @route   GET /api/v1/captains/stats
 * @access  Private (Captain)
 */
exports.getStats = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('stats ratings');

  res.status(200).json(
    new ApiResponse(200, {
      totalRides: captain.stats?.totalRides || 0,
      totalEarnings: captain.stats?.totalEarnings || 0,
      totalDistance: captain.stats?.totalDistance || 0,
      acceptanceRate: captain.stats?.acceptanceRate || 100,
      cancellationRate: captain.stats?.cancellationRate || 0,
      rating: captain.ratings?.average || 5,
      ratingCount: captain.ratings?.count || 0,
    }, 'Stats retrieved')
  );
});

/**
 * @desc    Get ratings stats
 * @route   GET /api/v1/captains/stats/ratings
 * @access  Private (Captain)
 */
exports.getRatingsStats = asyncHandler(async (req, res) => {
  const ratings = await Ride.aggregate([
    {
      $match: {
        captain: req.captain._id,
        'captainRating.rating': { $exists: true },
      },
    },
    {
      $group: {
        _id: '$captainRating.rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const captain = await Captain.findById(req.captain._id).select('ratings');

  res.status(200).json(
    new ApiResponse(200, {
      average: captain.ratings?.average || 5,
      totalCount: captain.ratings?.count || 0,
      breakdown: ratings,
    }, 'Ratings stats retrieved')
  );
});

/**
 * @desc    Get ride statistics
 * @route   GET /api/v1/captains/stats/rides
 * @access  Private (Captain)
 */
exports.getRideStats = asyncHandler(async (req, res) => {
  const { period = 'week' } = req.query;

  let startDate;
  const today = new Date();

  switch (period) {
    case 'day':
      startDate = new Date(today.setHours(0, 0, 0, 0));
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(today.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const stats = await Ride.aggregate([
    {
      $match: {
        captain: req.captain._id,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, { period, stats }, 'Ride stats retrieved')
  );
});

/**
 * @desc    Get acceptance rate
 * @route   GET /api/v1/captains/stats/acceptance-rate
 * @access  Private (Captain)
 */
exports.getAcceptanceRate = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('stats');

  res.status(200).json(
    new ApiResponse(200, {
      acceptanceRate: captain.stats?.acceptanceRate || 100,
    }, 'Acceptance rate retrieved')
  );
});

/**
 * @desc    Get cancellation rate
 * @route   GET /api/v1/captains/stats/cancellation-rate
 * @access  Private (Captain)
 */
exports.getCancellationRate = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('stats');

  res.status(200).json(
    new ApiResponse(200, {
      cancellationRate: captain.stats?.cancellationRate || 0,
    }, 'Cancellation rate retrieved')
  );
});

// ==========================================
// RIDE REQUESTS
// ==========================================

/**
 * @desc    Get nearby ride requests
 * @route   GET /api/v1/captains/ride-requests
 * @access  Private (Captain)
 */
exports.getNearbyRequests = asyncHandler(async (req, res) => {
  if (!req.captain.isOnline) {
    throw new ApiError(400, 'You must be online to receive ride requests');
  }

  if (req.captain.isOnRide) {
    throw new ApiError(400, 'You are already on a ride');
  }

  const location = req.captain.currentLocation?.coordinates;
  if (!location || location[0] === 0) {
    throw new ApiError(400, 'Location not available. Please update your location.');
  }

  const rides = await Ride.find({
    status: 'searching',
    vehicleType: req.captain.vehicle?.type,
    'pickup.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: location,
        },
        $maxDistance: 5000, // 5km
      },
    },
  })
    .populate('user', 'firstName lastName ratings avatar')
    .sort({ createdAt: -1 })
    .limit(10);

  res.status(200).json(
    new ApiResponse(200, { rides }, 'Nearby requests retrieved')
  );
});

/**
 * @desc    Get ride request history
 * @route   GET /api/v1/captains/ride-requests/history
 * @access  Private (Captain)
 */
exports.getRequestHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const query = { captain: req.captain._id };
  if (status) query.status = status;

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName')
      .select('rideId status pickup destination fare createdAt'),
    Ride.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      rides,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Request history retrieved')
  );
});

/**
 * @desc    Get ride history
 * @route   GET /api/v1/captains/rides
 * @access  Private (Captain)
 */
exports.getRideHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const query = { captain: req.captain._id };
  if (status) query.status = status;

  const [rides, total] = await Promise.all([
    Ride.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName ratings avatar')
      .select('-tracking'),
    Ride.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      rides,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Ride history retrieved')
  );
});

/**
 * @desc    Get active ride
 * @route   GET /api/v1/captains/rides/active
 * @access  Private (Captain)
 */
exports.getActiveRide = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    captain: req.captain._id,
    status: { $in: ['accepted', 'arriving', 'arrived', 'started'] },
  }).populate('user', 'firstName lastName phone ratings avatar');

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Active ride retrieved')
  );
});

/**
 * @desc    Get ride details
 * @route   GET /api/v1/captains/rides/:rideId
 * @access  Private (Captain)
 */
exports.getRideDetails = asyncHandler(async (req, res) => {
  const ride = await Ride.findOne({
    _id: req.params.rideId,
    captain: req.captain._id,
  }).populate('user', 'firstName lastName phone ratings avatar');

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  res.status(200).json(
    new ApiResponse(200, { ride }, 'Ride details retrieved')
  );
});

// ==========================================
// BANK DETAILS
// ==========================================

/**
 * @desc    Get bank details
 * @route   GET /api/v1/captains/bank-details
 * @access  Private (Captain)
 */
exports.getBankDetails = asyncHandler(async (req, res) => {
  const captain = await Captain.findById(req.captain._id).select('bankDetails');

  res.status(200).json(
    new ApiResponse(200, { bankDetails: captain.bankDetails }, 'Bank details retrieved')
  );
});

/**
 * @desc    Update bank details
 * @route   PUT /api/v1/captains/bank-details
 * @access  Private (Captain)
 */
exports.updateBankDetails = asyncHandler(async (req, res) => {
  const { accountNumber, ifscCode, accountHolderName, bankName } = req.body;

  const captain = await Captain.findByIdAndUpdate(
    req.captain._id,
    {
      bankDetails: {
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        accountHolderName,
        bankName,
      },
    },
    { new: true }
  ).select('bankDetails');

  res.status(200).json(
    new ApiResponse(200, { bankDetails: captain.bankDetails }, 'Bank details updated')
  );
});

/**
 * @desc    Verify bank account
 * @route   POST /api/v1/captains/bank-details/verify
 * @access  Private (Captain)
 */
exports.verifyBankAccount = asyncHandler(async (req, res) => {
  // TODO: Implement bank account verification via payment gateway
  res.status(200).json(
    new ApiResponse(200, { verified: true }, 'Bank account verification initiated')
  );
});

// ==========================================
// WITHDRAWALS (Simplified - full in walletController)
// ==========================================

/**
 * @desc    Get withdrawals
 * @route   GET /api/v1/captains/withdrawals
 * @access  Private (Captain)
 */
exports.getWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const wallet = await Wallet.findOne({ owner: req.captain._id, ownerType: 'Captain' });

  const [transactions, total] = await Promise.all([
    Transaction.find({
      wallet: wallet._id,
      category: 'withdrawal',
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments({ wallet: wallet._id, category: 'withdrawal' }),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      withdrawals: transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Withdrawals retrieved')
  );
});

/**
 * @desc    Request withdrawal
 * @route   POST /api/v1/captains/withdrawals
 * @access  Private (Captain)
 */
exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount } = req.body;

  const wallet = await Wallet.findOne({ owner: req.captain._id, ownerType: 'Captain' });

  if (!wallet || wallet.balance < amount) {
    throw new ApiError(400, 'Insufficient balance');
  }

  if (!req.captain.bankDetails?.accountNumber) {
    throw new ApiError(400, 'Please add bank details first');
  }

  // Create withdrawal transaction
  const transaction = await Transaction.create({
    wallet: wallet._id,
    type: 'debit',
    amount,
    category: 'withdrawal',
    description: 'Withdrawal to bank account',
    status: 'pending',
  });

  // Deduct from wallet
  wallet.balance -= amount;
  await wallet.save();

  res.status(200).json(
    new ApiResponse(200, { transaction }, 'Withdrawal request submitted')
  );
});

/**
 * @desc    Get withdrawal details
 * @route   GET /api/v1/captains/withdrawals/:withdrawalId
 * @access  Private (Captain)
 */
exports.getWithdrawalDetails = asyncHandler(async (req, res) => {
  const wallet = await Wallet.findOne({ owner: req.captain._id, ownerType: 'Captain' });

  const transaction = await Transaction.findOne({
    _id: req.params.withdrawalId,
    wallet: wallet._id,
    category: 'withdrawal',
  });

  if (!transaction) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  res.status(200).json(
    new ApiResponse(200, { withdrawal: transaction }, 'Withdrawal details retrieved')
  );
});

/**
 * @desc    Cancel withdrawal
 * @route   POST /api/v1/captains/withdrawals/:withdrawalId/cancel
 * @access  Private (Captain)
 */
exports.cancelWithdrawal = asyncHandler(async (req, res) => {
  const wallet = await Wallet.findOne({ owner: req.captain._id, ownerType: 'Captain' });

  const transaction = await Transaction.findOne({
    _id: req.params.withdrawalId,
    wallet: wallet._id,
    category: 'withdrawal',
    status: 'pending',
  });

  if (!transaction) {
    throw new ApiError(404, 'Pending withdrawal not found');
  }

  // Refund to wallet
  wallet.balance += transaction.amount;
  await wallet.save();

  transaction.status = 'failed';
  transaction.description = 'Cancelled by user';
  await transaction.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Withdrawal cancelled')
  );
});

// ==========================================
// INCENTIVES
// ==========================================

/**
 * @desc    Get available incentives
 * @route   GET /api/v1/captains/incentives
 * @access  Private (Captain)
 */
exports.getIncentives = asyncHandler(async (req, res) => {
  // TODO: Implement incentives model
  const incentives = [
    {
      id: '1',
      title: 'Complete 10 rides today',
      description: 'Earn ₹100 bonus',
      target: 10,
      current: 5,
      reward: 100,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      id: '2',
      title: 'Weekend Warrior',
      description: 'Complete 20 rides this weekend',
      target: 20,
      current: 8,
      reward: 300,
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  ];

  res.status(200).json(
    new ApiResponse(200, { incentives }, 'Incentives retrieved')
  );
});

/**
 * @desc    Get active incentives
 * @route   GET /api/v1/captains/incentives/active
 * @access  Private (Captain)
 */
exports.getActiveIncentives = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { incentives: [] }, 'Active incentives retrieved')
  );
});

/**
 * @desc    Get incentive progress
 * @route   GET /api/v1/captains/incentives/progress
 * @access  Private (Captain)
 */
exports.getIncentiveProgress = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { progress: [] }, 'Incentive progress retrieved')
  );
});

/**
 * @desc    Get incentive history
 * @route   GET /api/v1/captains/incentives/history
 * @access  Private (Captain)
 */
exports.getIncentiveHistory = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { history: [] }, 'Incentive history retrieved')
  );
});

// ==========================================
// NOTIFICATIONS
// ==========================================

/**
 * @desc    Get notifications
 * @route   GET /api/v1/captains/notifications
 * @access  Private (Captain)
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { category, unreadOnly } = req.query;

  const query = {
    recipient: req.captain._id,
    recipientType: 'Captain',
    isDismissed: false,
  };

  if (category) query.category = category;
  if (unreadOnly === 'true') query.isRead = false;

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Notifications retrieved')
  );
});

/**
 * @desc    Get unread count
 * @route   GET /api/v1/captains/notifications/unread-count
 * @access  Private (Captain)
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.captain._id,
    recipientType: 'Captain',
    isRead: false,
    isDismissed: false,
  });

  res.status(200).json(
    new ApiResponse(200, { count }, 'Unread count retrieved')
  );
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/captains/notifications/:notificationId/read
 * @access  Private (Captain)
 */
exports.markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, recipient: req.captain._id },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json(
    new ApiResponse(200, null, 'Notification marked as read')
  );
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/captains/notifications/read-all
 * @access  Private (Captain)
 */
exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.captain._id, recipientType: 'Captain', isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.status(200).json(
    new ApiResponse(200, null, 'All notifications marked as read')
  );
});

/**
 * @desc    Update FCM token
 * @route   PUT /api/v1/captains/fcm-token
 * @access  Private (Captain)
 */
exports.updateFCMToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;

  await Captain.findByIdAndUpdate(req.captain._id, { fcmToken });

  res.status(200).json(
    new ApiResponse(200, null, 'FCM token updated')
  );
});

// ==========================================
// HEAT MAP & SURGE
// ==========================================

/**
 * @desc    Get heat map
 * @route   GET /api/v1/captains/heat-map
 * @access  Private (Captain)
 */
exports.getHeatMap = asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 10000 } = req.query;

  // Get ride demand in the area
  const recentRides = await Ride.aggregate([
    {
      $match: {
        status: 'searching',
        createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 mins
      },
    },
    {
      $group: {
        _id: {
          lat: { $round: [{ $arrayElemAt: ['$pickup.coordinates.coordinates', 1] }, 2] },
          lng: { $round: [{ $arrayElemAt: ['$pickup.coordinates.coordinates', 0] }, 2] },
        },
        demand: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, { heatMap: recentRides }, 'Heat map retrieved')
  );
});

/**
 * @desc    Get surge areas
 * @route   GET /api/v1/captains/surge-areas
 * @access  Private (Captain)
 */
exports.getSurgeAreas = asyncHandler(async (req, res) => {
  // TODO: Implement surge areas from SurgeZone model
  const surgeAreas = [];

  res.status(200).json(
    new ApiResponse(200, { surgeAreas }, 'Surge areas retrieved')
  );
});

/**
 * @desc    Get recommended zones
 * @route   GET /api/v1/captains/recommended-zones
 * @access  Private (Captain)
 */
exports.getRecommendedZones = asyncHandler(async (req, res) => {
  const zones = [
    { name: 'Airport', demand: 'High', distance: '5.2 km' },
    { name: 'Railway Station', demand: 'Medium', distance: '3.1 km' },
    { name: 'IT Park', demand: 'High', distance: '7.8 km' },
  ];

  res.status(200).json(
    new ApiResponse(200, { zones }, 'Recommended zones retrieved')
  );
});

// ==========================================
// PREFERENCES
// ==========================================

/**
 * @desc    Get preferences
 * @route   GET /api/v1/captains/preferences
 * @access  Private (Captain)
 */
exports.getPreferences = asyncHandler(async (req, res) => {
  // TODO: Implement captain preferences model
  const preferences = {
    autoAccept: false,
    maxDistance: 10,
    preferredAreas: [],
    notifications: {
      rideRequests: true,
      promotions: true,
      earnings: true,
    },
  };

  res.status(200).json(
    new ApiResponse(200, { preferences }, 'Preferences retrieved')
  );
});

/**
 * @desc    Update preferences
 * @route   PUT /api/v1/captains/preferences
 * @access  Private (Captain)
 */
exports.updatePreferences = asyncHandler(async (req, res) => {
  // TODO: Save preferences
  res.status(200).json(
    new ApiResponse(200, null, 'Preferences updated')
  );
});

// ==========================================
// SUPPORT
// ==========================================

/**
 * @desc    Get support tickets
 * @route   GET /api/v1/captains/support/tickets
 * @access  Private (Captain)
 */
exports.getSupportTickets = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { tickets: [] }, 'Support tickets retrieved')
  );
});

/**
 * @desc    Create support ticket
 * @route   POST /api/v1/captains/support/tickets
 * @access  Private (Captain)
 */
exports.createSupportTicket = asyncHandler(async (req, res) => {
  res.status(201).json(
    new ApiResponse(201, null, 'Support ticket created')
  );
});

/**
 * @desc    Get support ticket details
 * @route   GET /api/v1/captains/support/tickets/:ticketId
 * @access  Private (Captain)
 */
exports.getSupportTicketDetails = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { ticket: null }, 'Ticket details retrieved')
  );
});

/**
 * @desc    Reply to support ticket
 * @route   POST /api/v1/captains/support/tickets/:ticketId/reply
 * @access  Private (Captain)
 */
exports.replySupportTicket = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Reply sent')
  );
});

/**
 * @desc    Get FAQs
 * @route   GET /api/v1/captains/support/faqs
 * @access  Private (Captain)
 */
exports.getFAQs = asyncHandler(async (req, res) => {
  const faqs = [
    {
      question: 'How do I receive ride requests?',
      answer: 'Go online and ensure your location is enabled. Ride requests will appear automatically.',
    },
    {
      question: 'How do I withdraw my earnings?',
      answer: 'Go to Wallet > Withdraw and enter the amount. Funds will be transferred within 24 hours.',
    },
    {
      question: 'What if a customer cancels the ride?',
      answer: 'If cancelled after you arrive, you may receive a cancellation fee.',
    },
  ];

  res.status(200).json(
    new ApiResponse(200, { faqs }, 'FAQs retrieved')
  );
});

// ==========================================
// TRAINING
// ==========================================

/**
 * @desc    Get training materials
 * @route   GET /api/v1/captains/training
 * @access  Private (Captain)
 */
exports.getTrainingMaterials = asyncHandler(async (req, res) => {
  const materials = [
    { id: '1', title: 'Getting Started', completed: true },
    { id: '2', title: 'Safety Guidelines', completed: false },
    { id: '3', title: 'Customer Service', completed: false },
  ];

  res.status(200).json(
    new ApiResponse(200, { materials }, 'Training materials retrieved')
  );
});

/**
 * @desc    Get training module
 * @route   GET /api/v1/captains/training/:moduleId
 * @access  Private (Captain)
 */
exports.getTrainingModule = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, { module: null }, 'Training module retrieved')
  );
});

/**
 * @desc    Complete training module
 * @route   POST /api/v1/captains/training/:moduleId/complete
 * @access  Private (Captain)
 */
exports.completeTrainingModule = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, null, 'Training module completed')
  );
});

// ==========================================
// ACCOUNT MANAGEMENT
// ==========================================

/**
 * @desc    Deactivate account
 * @route   POST /api/v1/captains/account/deactivate
 * @access  Private (Captain)
 */
exports.deactivateAccount = asyncHandler(async (req, res) => {
  const { reason, password } = req.body;

  const captain = await Captain.findById(req.captain._id).select('+password');

  const isMatch = await captain.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(400, 'Password is incorrect');
  }

  captain.status = 'suspended';
  captain.isOnline = false;
  captain.refreshToken = undefined;
  await captain.save();

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Account deactivated successfully')
  );
});

/**
 * @desc    Delete account
 * @route   DELETE /api/v1/captains/account
 * @access  Private (Captain)
 */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmDelete } = req.body;

  if (!confirmDelete) {
    throw new ApiError(400, 'Please confirm account deletion');
  }

  const captain = await Captain.findById(req.captain._id).select('+password');

  const isMatch = await captain.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(400, 'Password is incorrect');
  }

  // Check for pending withdrawals
  const wallet = await Wallet.findOne({ owner: req.captain._id });
  if (wallet && wallet.balance > 0) {
    throw new ApiError(400, 'Please withdraw your balance before deleting account');
  }

  await Captain.findByIdAndDelete(req.captain._id);

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Account deleted successfully')
  );
});