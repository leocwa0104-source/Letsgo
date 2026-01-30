const mongoose = require('mongoose');

const shineConfigSchema = new mongoose.Schema({
  // Genesis Parameters
  ignitionThreshold: { type: Number, default: 1 }, // 1 person to light up initially
  pioneerMultiplier: { type: Number, default: 5.0 }, // Early users weight

  // Evolution Parameters
  decayRate: { type: Number, default: 0.05 }, // 5% decay per day
  maxBrightness: { type: Number, default: 1000 }, // Clamp value

  // Dimensional Parameters
  altitudeSensitivity: { type: Number, default: 3.0 }, // 3.0 meters per floor

  // Visual Parameters
  fogDensity: { type: Number, default: 0.5 }, // 0 to 1 range usually

  // Client Tracking Parameters (New)
  restingThresholdMs: { type: Number, default: 10000 }, // 10s (Demo Mode default)
  stationaryRadius: { type: Number, default: 100 }, // 100m (Demo Mode default)
  speedThreshold: { type: Number, default: 0.5 }, // 0.5 m/s
  flushInterval: { type: Number, default: 60000 }, // 60s

  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String }
});

// We only need one config document, so we can enforce that logic in the controller
module.exports = mongoose.model('ShineConfig', shineConfigSchema);
