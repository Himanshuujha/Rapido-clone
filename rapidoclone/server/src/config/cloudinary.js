// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const logger = require('../utils/logger');

// ==========================================
// CLOUDINARY CONFIGURATION
// ==========================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Verify connection
const verifyCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    logger.info('Cloudinary connection verified:', result.status);
    return true;
  } catch (error) {
    logger.error('Cloudinary connection failed:', error.message);
    return false;
  }
};

// ==========================================
// FOLDER STRUCTURE
// ==========================================

const FOLDERS = {
  AVATARS: 'rapido-clone/avatars',
  DOCUMENTS: 'rapido-clone/documents',
  VEHICLES: 'rapido-clone/vehicles',
  MISC: 'rapido-clone/misc',
};

// ==========================================
// STORAGE CONFIGURATIONS
// ==========================================

/**
 * Avatar storage configuration
 */
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.AVATARS,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const userId = req.user?._id || req.captain?._id || 'unknown';
      return `avatar-${userId}-${uniqueSuffix}`;
    },
  },
});

/**
 * Document storage configuration
 */
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const userId = req.user?._id || req.captain?._id || 'unknown';
    const docType = req.body?.documentType || req.params?.documentType || 'misc';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

    // Determine resource type based on file type
    const isPDF = file.mimetype === 'application/pdf';

    return {
      folder: `${FOLDERS.DOCUMENTS}/${userId}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
      resource_type: isPDF ? 'raw' : 'image',
      transformation: isPDF
        ? undefined
        : [{ quality: 'auto:good' }, { fetch_format: 'auto' }],
      public_id: `${docType}-${uniqueSuffix}`,
    };
  },
});

/**
 * Vehicle image storage configuration
 */
const vehicleStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.VEHICLES,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'fill' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const captainId = req.captain?._id || 'unknown';
      const imageType = req.body?.imageType || 'vehicle';
      return `${imageType}-${captainId}-${uniqueSuffix}`;
    },
  },
});

/**
 * General file storage configuration
 */
const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: FOLDERS.MISC,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    resource_type: 'auto',
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const name = path.parse(file.originalname).name.replace(/\s+/g, '-');
      return `${name}-${uniqueSuffix}`;
    },
  },
});

// ==========================================
// FILE FILTERS
// ==========================================

/**
 * Image file filter
 */
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

/**
 * Document file filter (images + PDF)
 */
const documentFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.'), false);
  }
};

// ==========================================
// MULTER UPLOAD INSTANCES
// ==========================================

/**
 * Avatar upload middleware
 */
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * Document upload middleware
 */
const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Vehicle image upload middleware
 */
const uploadVehicleImage = multer({
  storage: vehicleStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * General file upload middleware
 */
const uploadGeneral = multer({
  storage: generalStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Upload file to Cloudinary directly (without multer)
 * @param {string} filePath - Local file path or base64 string
 * @param {object} options - Upload options
 * @returns {Promise<object>} - Upload result
 */
const uploadFile = async (filePath, options = {}) => {
  try {
    const defaultOptions = {
      folder: FOLDERS.MISC,
      resource_type: 'auto',
      ...options,
    };

    const result = await cloudinary.uploader.upload(filePath, defaultOptions);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.bytes,
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file');
  }
};

/**
 * Upload base64 image
 * @param {string} base64String - Base64 encoded image
 * @param {object} options - Upload options
 * @returns {Promise<object>} - Upload result
 */
const uploadBase64 = async (base64String, options = {}) => {
  try {
    // Add data URI prefix if not present
    let dataUri = base64String;
    if (!base64String.startsWith('data:')) {
      dataUri = `data:image/jpeg;base64,${base64String}`;
    }

    return await uploadFile(dataUri, options);
  } catch (error) {
    logger.error('Base64 upload error:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<object>} - Deletion result
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return {
      success: result.result === 'ok',
      result: result.result,
    };
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file');
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param {string[]} publicIds - Array of Cloudinary public IDs
 * @param {string} resourceType - Resource type
 * @returns {Promise<object>} - Deletion result
 */
const deleteMultipleFiles = async (publicIds, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });

    return {
      success: true,
      deleted: result.deleted,
    };
  } catch (error) {
    logger.error('Cloudinary bulk delete error:', error);
    throw new Error('Failed to delete files');
  }
};

/**
 * Generate optimized image URL
 * @param {string} publicId - Cloudinary public ID
 * @param {object} transformations - Transformation options
 * @returns {string} - Optimized URL
 */
const getOptimizedUrl = (publicId, transformations = {}) => {
  const defaultTransformations = {
    quality: 'auto',
    fetch_format: 'auto',
    ...transformations,
  };

  return cloudinary.url(publicId, defaultTransformations);
};

/**
 * Generate thumbnail URL
 * @param {string} publicId - Cloudinary public ID
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {string} - Thumbnail URL
 */
const getThumbnailUrl = (publicId, width = 150, height = 150) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    fetch_format: 'auto',
  });
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID
 */
const extractPublicId = (url) => {
  if (!url) return null;

  try {
    // Handle different URL formats
    const regex = /\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);

    if (match && match[1]) {
      return match[1];
    }

    // Try another pattern for URLs without version
    const regex2 = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/;
    const match2 = url.match(regex2);

    return match2 ? match2[1] : null;
  } catch (error) {
    logger.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Create a signed URL for secure access
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - URL options
 * @returns {string} - Signed URL
 */
const getSignedUrl = (publicId, options = {}) => {
  const defaultOptions = {
    type: 'authenticated',
    sign_url: true,
    ...options,
  };

  return cloudinary.url(publicId, defaultOptions);
};

/**
 * Rename/move a file in Cloudinary
 * @param {string} fromPublicId - Source public ID
 * @param {string} toPublicId - Destination public ID
 * @returns {Promise<object>} - Rename result
 */
const renameFile = async (fromPublicId, toPublicId) => {
  try {
    const result = await cloudinary.uploader.rename(fromPublicId, toPublicId);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error('Cloudinary rename error:', error);
    throw new Error('Failed to rename file');
  }
};

/**
 * Get file info from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} - File info
 */
const getFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.bytes,
      createdAt: result.created_at,
    };
  } catch (error) {
    logger.error('Cloudinary get info error:', error);
    throw new Error('Failed to get file info');
  }
};

/**
 * List files in a folder
 * @param {string} folder - Folder path
 * @param {object} options - List options
 * @returns {Promise<object>} - List result
 */
const listFiles = async (folder, options = {}) => {
  try {
    const defaultOptions = {
      type: 'upload',
      prefix: folder,
      max_results: 100,
      ...options,
    };

    const result = await cloudinary.api.resources(defaultOptions);
    return {
      success: true,
      files: result.resources,
      nextCursor: result.next_cursor,
    };
  } catch (error) {
    logger.error('Cloudinary list error:', error);
    throw new Error('Failed to list files');
  }
};

/**
 * Create a folder in Cloudinary
 * @param {string} folderPath - Folder path to create
 * @returns {Promise<object>} - Creation result
 */
const createFolder = async (folderPath) => {
  try {
    const result = await cloudinary.api.create_folder(folderPath);
    return {
      success: true,
      path: result.path,
    };
  } catch (error) {
    logger.error('Cloudinary create folder error:', error);
    throw new Error('Failed to create folder');
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Cloudinary instance
  cloudinary,

  // Verify connection
  verifyCloudinaryConnection,

  // Folder constants
  FOLDERS,

  // Multer upload middlewares
  uploadAvatar,
  uploadDocument,
  uploadVehicleImage,
  uploadGeneral,

  // File filters
  imageFileFilter,
  documentFileFilter,

  // Helper functions
  uploadFile,
  uploadBase64,
  deleteFile,
  deleteMultipleFiles,
  getOptimizedUrl,
  getThumbnailUrl,
  extractPublicId,
  getSignedUrl,
  renameFile,
  getFileInfo,
  listFiles,
  createFolder,
};