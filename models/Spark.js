const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Spark (The Truth Particle)
 * Shineshone 5.0 Core Model
 * 
 * Fixes addressed:
 * 1. Event Sourcing Consistency -> Immutable Location
 * 2. Aggregation Performance -> Snapshot Pattern
 * 3. Spatial Rent DDoS -> spatialRent field + pre-save density check
 * 4. Storage Explosion -> TTL Index
 */

const SparkSchema = new Schema({
  // --- 1. Immutable Physics Layer ---
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      immutable: true // VULNERABILITY FIX: Prevent "Moving Target" attack
    }
  },

  // --- 2. Dynamic Field Layer ---
  // Effective radius grows with confidence, but has a hard cap
  radius: { 
    type: Number, 
    default: 50, 
    min: 20, 
    max: 200 
  },

  // --- 3. Content & Economy ---
  type: { 
    type: String, 
    enum: ['HARD_FACT', 'SOFT_VIBE'], 
    required: true 
  },
  content: { 
    type: String, 
    required: true, 
    maxlength: 280 
  },
  hostId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // VULNERABILITY FIX: Spatial Rent
  // Calculated at creation based on local density. 
  // This is the "Proof of Burn" required to occupy this space.
  spatialRent: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  
  // Staked energy (Refundable only if Confidence > threshold)
  stakedEnergy: { 
    type: Number, 
    required: true, 
    min: 0 
  },

  // VULNERABILITY FIX: Skin in the Game
  // The creator's deposit that can be slashed if the spark withers.
  // Distinct from spatialRent (which is burned) and stakedEnergy (total cost).
  deposit: {
    type: Number,
    required: true,
    default: 0
  },

  // --- 4. Snapshot Layer (Read Optimization) ---
  // VULNERABILITY FIX: O(n) Aggregation Disaster
  // These fields are updated asynchronously by the Interaction Engine
  snapshot: {
    // Wilson Score Lower Bound (The only metric that matters)
    confidence: { type: Number, default: 0, index: true }, 
    
    // Raw counters (Weighted)
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },

    // Legacy counters (Optional, for backward compat if needed)
    confirmCount: { type: Number, default: 0 },
    challengeCount: { type: Number, default: 0 },
    
    // Entropy of the verifier set (0-1)
    // Used to detect Bot Farms
    verifierEntropy: { type: Number, default: 0 },
    
    lastUpdatedAt: { type: Date, default: Date.now }
  },

  // --- 5. Lifecycle & Security ---
  // VULNERABILITY FIX: Immutable Anchor Reverse Game
  // Add expiration and versioning to prevent "Zombie Anchors" and "Anchor Pollution"
  expiresAt: { 
    type: Date, 
    required: true,
    index: true 
  },
  renewable: { 
    type: Boolean, 
    default: true 
  },
  version: { 
    type: Number, 
    default: 1 
  },
  modifications: [{
    content: String,
    timestamp: { type: Date, default: Date.now },
    verifiedBy: [Schema.Types.ObjectId]
  }],
  
  // VULNERABILITY FIX: Performance
  // Geohash for prefix search optimization
  geohash: { type: String, index: true }, // For quick prefix search
  marketH3Indices: { type: [String], index: true }, // Market-specific H3 indices (Res 12) for tiered verification logic
  verifierRewardPool: { type: Number, default: 0 }, // Unclaimed dividends for verifiers
  h3Index: { type: String, index: true }, // Legacy frontend H3 index

  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'BANNED', 'SHADOW_BANNED', 'WITHERED'],
    default: 'ACTIVE'
  },
  
  createdAt: { type: Date, default: Date.now, immutable: true },
  
  // VULNERABILITY FIX: Storage Explosion
  // Hard expiration for auto-cleanup
  validUntil: { type: Date, required: true, index: { expires: 0 } }
});

// Geospatial Index for Radar Query
SparkSchema.index({ location: '2dsphere' });

// Compound Index for Host throttling
SparkSchema.index({ hostId: 1, status: 1 });

module.exports = mongoose.model('Spark', SparkSchema);
