const mongoose = require('mongoose');

const ShineCellPersonalSchema = new mongoose.Schema({
  // Owner of this personal cell
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // gridId will now store the H3 Index (e.g., "8928308280fffff")
  gridId: { type: String, required: true, index: true }, 
  
  // H3 Center coordinates
  center: {
    lat: Number,
    lng: Number
  },

  // H3 Resolution (e.g., 12)
  resolution: { type: Number, default: 12 },

  energy: { type: Number, default: 0 }, // Total energy accumulation
  
  // Personal analytics might need less complex aggregation than global, 
  // but let's keep it consistent for visual compatibility.
  
  // Real-time Analytics (Hourly Buckets)
  realtime: {
    epoch: { type: Number, default: 0 }, 
    current: { type: Number, default: 0 }, 
    prev: { type: Number, default: 0 } 
  },

  // Flow Vector
  velocity: {
    dx: { type: Number, default: 0 }, 
    dy: { type: Number, default: 0 }, 
    count: { type: Number, default: 0 } 
  },

  lastPulse: { type: Date, default: Date.now },
  
  stats: {
    resting: { type: Number, default: 0 }, 
    passing: { type: Number, default: 0 } 
  },
  
  // Status for Archiving
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  archiveId: { type: String, default: null }, // Timestamp or UUID of the archive batch

  // Floor distribution
  floors: {
    type: Map,
    of: Number,
    default: {} 
  }
});

// Compound index for unique cells per user (active only)
// We allow multiple documents for same gridId if they are in different archives, 
// but for 'active' status, it should be unique per user.
ShineCellPersonalSchema.index({ owner: 1, gridId: 1, status: 1 });
ShineCellPersonalSchema.index({ 'center.lat': 1, 'center.lng': 1 });

module.exports = mongoose.model('ShineCellPersonal', ShineCellPersonalSchema);
