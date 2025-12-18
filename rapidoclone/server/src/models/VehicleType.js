const mongoose = require('mongoose');

const vehicleTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['bike', 'auto', 'car', 'premium']
  },
  displayName: { type: String, required: true },
  description: String,
  icon: { type: String, default: 'default-vehicle.png' },
  image: String,
  capacity: { type: Number, required: true, min: 1, max: 6 },
  baseFare: { type: Number, required: true, min: 0 },
  perKmRate: { type: Number, required: true, min: 0 },
  perMinuteRate: { type: Number, required: true, min: 0 },
  minimumFare: { type: Number, required: true, min: 0 },
  bookingFee: { type: Number, default: 0 },
  surgeMultiplier: { type: Number, default: 1, min: 1, max: 5 },
  waitingChargePerMinute: { type: Number, default: 0 },
  cancellationFee: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  availableIn: [String],
  features: [String],
  order: { type: Number, default: 0 }
}, { timestamps: true });

vehicleTypeSchema.index({ name: 1 });
vehicleTypeSchema.index({ isActive: 1 });

module.exports = mongoose.model('VehicleType', vehicleTypeSchema);
