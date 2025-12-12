// src/middlewares/upload.js
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// FILE FILTERS
// ==========================================

const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError('Only images (JPG, PNG, WebP, GIF) are allowed', 400), false);
  }
};

const documentFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError('Only images and PDF files are allowed', 400), false);
  }
};

// ==========================================
// STORAGE CONFIGURATIONS
// ==========================================

// Memory storage
const memoryStorage = multer.memoryStorage();

// Disk storage
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Cloudinary storage factory
const createCloudinaryStorage = (folder, options = {}) => {
  return new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const userId = req.user?._id || req.captain?._id || 'anonymous';
      const timestamp = Date.now();
      const randomStr = crypto.randomBytes(4).toString('hex');

      return {
        folder: `rideapp/${folder}/${userId}`,
        public_id: `${timestamp}-${randomStr}`,
        allowed_formats: options.formats || ['jpg', 'jpeg', 'png', 'webp'],
        transformation: options.transformation || [{ quality: 'auto', fetch_format: 'auto' }],
        resource_type: options.resourceType || 'auto',
      };
    },
  });
};

// Pre-configured storages
const avatarStorage = createCloudinaryStorage('avatars', {
  transformation: [
    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    { quality: 'auto', fetch_format: 'auto' },
  ],
});

const documentStorage = createCloudinaryStorage('documents', {
  formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
  resourceType: 'auto',
});

const vehicleStorage = createCloudinaryStorage('vehicles', {
  transformation: [
    { width: 800, height: 600, crop: 'limit' },
    { quality: 'auto', fetch_format: 'auto' },
  ],
});

// ==========================================
// UPLOAD CONFIGURATIONS
// ==========================================

const uploadConfigs = {
  avatar: {
    storage: avatarStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  },
  document: {
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  },
  vehicle: {
    storage: vehicleStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  },
  memory: {
    storage: memoryStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
  },
  local: {
    storage: diskStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
  },
};

// ==========================================
// UPLOAD MIDDLEWARE CREATORS
// ==========================================

/**
 * Create multer instance
 */
const createUpload = (type = 'memory') => {
  const config = uploadConfigs[type] || uploadConfigs.memory;
  return multer({
    storage: config.storage,
    fileFilter: config.fileFilter,
    limits: config.limits,
  });
};

/**
 * Single file upload
 */
const uploadSingle = (fieldName = 'file', type = 'memory') => {
  return createUpload(type).single(fieldName);
};

/**
 * Multiple files upload (same field)
 */
const uploadMultiple = (fieldName = 'files', maxCount = 5, type = 'memory') => {
  return createUpload(type).array(fieldName, maxCount);
};

/**
 * Multiple fields upload
 */
const uploadFields = (fields, type = 'memory') => {
  return createUpload(type).fields(fields);
};

/**
 * Any files upload
 */
const uploadAny = (type = 'memory') => {
  return createUpload(type).any();
};

// ==========================================
// SPECIALIZED UPLOAD MIDDLEWARES
// ==========================================

// Avatar upload
const uploadAvatar = uploadSingle('avatar', 'avatar');

// Single document
const uploadDocument = uploadSingle('document', 'document');

// Multiple documents
const uploadDocuments = uploadMultiple('documents', 5, 'document');

// Vehicle photos
const uploadVehiclePhotos = uploadMultiple('photos', 4, 'vehicle');

// Captain onboarding documents
const uploadCaptainDocuments = uploadFields(
  [
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'drivingLicense', maxCount: 2 },
    { name: 'vehicleRC', maxCount: 2 },
    { name: 'insurance', maxCount: 1 },
    { name: 'permit', maxCount: 1 },
    { name: 'aadhaar', maxCount: 2 },
    { name: 'panCard', maxCount: 1 },
  ],
  'document'
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Delete file from Cloudinary
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    logger.info('Cloudinary delete:', { publicId, result });
    return result;
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw error;
  }
};

/**
 * Delete multiple files from Cloudinary
 */
const deleteMultipleFromCloudinary = async (publicIds, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    logger.error('Cloudinary bulk delete error:', error);
    throw error;
  }
};

/**
 * Extract public ID from Cloudinary URL
 */
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary')) return null;

  try {
    const parts = url.split('/upload/')[1];
    if (!parts) return null;

    const pathParts = parts.split('/').slice(1);
    const filename = pathParts.join('/');
    return filename.replace(/\.[^/.]+$/, '');
  } catch (error) {
    logger.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Upload buffer to Cloudinary
 */
const uploadBuffer = async (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `rideapp/${folder}`,
        resource_type: 'auto',
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Upload from URL
 */
const uploadFromUrl = async (url, folder, options = {}) => {
  try {
    return await cloudinary.uploader.upload(url, {
      folder: `rideapp/${folder}`,
      resource_type: 'auto',
      ...options,
    });
  } catch (error) {
    logger.error('Upload from URL error:', error);
    throw error;
  }
};

/**
 * Get optimized URL
 */
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    ...options,
  });
};

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

/**
 * Handle upload errors
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return next(ApiError.badRequest('File size too large'));
      case 'LIMIT_FILE_COUNT':
        return next(ApiError.badRequest('Too many files'));
      case 'LIMIT_UNEXPECTED_FILE':
        return next(ApiError.badRequest(`Unexpected field: ${err.field}`));
      default:
        return next(ApiError.badRequest(err.message));
    }
  }

  if (err.message?.includes('allowed')) {
    return next(ApiError.badRequest(err.message));
  }

  next(err);
};

/**
 * Validate upload
 */
const validateUpload = (options = {}) => {
  return (req, res, next) => {
    const { required = false, minSize, maxSize } = options;

    if (required && !req.file && (!req.files || Object.keys(req.files).length === 0)) {
      return next(ApiError.badRequest('File is required'));
    }

    const files = req.file
      ? [req.file]
      : Object.values(req.files || {}).flat();

    for (const file of files) {
      if (minSize && file.size < minSize) {
        return next(ApiError.badRequest(`File too small. Minimum: ${minSize} bytes`));
      }
      if (maxSize && file.size > maxSize) {
        return next(ApiError.badRequest(`File too large. Maximum: ${maxSize} bytes`));
      }
    }

    next();
  };
};

module.exports = {
  // Storage
  memoryStorage,
  diskStorage,
  createCloudinaryStorage,

  // Creators
  createUpload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  uploadAny,

  // Specialized
  uploadAvatar,
  uploadDocument,
  uploadDocuments,
  uploadVehiclePhotos,
  uploadCaptainDocuments,

  // Helpers
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  getPublicIdFromUrl,
  uploadBuffer,
  uploadFromUrl,
  getOptimizedUrl,

  // Error handling
  handleUploadError,
  validateUpload,

  // Cloudinary instance
  cloudinary,
};