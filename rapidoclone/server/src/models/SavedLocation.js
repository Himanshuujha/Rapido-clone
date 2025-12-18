const mongoose = require('mongoose');

const savedLocationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'other'
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  placeId: String,
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

savedLocationSchema.index({ coordinates: '2dsphere' });
savedLocationSchema.index({ user: 1 });

module.exports = mongoose.model('SavedLocation', savedLocationSchema);
