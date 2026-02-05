const mongoose = require('mongoose');

const ShineCellSchema = new mongoose.Schema({
  // gridId will now store the H3 Index (e.g., "8928308280fffff")
  gridId: { type: String, required: true, unique: true, index: true }, 
  
  // H3 Center coordinates
  center: {
    lat: Number,
    lng: Number
  },

  // H3 Resolution (e.g., 9)
  resolution: { type: Number, default: 12 },

  energy: { type: Number, default: 0 }, // Total energy accumulation
  cycleEnergy: { type: Number, default: 0 }, // Current Cycle energy (Season)
  
  // Real-time Analytics (Hourly Buckets)
  realtime: {
    epoch: { type: Number, default: 0 }, // Hour Index
    current: { type: Number, default: 0 }, // Energy in current hour
    prev: { type: Number, default: 0 } // Energy in previous hour
  },

  // Flow Vector (Average Velocity)
  velocity: {
    dx: { type: Number, default: 0 }, // Accumulated vector X
    dy: { type: Number, default: 0 }, // Accumulated vector Y
    count: { type: Number, default: 0 } // Number of vectors contributed
  },

  lastPulse: { type: Date, default: Date.now },
  
  stats: {
    resting: { type: Number, default: 0 }, 
    passing: { type: Number, default: 0 } 
  },
  
  // === Cycle Specific Stats (Resettable) ===
  cycleStats: {
    resting: { type: Number, default: 0 },
    passing: { type: Number, default: 0 }
  },

  cycleVelocity: {
    dx: { type: Number, default: 0 },
    dy: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
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
