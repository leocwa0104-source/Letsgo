const mongoose = require('mongoose');

const ShineCellSchema = new mongoose.Schema({
  gridId: { type: String, required: true, unique: true, index: true }, // Format: "latKey_lngKey"
  center: {
    lat: Number,
    lng: Number
  },
  energy: { type: Number, default: 0 }, // Total energy accumulation
  lastPulse: { type: Date, default: Date.now },
  stats: {
    resting: { type: Number, default: 0 }, // Count of resting pulses
    passing: { type: Number, default: 0 }  // Count of passing pulses
  },
  // Floor distribution (simple map: floor level -> energy count)
  floors: {
    type: Map,
    of: Number,
    default: {} 
  }
});

// Index for geospatial queries (simple bounding box on center)
ShineCellSchema.index({ 'center.lat': 1, 'center.lng': 1 });

module.exports = mongoose.model('ShineCell', ShineCellSchema);
