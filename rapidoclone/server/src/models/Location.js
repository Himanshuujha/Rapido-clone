// models/Location.js
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  // Unique identifier for the location
  placeId: {
    type: String,
    index: true
  },
  
  // Location name (e.g., "MG Road Metro Station")
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Full formatted address
  address: {
    type: String,
    required: true
  },
  
  // Short address for display
  shortAddress: {
    type: String
  },
  
  // GeoJSON Point for geospatial queries
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  
  // Alternative coordinate format for easy access
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  
  // Address components
  addressComponents: {
    streetNumber: String,
    streetName: String,
    locality: String,        // Area/Neighborhood
    city: String,
    district: String,
    state: String,
    country: {
      type: String,
      default: 'India'
    },
    postalCode: String
  },
  
  // Location type
  type: {
    type: String,
    enum: [
      'home',
      'work', 
      'airport',
      'railway_station',
      'bus_stand',
      'metro_station',
      'hospital',
      'mall',
      'hotel',
      'restaurant',
      'landmark',
      'other'
    ],
    default: 'other'
  },
  
  // Category for filtering
  category: {
    type: String,
    enum: [
      'residential',
      'commercial',
      'transport_hub',
      'healthcare',
      'education',
      'entertainment',
      'religious',
      'government',
      'other'
    ],
    default: 'other'
  },
  
  // Popular/Frequently searched location
  isPopular: {
    type: Boolean,
    default: false
  },
  
  // Search count for analytics
  searchCount: {
    type: Number,
    default: 0
  },
  
  // Location metadata
  metadata: {
    source: {
      type: String,
      enum: ['google', 'manual', 'user_added'],
      default: 'google'
    },
    verified: {
      type: Boolean,
      default: false
    },
    lastVerified: Date
  },
  
  // Operating hours (for business locations)
  operatingHours: {
    is24Hours: { type: Boolean, default: false },
    monday: { open: String, close: String, isClosed: Boolean },
    tuesday: { open: String, close: String, isClosed: Boolean },
    wednesday: { open: String, close: String, isClosed: Boolean },
    thursday: { open: String, close: String, isClosed: Boolean },
    friday: { open: String, close: String, isClosed: Boolean },
    saturday: { open: String, close: String, isClosed: Boolean },
    sunday: { open: String, close: String, isClosed: Boolean }
  },
  
  // Additional info
  additionalInfo: {
    phone: String,
    website: String,
    photos: [String],
    rating: Number,
    totalRatings: Number
  },
  
  // Zone/Area for surge pricing
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone'
  },
  
  // Active status
  isActive: {
    type: Boolean,
    default: true
  }
  
}, { timestamps: true });

// Geospatial index for location-based queries
locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ 'addressComponents.city': 1 });
locationSchema.index({ type: 1 });
locationSchema.index({ isPopular: 1 });
locationSchema.index({ name: 'text', address: 'text' });

// Static method to find nearby locations
locationSchema.statics.findNearby = function(longitude, latitude, maxDistance = 5000, limit = 10) {
  return this.find({
    isActive: true,
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  }).limit(limit);
};

// Static method to find popular locations in a city
locationSchema.statics.getPopularInCity = function(city, limit = 20) {
  return this.find({
    'addressComponents.city': city,
    isPopular: true,
    isActive: true
  })
  .sort({ searchCount: -1 })
  .limit(limit);
};

// Method to increment search count
locationSchema.methods.incrementSearchCount = function() {
  this.searchCount += 1;
  return this.save();
};

// Pre-save middleware to sync coordinates
locationSchema.pre('save', function(next) {
  if (this.latitude && this.longitude) {
    this.coordinates = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

module.exports = mongoose.model('Location', locationSchema);