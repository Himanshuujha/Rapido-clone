const mongoose = require('mongoose');

const CaptainLocationHistorySchema = new mongoose.Schema(
  {
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    heading: {
      type: Number, // degrees
      min: 0,
      max: 360,
    },

    speed: {
      type: Number, // km/h
      min: 0,
    },

    accuracy: {
      type: Number, // meters
      min: 0,
    },

    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// 🔥 Indexes for fast queries
CaptainLocationHistorySchema.index({ location: '2dsphere' });
CaptainLocationHistorySchema.index({ captain: 1, createdAt: -1 });
CaptainLocationHistorySchema.index({ ride: 1, createdAt: -1 });

module.exports = mongoose.model(
  'CaptainLocationHistory',
  CaptainLocationHistorySchema
);
