const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Interaction (The Wave Function)
 * Shineshone 5.0 Core Model
 * 
 * Fixes addressed:
 * 1. Wilson Interval Attacks -> Entropy-weighted voting
 * 2. Boundary Rider Attack -> Gaussian/Exponential Decay
 * 3. Race Conditions -> Atomic Inserts (Event Sourcing)
 */

const InteractionSchema = new Schema({
  sparkId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Spark', 
    required: true,
    index: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // --- 1. Physical Proofs ---
  // We store the USER's location at the moment of verification
  // This allows recalculating validity even if logic changes
  userLocation: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  
  // Distance from Spark Center (Calculated at insert)
  distance: { type: Number, required: true },

  // --- 2. Action ---
  action: { 
    type: String, 
    enum: ['CONFIRM', 'CHALLENGE'], 
    required: true 
  },
  
  // --- 3. Anti-Sybil Weights ---
  // VULNERABILITY FIX: Wilson Interval Math Attack
  // Weight is NOT just 1. It is a function of:
  // W = BaseCred * DistanceDecay * EntropyFactor
  weight: { 
    type: Number, 
    required: true,
    default: 0 
  },

  // --- 4. Bot Detection Signals ---
  // Metadata used by the Entropy Engine to detect farms
  meta: {
    deviceIdHash: String,    // Device Fingerprint
    ipSubnet: String,        // /24 IP Range
    bluetoothPeers: Number,  // Proof of Co-location count
    hostId: Schema.Types.ObjectId // For Affinity Check
  },

  // --- 5. Audit Trail ---
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true
  }
});

// VULNERABILITY FIX: Race Conditions & Spam
// Unique compound index prevents double-voting on the same Spark
// Users can change their mind (delete old, add new), but can't stack votes
InteractionSchema.index({ sparkId: 1, userId: 1 }, { unique: true });

// TTL for Interaction history (keep longer than Spark for audit, but not forever)
InteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 30 }); // 30 days

module.exports = mongoose.model('Interaction', InteractionSchema);
