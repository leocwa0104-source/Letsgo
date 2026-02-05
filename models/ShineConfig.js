const mongoose = require('mongoose');

const shineConfigSchema = new mongoose.Schema({
  // Client Tracking Parameters
  restingThresholdMs: { type: Number, default: 10000 }, // 10s
  stationaryRadius: { type: Number, default: 100 }, // 100m
  speedThreshold: { type: Number, default: 0.5 }, // 0.5 m/s
  flushInterval: { type: Number, default: 5000 }, // 5s

  // System Performance
  maxCellsReturned: { type: Number, default: 5000 }, // Max cells to return in one viewport query

  // Visual HSL & Ranges
  // Legacy fields (kept for backward compatibility or live pulse) - Deprecated by dynamic render
  colorPath: {
    hue: { type: Number, default: 217 }, 
    sat: { type: Number, default: 91 }
  },
  colorResting: {
    hue: { type: Number, default: 35 },
    sat: { type: Number, default: 96 }
  },
  
  // New Dynamic Rendering Parameters
  vitalityDecayRate: { type: Number, default: 0.9 }, // 0.0 - 1.0 per day
  lambdaRoadMax: { type: Number, default: 0.3 }, // < 0.3 is Road
  lambdaHomeMin: { type: Number, default: 0.7 }, // > 0.7 is Home
  
  hueRoad: { type: Number, default: 180 }, // Cyan
  hueHome: { type: Number, default: 250 },
  hueHub: { type: Number, default: 35 },   // Amber

  // Cycle Mode
  cycleStartDate: { type: Date, default: Date.now },

  lightnessRange: {
    min: { type: Number, default: 50 },
    max: { type: Number, default: 90 }
  },
  opacityRange: {
    min: { type: Number, default: 0.5 },
    max: { type: Number, default: 0.9 }
  },

  // Social Physics Parameters
  physics: {
    baseWeightPassing: { type: Number, default: 1.0 },
    baseWeightResting: { type: Number, default: 5.0 },
    crowdDamping: { type: Number, default: 0.1 },
    silenceBonus: { type: Number, default: 0.2 },
    dwellPowerExponent: { type: Number, default: 1.5 } // Power Law: E ~ t^1.5
  },

  // Market Economy Parameters (Energy Central Bank)
  economy: {
    dailyFreePings: { type: Number, default: 5 }, // Daily Free Quota
    costPing: { type: Number, default: 5 }, // Local Scan
    costPingRemote: { type: Number, default: 15 }, // Remote Scan (Higher Entropy)
    costVerify: { type: Number, default: 2 },
    costCreate: { type: Number, default: 50 },
        spatialRent: { type: Number, default: 10 }, // Cost per extra H3 cell (Progressive Tax "c")
    energyCap: { type: Number, default: 100 },
    recoveryRate: { type: Number, default: 5 },

    // Validation Weight (Neighbor Decay)
    validationWeightNeighbor: { type: Number, default: 0.5 }, // Weight for adjacent cells (0.0 - 1.0)

    // Frequency Penalty
    frequencyPenaltyWindow: { type: Number, default: 10000 }, // 10 seconds (ms)
    frequencyPenaltyMult: { type: Number, default: 2 }, // 2x multiplier

    // Monetary Policy (UBI)
    ubiDailyAmount: { type: Number, default: 5 }, // Daily base UBI
    ubiStakeThreshold: { type: Number, default: 50 }, // Min stake required
    inflationRate: { type: Number, default: 0.05 }, // 5% max inflation cap

    // Hardcore Market Parameters
    witherThreshold: { type: Number, default: 0.1 }, // Confidence < 0.1 -> Withered
    dividendRate: { type: Number, default: 0.1 }, // 10% of transaction fees to high-conf sparks
    
    // Reputation System Parameters
    reputationGain: { type: Number, default: 0.05 }, // Generic gain (legacy)
    reputationLoss: { type: Number, default: 0.05 }, // Generic loss (legacy)
    
    reputationLossPublisher: { type: Number, default: 0.5 }, // Penalty for publishing fake news
    reputationLossBeliever: { type: Number, default: 0.1 }, // Penalty for believing fake news
    reputationGainChallenger: { type: Number, default: 0.2 }, // Reward for exposing fake news


    // Truth Mining (Verifier Incentive)
    verifyRewardBase: { type: Number, default: 4 }, // Base reward for verification (Cost is usually 2)
    dividendRatio: { type: Number, default: 0.3 }, // % of Ping cost to dividend
    verifierRetention: { type: Number, default: 0.5 }, // % of dividend to Verifiers

    // Prediction Market (Skin in the Game)
    riskDeposit: { type: Number, default: 100 } // Mandatory deposit for creating Sparks
  },

  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String }
});

// We only need one config document, so we can enforce that logic in the controller
module.exports = mongoose.model('ShineConfig', shineConfigSchema);
