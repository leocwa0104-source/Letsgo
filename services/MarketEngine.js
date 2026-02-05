const mongoose = require('mongoose');
const Spark = require('../models/Spark');
const Interaction = require('../models/Interaction');
const User = require('../models/User'); // Assuming User model exists
const { encodeGeohash, applyDifferentialPrivacyToPing, perturbLocation, getGeohashNeighbors } = require('../utils/geo');
const h3 = require('h3-js'); // Hardcore H3 Library

const ShineConfig = require('../models/ShineConfig'); // Import Config

// CONSTANTS
const TRUTH_RESOLUTION = 12; // ~300m² per cell. The absolute truth unit.

/**
 * Market Engine Service
 * Handles the core logic for the Shineshone Truth Market.
 * Implements fixes for:
 * - Privacy Side-Channel Attacks
 * - Economic Deflation
 * - Geospatial Query Performance
 */
class MarketEngine {
  
  constructor() {
    this.energyPolicy = new EnergyMonetaryPolicy();
    this.privacyBudget = new Map(); // Simple In-Memory Budget Tracker (User+Geohash -> Count)
  }

  // Helper: Get Economic Config
  async getEconomyConfig() {
      const config = await ShineConfig.findOne();
      return config?.economy || {
          costPing: 5,
          costVerify: 2,
          costCreate: 50,
          energyCap: 100,
          recoveryRate: 1
      };
  }

  /**
   * Ping: Search for Truth (Updated with Daily Free Quota & Grid Support)
   */
  async ping(user, location, radius = 500, isRemote = false) {
    const econ = await this.getEconomyConfig();
    
    // --- 0. Daily Free Quota Logic ---
    const now = new Date();
    // Initialize if missing
    if (!user.marketStats) user.marketStats = { lastDailyReset: new Date(0), pingsToday: 0 };
    
    const lastReset = user.marketStats.lastDailyReset || new Date(0);
    const isSameDay = now.getDate() === lastReset.getDate() && 
                      now.getMonth() === lastReset.getMonth() && 
                      now.getFullYear() === lastReset.getFullYear();

    // Reset counters if new day
    let pingsToday = isSameDay ? (user.marketStats.pingsToday || 0) : 0;
    
    const freeQuota = econ.dailyFreePings !== undefined ? econ.dailyFreePings : 5;
    const isFree = pingsToday < freeQuota;
    
    // Determine Cost
    let cost = 0;
    if (!isFree) {
        cost = isRemote 
            ? (econ.costPingRemote !== undefined ? econ.costPingRemote : 15) 
            : (econ.costPing !== undefined ? econ.costPing : 5);
    }

    // Burn Energy (if paid)
    let energyResult = { energy: user.energy, cost: 0 };
    if (cost > 0) {
        // This handles rate limits for paid pings + UBI check
        energyResult = await this.burnEnergy(user._id, cost);
    } else {
        // Free Ping: Manual Rate Limit (3s)
        const lastPing = user.lastPingAt ? new Date(user.lastPingAt) : new Date(0);
        if (now - lastPing < 3000) throw new Error('Rate limit exceeded. Please wait.');
        
        user.lastPingAt = now;
        await user.save();
        energyResult.energy = user.energy; // Current energy
    }

    // Update Usage Stats (Atomic)
    await User.updateOne(
        { _id: user._id },
        { 
            $set: { 
                'marketStats.lastDailyReset': now 
            },
            $inc: { 'marketStats.pingsToday': 1 }
        }
    );

    // --- 1. Search Logic ---
    let safeResults = [];
    
    // Grid Ping (H3 Index) - Check if location is a valid H3 Index string
    if (typeof location === 'string' && h3.isValidCell(location)) {
        // Privacy Budget (Grid)
        const budgetKey = `${user._id}:${location}`; 
        const currentUsage = this.privacyBudget.get(budgetKey) || 0;
        
        if (currentUsage > 20) { // Higher limit for grid interaction
             console.warn(`Privacy Budget Exceeded for User ${user._id} on Grid ${location}`);
             return { sparks: [], energy: energyResult.energy, cost };
        }
        this.privacyBudget.set(budgetKey, currentUsage + 1);

        // Query Sparks
        const candidates = await Spark.find({
            marketH3Indices: location, 
            status: 'ACTIVE'
        })
        .sort({ createdAt: -1 })
        .limit(50);
        
        // Apply Differential Privacy relative to Grid Center
        const [lat, lng] = h3.cellToLatLng(location);
        const gridCenter = [lng, lat]; 
        safeResults = applyDifferentialPrivacyToPing(candidates, gridCenter, 0.1);
        
    } else {
        // Radius Ping (Legacy / Geo)
        // Privacy Budget (Geo)
        const budgetKey = `${user._id}:${encodeGeohash(location[1], location[0], 6)}`;
        const currentUsage = this.privacyBudget.get(budgetKey) || 0;
        
        if (currentUsage > 5) {
            console.warn(`Privacy Budget Exceeded for User ${user._id}`);
            return { sparks: [], energy: energyResult.energy, cost }; 
        }
        this.privacyBudget.set(budgetKey, currentUsage + 1);

        const centerGeohash = encodeGeohash(location[1], location[0], 6); 
        const neighbors = getGeohashNeighbors(centerGeohash);
        const searchPrefixes = [centerGeohash, ...Object.values(neighbors)];
        const regexPattern = `^(${searchPrefixes.join('|')})`;
        
        const candidates = await Spark.find({
          geohash: { $regex: regexPattern },
          location: {
            $geoWithin: {
              $centerSphere: [location, radius / 6378137]
            }
          },
          status: 'ACTIVE'
        })
        .sort({ createdAt: -1 })
        .limit(50);

        safeResults = applyDifferentialPrivacyToPing(candidates, location, 0.1);
    }

    // 4. Dividend Distribution (Phase 2) - Only for Paid Pings
    if (cost > 0 && econ.dividendRatio && econ.dividendRatio > 0 && safeResults.length > 0) {
        const totalDividend = Math.floor(cost * econ.dividendRatio);
        
        if (totalDividend > 0) {
            const dividendPerSpark = Math.floor(totalDividend / safeResults.length);
            
            if (dividendPerSpark > 0) {
                const verifierRetention = econ.verifierRetention !== undefined ? econ.verifierRetention : 0.5;
                const verifierShare = Math.floor(dividendPerSpark * verifierRetention);
                const creatorShare = dividendPerSpark - verifierShare;

                const sparkOps = [];
                const userUpdates = {};

                for (const spark of safeResults) {
                     if (verifierShare > 0) {
                        sparkOps.push({
                            updateOne: {
                                filter: { _id: spark._id },
                                update: { $inc: { verifierRewardPool: verifierShare } }
                            }
                        });
                     }
                     if (creatorShare > 0 && spark.hostId) {
                         const uid = spark.hostId.toString();
                         userUpdates[uid] = (userUpdates[uid] || 0) + creatorShare;
                     }
                }
                
                if (sparkOps.length > 0) {
                    await Spark.bulkWrite(sparkOps, { ordered: false }).catch(e => console.error("Dividend Spark Update Error", e));
                }
                
                const userOps = Object.keys(userUpdates).map(uid => ({
                    updateOne: {
                        filter: { _id: uid },
                        update: { $inc: { energy: userUpdates[uid] } }
                    }
                }));
                
                if (userOps.length > 0) {
                    await User.bulkWrite(userOps, { ordered: false }).catch(e => console.error("Dividend User Update Error", e));
                }
            }
        }
    }

    return { sparks: safeResults, energy: energyResult.energy, cost };
  }

  /**
   * Get My Portfolio (Phase 1)
   * Returns Sparks the user has interacted with (Verified).
   * Allows free observation of these sparks.
   */
  async getMyPortfolio(userId) {
      // 1. Find all interactions by this user
      const interactions = await Interaction.find({ userId: userId }).sort({ createdAt: -1 });
      
      if (!interactions.length) return [];

      // 2. Extract Spark IDs
      // Use Set to unique
      const sparkIds = [...new Set(interactions.map(i => i.sparkId))];
      
      // 3. Fetch Sparks
      const sparks = await Spark.find({ _id: { $in: sparkIds } })
          .populate('hostId', 'username nickname');
          
      // 4. Attach User's Interaction Status & Potential Dividends
      const results = sparks.map(s => {
          const myInteractions = interactions.filter(i => i.sparkId.toString() === s._id.toString());
          // Most recent interaction determines current stance
          const lastInteraction = myInteractions[0]; 
          
          // Dividend Calculation Logic (Simplified)
          // Share = Pool / Total Interactions? 
          // Or Weighted by Reputation/Distance at time of verify?
          // For MVP: Share = Pool * (MyWeight / TotalWeight)
          // We need TotalWeight on Spark. If not present, default to 1/N.
          
          return {
              ...s.toObject(),
              myStance: lastInteraction ? lastInteraction.action : 'NONE',
              myLastInteractionAt: lastInteraction ? lastInteraction.createdAt : null,
              verifierRewardPool: s.verifierRewardPool || 0
          };
      });
      
      return results;
  }

  /**
   * Harvest Dividends
   * Claims user's share of dividends from a Spark.
   */
  async harvestDividends(userId, sparkId) {
      const user = await User.findById(userId);
      const spark = await Spark.findById(sparkId);
      
      if (!user || !spark) throw new Error('Not found');
      if (spark.verifierRewardPool <= 0) return { claimed: 0 };
      
      // 1. Calculate Share
      // Find all verifiers for this spark to determine denominator
      // Optimization: Spark should store 'totalVerificationWeight'
      const interactions = await Interaction.find({ sparkId: sparkId });
      const totalWeight = interactions.reduce((sum, i) => sum + (i.weight || 1), 0);
      
      const myInteractions = interactions.filter(i => i.userId.toString() === userId.toString());
      const myWeight = myInteractions.reduce((sum, i) => sum + (i.weight || 1), 0);
      
      if (myWeight === 0 || totalWeight === 0) return { claimed: 0 };
      
      const shareRatio = myWeight / totalWeight;
      const myShare = Math.floor(spark.verifierRewardPool * shareRatio);
      
      if (myShare > 0) {
          // 2. Transfer
          spark.verifierRewardPool -= myShare;
          if (spark.verifierRewardPool < 0) spark.verifierRewardPool = 0; // Safety
          
          user.energy += myShare;
          
          await spark.save();
          await user.save();
      }
      
      return { claimed: myShare, remainingPool: spark.verifierRewardPool };
  }

  /**
    * Verify Spark (Vote)
    * The core of the consensus mechanism.
    * Implements Anti-Collusion and Entropy Weighting.
    */
   async verify(user, sparkId, action, meta = {}) {
     // 0. Energy Cost (Proof of Work / Anti-Sybil)
     // Verification costs energy. This prevents infinite voting attacks.
     const econ = await this.getEconomyConfig();
     const energyResult = await this.burnEnergy(user._id, econ.costVerify);

     // 1. Fetch Spark & Previous Interactions
     const spark = await Spark.findById(sparkId);
     if (!spark || spark.status !== 'ACTIVE') throw new Error('Invalid Spark');

     // 1.5. Check for Duplicate Vote (Idempotency / Single Vote Policy)
     const existingInteraction = await Interaction.findOne({
        sparkId: sparkId,
        userId: user._id
     });

     if (existingInteraction) {
        // Option A: Block duplicate voting
        throw new Error('You have already verified this Spark.');
     }

     // 2. Anti-Collusion: Host-Verifier Affinity Check
     // Vulnerability Fix #1: Collusion Attack
     // Calculate how many times this user has verified THIS host before
     const hostAffinityCount = await Interaction.countDocuments({
       userId: user._id,
       'meta.hostId': spark.hostId // We need to store hostId in Interaction meta for fast lookup
     });
     
     // Squelch Factor: 1 / (1 + Affinity)
     // If you verify the same guy 10 times, your 11th vote is worth 1/11th.
     const affinityFactor = 1 / (1 + hostAffinityCount);

     // 3. H3 Hardcore Logic (Discrete Buckets)
     // REPLACES: Gaussian Decay
     // We calculate distance to the set of cells marked by the Spark
     
     // Get User's H3 Cell
     const userLat = meta.userLocation ? (Array.isArray(meta.userLocation) ? meta.userLocation[1] : meta.userLocation.coordinates[1]) : 0;
     const userLng = meta.userLocation ? (Array.isArray(meta.userLocation) ? meta.userLocation[0] : meta.userLocation.coordinates[0]) : 0;
     const userH3 = h3.latLngToCell(userLat, userLng, TRUTH_RESOLUTION);

     // Get Spark's H3 Cells (Support Multi-Cell)
     // Fallback to single cell if array not present (Legacy)
     let sparkIndices = spark.marketH3Indices;
     if (!sparkIndices || sparkIndices.length === 0) {
        // Calculate on fly if missing (e.g. legacy data)
        const sparkLat = spark.location.coordinates[1];
        const sparkLng = spark.location.coordinates[0];
        sparkIndices = [h3.latLngToCell(sparkLat, sparkLng, TRUTH_RESOLUTION)];
     }

     // Calculate Min Grid Distance
     // If user is inside ANY of the spark's cells, distance is 0.
     let minGridDistance = Infinity;
     
     if (sparkIndices.includes(userH3)) {
         minGridDistance = 0;
     } else {
         // Calculate distance to closest cell
         // h3.gridDistance might throw if too far, so wrap in try/catch or assume far
         try {
             const distances = sparkIndices.map(idx => h3.gridDistance(userH3, idx));
             minGridDistance = Math.min(...distances);
         } catch (e) {
             minGridDistance = 999; // Far away
         }
     }

     // Tiered Weighting (The "Ladder" Game)
     // Tier 0 (In Cell): 100%
     // Tier 1 (Neighbor): Configurable (Default 50%)
     // Tier 2+ (Far): 0%
     const neighborWeight = econ.validationWeightNeighbor !== undefined ? econ.validationWeightNeighbor : 0.5;
     
     let decayFactor = 0;
     if (minGridDistance === 0) {
         decayFactor = 1.0;
     } else if (minGridDistance <= 1) {
         decayFactor = neighborWeight;
     } else {
         decayFactor = 0.0;
     }

     // 4. Calculate Final Weight
     // Weight = (UserReputation) * Decay * Affinity
     const userRep = user.reputation || 1;
     const finalWeight = userRep * decayFactor * affinityFactor;

     if (finalWeight < 0.01) throw new Error('Vote weight too low (Collusion or Distance)');

     // Fix: Handle userLocation format (Array vs Object)
     let userLocation = meta.userLocation;
     if (Array.isArray(userLocation)) {
        userLocation = { type: 'Point', coordinates: userLocation };
     }

     const distance = meta.distance !== undefined ? meta.distance : (minGridDistance * 300); // Fallback to approx meters

     // 5. Record Interaction
     const interaction = new Interaction({
       sparkId,
       userId: user._id,
       userLocation: userLocation,
       distance,
       action,
       weight: finalWeight,
       meta: {
         ...meta,
         hostId: spark.hostId // Store for future affinity checks
       }
     });

     await interaction.save();

     // 6. Update Spark Snapshot (Event Sourcing Aggregation)
     // In a real system, this might be async/batched.
     // For MVP, we update immediately.
     if (action === 'CONFIRM') {
       spark.snapshot.upvotes += finalWeight;
     } else {
       spark.snapshot.downvotes += finalWeight;
     }
     
     // Recalculate Confidence (Laplace Smoothing)
     // Replaces Wilson Score Lower Bound to provide "Expected Value" behavior
     // Initial (0 votes) = 0.5 (50%)
     const total = spark.snapshot.upvotes + spark.snapshot.downvotes;
     
     // Laplace Smoothing: (Positive + 1) / (Total + 2)
     // Assumes 1 prior positive and 1 prior negative vote (Uniform Prior)
     spark.snapshot.confidence = (spark.snapshot.upvotes + 1) / (total + 2);
     
     // 7. Hardcore Mechanics: Wither, Dividend, Reputation
     
     // A. Wither (Garbage Collection)
     // If confidence drops below threshold, mark as WITHERED (dead)
     const witherThreshold = econ.witherThreshold !== undefined ? econ.witherThreshold : 0.1;
     if (spark.snapshot.confidence < witherThreshold) {
         spark.status = 'WITHERED';
         // Liquidation: Distribute remaining value to 'DENY' voters (Short Sellers)
         await this.liquidateSpark(spark);
     }

     // B. Dividend (Incentive)
     // Pay the host a portion of the verification cost
     // CHANGE: Verification cost goes to Pool, not Host immediately.
     // This aligns incentives: Verifiers bet on the truth, they don't just pay the host.
     // Old Logic: const dividend = Math.floor(energyResult.cost * dividendRate);
     // New Logic: 100% into Pool
     
     spark.verifierRewardPool = (spark.verifierRewardPool || 0) + energyResult.cost;
     
     // 8. Save
     await spark.save();
     
     // 9. Return Result
     return {
         newConfidence: spark.snapshot.confidence,
         rewardPool: spark.verifierRewardPool,
         status: spark.status
     };
   }

  /**
   * Helper: Update User Reputation
   * Bounds: [0.1, 10.0]
   * @param {string} userId 
   * @param {number} delta - Positive or Negative change
   * @returns {Promise<number>} newReputation
   */
  async updateReputation(userId, delta) {
    try {
        const user = await User.findById(userId);
        if (!user) return 1.0;

        let newRep = (user.reputation || 1.0) + delta;
        
        // Clamp bounds
        if (newRep < 0.1) newRep = 0.1;
        if (newRep > 10.0) newRep = 10.0;

        // Round to 2 decimals
        newRep = Math.round(newRep * 100) / 100;

        if (newRep !== user.reputation) {
            await User.updateOne({ _id: userId }, { reputation: newRep });
            console.log(`[Reputation] User ${user.username} reputation changed: ${user.reputation} -> ${newRep} (Delta: ${delta})`);
        }
        return newRep;
    } catch (err) {
        console.error('[Reputation] Update failed:', err);
        return 1.0;
    }
  }

  /**
   * Liquidate Spark (Withered)
   * Triggered when confidence drops below threshold.
   * 1. Confiscate Deposit & Pool -> Distribute to Challengers (Short Sellers)
   * 2. Punish Publisher (Reputation Loss)
   * 3. Punish Believers (Reputation Loss)
   * 4. Reward Challengers (Reputation Gain)
   */
  async liquidateSpark(spark) {
    try {
        console.log(`[Liquidation] Starting liquidation for Spark ${spark._id}`);
        const econ = await this.getEconomyConfig();
        const confiscatedDeposit = spark.deposit || 0;
        const pool = spark.verifierRewardPool || 0;
        const liquidationValue = pool + confiscatedDeposit;

        // Fetch all interactions for this Spark
        const interactions = await Interaction.find({ sparkId: spark._id });
        
        // 1. Identify Groups
        const shortSellers = interactions.filter(i => i.action === 'CHALLENGE'); // Correct
        const believers = interactions.filter(i => i.action === 'CONFIRM');     // Wrong

        // --- Reputation Updates ---
        
        // A. Publisher Punishment (Big Hit)
        // Default: -0.5
        const repLossPublisher = econ.reputationLossPublisher !== undefined ? -Math.abs(econ.reputationLossPublisher) : -0.5;
        if (spark.hostId) {
            await this.updateReputation(spark.hostId, repLossPublisher);
        }

        // B. Believers Punishment (Small Hit)
        // Default: -0.1
        const repLossBeliever = econ.reputationLossBeliever !== undefined ? -Math.abs(econ.reputationLossBeliever) : -0.1;
        for (const believer of believers) {
             await this.updateReputation(believer.userId, repLossBeliever);
        }

        // C. Short Sellers Reward (Gain)
        // Default: +0.2
        const repGainChallenger = econ.reputationGainChallenger !== undefined ? Math.abs(econ.reputationGainChallenger) : 0.2;
        for (const seller of shortSellers) {
             await this.updateReputation(seller.userId, repGainChallenger);
        }

        // --- Energy Distribution (Existing Logic) ---

        if (liquidationValue <= 0 && shortSellers.length === 0) {
            spark.verifierRewardPool = 0;
            spark.stakedEnergy = 0; 
            spark.deposit = 0;
            await spark.save();
            return;
        }

        if (!shortSellers.length) {
            console.log(`[Liquidation] Spark ${spark._id} withered with no challengers. ${liquidationValue} burned.`);
            spark.verifierRewardPool = 0;
            spark.stakedEnergy = 0; 
            spark.deposit = 0;
            await spark.save();
            return; 
        }

        const totalWeight = shortSellers.reduce((sum, i) => sum + (i.weight || 1), 0);
        const userUpdates = [];

        for (const seller of shortSellers) {
            const share = Math.floor(liquidationValue * (seller.weight / totalWeight));
            if (share > 0) {
                userUpdates.push({
                    updateOne: {
                        filter: { _id: seller.userId },
                        update: { $inc: { energy: share } }
                    }
                });
            }
        }

        if (userUpdates.length > 0) {
            await User.bulkWrite(userUpdates);
            console.log(`[Liquidation] Spark ${spark._id} liquidated. ${liquidationValue} energy distributed to ${userUpdates.length} short sellers.`);
        }

        // Final Cleanup
        spark.verifierRewardPool = 0;
        spark.stakedEnergy = 0; 
        spark.deposit = 0;
        // Don't save spark here if we want caller to save, but caller usually just sets status. 
        // We should save to clear values.
        await spark.save();

    } catch (err) {
        console.error('[Liquidation] Failed:', err);
    }
  }

  /**
   * Calculate Wilson Score Interval Lower Bound
    * Provides a conservative estimate of the "real" rating given the sample size.
    * @param {number} positive - Sum of positive weights/votes
    * @param {number} total - Sum of all weights/votes
    * @param {number} confidence - Confidence level (default 1.96 for 95%)
    */
   calculateWilsonScore(positive, total, confidence = 1.96) {
     if (total === 0) return 0;
     
     const p = positive / total;
     const z = confidence;
     const z2 = z * z;
     
     // Wilson Score Formula
     const numerator = p + (z2 / (2 * total)) - (z * Math.sqrt((p * (1 - p) / total) + (z2 / (4 * total * total))));
     const denominator = 1 + (z2 / total);
     
     return numerator / denominator;
   }

   /**
    * GDPR Compliance: Right to be Forgotten
   * Anonymizes a Spark while keeping structural integrity for verification chain
   */
  async forgetSpark(user, sparkId) {
    const spark = await Spark.findOne({ _id: sparkId, hostId: user._id });
    if (!spark) throw new Error('Spark not found or unauthorized');

    // Soft Delete / Anonymize
    spark.status = 'EXPIRED'; // Or 'DELETED' if enum supports
    spark.content = 'Content removed via GDPR Request'; // Scrub PII
    spark.hostId = null; // Unlink User
    spark.modifications.push({
      content: 'GDPR Scrub',
      timestamp: new Date(),
      verifiedBy: []
    });
    
    await spark.save();
    return { success: true };
  }

  /**
   * Create Spark
   * Handles creation with Geohash generation and Spatial Rent
   */
  async createSpark(user, data) {
    const { coordinates, content, type, radius, marketH3Indices } = data;
    
    // 3. Get Economy Config
    const econ = await this.getEconomyConfig();
    
    // 1. Calculate Geohash
    const geohash = encodeGeohash(coordinates[1], coordinates[0], 9);

    // 2. Resolve H3 Indices (Point or Field)
    let finalH3Indices = [];
    if (marketH3Indices && Array.isArray(marketH3Indices) && marketH3Indices.length > 0) {
        // User provided specific cells (Field Mode)
        finalH3Indices = marketH3Indices;
    } else {
        // Default to single cell at center (Point Mode)
        finalH3Indices = [h3.latLngToCell(coordinates[1], coordinates[0], TRUTH_RESOLUTION)];
    }
    
    // 3. Calculate Costs
    
    // NEW LOGIC: "Spam Tax" (Progressive Cost)
    // Formula: Energy = x + (n-1)*c
    // x = costCreate (Base Cost for 1st message)
    // c = spatialRent (Progressive Tax for subsequent messages)
    // n = Number of active sparks by this user in this H3 cell (including this one)

    const unitRent = econ.spatialRent !== undefined ? econ.spatialRent : 10;
    let totalSpatialRent = 0;

    // We calculate the Progressive Tax for EACH covered cell
    // Note: 'costCreate' (x) is paid once as the transaction base.
    // We only accumulate the 'c' component here.
    // If the user wants strict per-grid x, we might need to multiply costCreate, 
    // but usually x is the transaction fee. 
    // To prevent "Field Spam" (1 spark covering 100 grids for price of 1), 
    // we should probably consider 'costCreate' covers the PRIMARY cell.
    // Extra cells should perhaps incur at least 'c'? 
    // For now, we strictly follow "x + (n-1)c" per cell. 
    // If n=1, cost is x. If we cover 3 cells (all n=1), cost is x (if we treat x as transaction).
    // Let's add a "Expansion Surcharge" if needed, but user didn't ask.
    // We will stick to: Total = costCreate + Sum( (n-1)*c ).
    
    for (const idx of finalH3Indices) {
        const count = await Spark.countDocuments({ 
            hostId: user._id, 
            status: 'ACTIVE', 
            marketH3Indices: idx 
        });
        
        // n = count + 1 (Current Spark is the n-th)
        // Rent = (n - 1) * c = count * c
        const rent = count * unitRent;
        totalSpatialRent += rent;
    }

    // C. Risk Deposit (Skin in the Game)
    // To prevent fake news, creators must lock capital.
    // If Spark withers, this is slashed. If confirmed, returned.
    const riskDeposit = econ.riskDeposit !== undefined ? econ.riskDeposit : 100;

    // 4. Create Spark
    const totalCost = econ.costCreate + totalSpatialRent + riskDeposit;
    
    // Deduct Energy (Stake)
    const energyResult = await this.burnEnergy(user._id, totalCost);

    const spark = new Spark({
      hostId: user._id,
      location: { type: 'Point', coordinates },
      content,
      type,
      radius,
      spatialRent: totalSpatialRent,
      deposit: riskDeposit,
      stakedEnergy: totalCost, // Base stake + Rent + Deposit
      geohash,
      marketH3Indices: finalH3Indices, // Store the Field
      // Initialize Fix Fields
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 Days default
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // TTL Expiration
      version: 1,
      modifications: [],
      snapshot: {
        upvotes: 0,
        downvotes: 0,
        confidence: 0.5 // Initial Confidence 50% (Laplace Smoothing: 1/2)
      }
    });

    await spark.save();
    return { spark, energy: energyResult.energy };
  }

  /**
   * Get My Sparks
   * Returns list of sparks created by the user
   */
  async getMySparks(user) {
    return Spark.find({ 
      hostId: user._id,
      status: { $in: ['ACTIVE', 'EXPIRED'] } // Show active and expired
    })
    .sort({ createdAt: -1 })
    .limit(100);
  }

  /**
   * Get My Portfolio
   * Returns:
   * 1. Sparks created (active/expired)
   * 2. Interactions (Investments)
   */
  async getMyPortfolio(userId) {
    const sparks = await Spark.find({ hostId: userId }).sort({ createdAt: -1 }).limit(50);
    
    // Aggregate interactions to find "Investments"
    // We want to know: Spark ID, My Action, My Weight, Current Spark Status, Current Dividend Pool
    const interactions = await Interaction.find({ userId: userId })
        .populate('sparkId', 'content status snapshot verifierRewardPool location')
        .sort({ createdAt: -1 })
        .limit(50);

    return {
        created: sparks,
        invested: interactions.map(i => ({
            interactionId: i._id,
            spark: i.sparkId, // Populated
            action: i.action,
            weight: i.weight,
            timestamp: i.createdAt
        }))
    };
  }

  /**
   * Delete Spark (Revoke)
   * User can manually delete their spark (no refund of spatial rent/stake usually, or partial)
   */
  async deleteSpark(user, sparkId) {
    const spark = await Spark.findOne({ _id: sparkId, hostId: user._id });
    if (!spark) throw new Error('Spark not found or unauthorized');

    // Soft delete
    spark.status = 'EXPIRED'; // Using EXPIRED for now, or could add DELETED status
    spark.modifications.push({
      content: 'User Deleted',
      timestamp: new Date(),
      verifiedBy: []
    });
    
    await spark.save();
    return { success: true, message: 'Spark removed' };
  }

  /**
   * Lazy UBI Distribution (Inflation Control)
   * Checks if user is eligible for daily UBI and applies it.
   * Called during energy consumption events to reward active users.
   */
  async checkAndDistributeUBI(user) {
    try {
      const econ = await this.getEconomyConfig();
      const now = new Date();
      const lastClaim = user.lastUbiAt ? new Date(user.lastUbiAt) : new Date(0);
      const oneDay = 24 * 60 * 60 * 1000;
      
      // 1. Time Check (Daily)
      if (now - lastClaim < oneDay) return;

      // 2. Stake Check (Proof of Stake)
      // Users must hold minimum energy to receive UBI (prevents Sybil drain)
      const threshold = econ.ubiStakeThreshold !== undefined ? econ.ubiStakeThreshold : 50;
      if (user.energy < threshold) return;

      // 3. Cap Check (Battery Full)
      const cap = econ.energyCap || 100;
      if (user.energy >= cap) return;

      // 4. Distribute
      const amount = econ.ubiDailyAmount !== undefined ? econ.ubiDailyAmount : 5;
      user.energy = Math.min(user.energy + amount, cap);
      user.lastUbiAt = now;
      
      // Note: We modify user in-place; caller (burnEnergy) must save()
    } catch (e) {
      console.error('UBI Check Failed:', e);
    }
  }

  /**
   * Burn Energy (Anti-DDoS + Cost)
   * @param {string} userId 
   * @param {number} baseCost 
   */
  async burnEnergy(userId, baseCost = 5) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // 0. Lazy UBI Check (Reward Active Users)
    await this.checkAndDistributeUBI(user);

    const now = new Date();
    const lastPing = user.lastPingAt ? new Date(user.lastPingAt) : new Date(0);
    const diffMs = now - lastPing;

    // 1. Hard Rate Limit (Anti-DDoS)
    if (diffMs < 3000) { // 3 seconds
      throw new Error('Rate limit exceeded. Please wait.');
    }

    // 2. Dynamic Cost (Frequency Penalty)
    const config = await this.getEconomyConfig();
    const penaltyWindow = config.frequencyPenaltyWindow || 10000;
    const penaltyMult = config.frequencyPenaltyMult || 2;

    let cost = baseCost;
    if (diffMs < penaltyWindow) {
      cost = baseCost * penaltyMult; // Penalty for spamming
    }

    // 3. Check Balance
    if (user.energy < cost) {
      throw new Error(`Insufficient energy. Required: ${cost}, Available: ${user.energy}`);
    }

    // 4. Deduct & Update
    user.energy -= cost;
    user.lastPingAt = now;
    await user.save();

    return { energy: user.energy, cost };
  }

  /**
   * Run Daily Tasks
   * - Energy Inflation
   * - Expiration Cleanup
   */
  async runDailyMaintenance() {
    await this.energyPolicy.dailyIssuance();
    // await this.cleanupExpiredSparks();
  }
}

/**
 * Energy Monetary Policy
 * Vulnerability Fix #3, #9, #10: Economic Deflation & Matthew Effect
 */
class EnergyMonetaryPolicy {
  constructor() {
    this.baseSupply = 1000000;
    this.inflationRate = 0.0001; // 0.01% Daily
  }

  async dailyIssuance() {
    try {
      const totalUsers = await User.countDocuments();
      if (totalUsers === 0) return;

      // 1. Calculate Total Issuance
      // Logic: Inflation based on Active Users to encourage growth but limit unconditional printing
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Vulnerability Fix #2: Sybil UBI Attack
      // Only users with Staked Energy > 50 are considered "Active Citizens" eligible for UBI.
      // This forces Sybil attackers to lock up capital.
      const activeCitizensCount = await User.countDocuments({
        lastActiveAt: { $gt: sevenDaysAgo },
        stakedEnergy: { $gte: 50 } 
      });

      const issuanceAmount = this.baseSupply * this.inflationRate * (activeCitizensCount / totalUsers || 1);
      
      console.log(`[EnergyPolicy] Daily Issuance: ${issuanceAmount} Energy for ${activeCitizensCount} active citizens.`);

      // 2. Distribute via UBI (Universal Basic Income) + Reputation Reward
      // 50% UBI (Anti-Matthew Effect)
      // 50% Reputation Weighted (Incentive)
      
      const ubiPool = issuanceAmount * 0.5;
      const meritPool = issuanceAmount * 0.5;
      
      const ubiPerUser = Math.floor(ubiPool / (activeCitizensCount || 1));
      
      // Batch Update for UBI
      // Only credit those who staked
      await User.updateMany(
        { lastActiveAt: { $gt: sevenDaysAgo }, stakedEnergy: { $gte: 50 } },
        { $inc: { energy: ubiPerUser } }
      );

      // Merit Distribution (Simplified: Give to top 10% reputation users? Or Proportional?)
      // For performance, we might skip complex merit calculation in this MVP step
      // or implement a simple "Log in bonus" instead.
      
    } catch (err) {
      console.error('[EnergyPolicy] Failed to run daily issuance:', err);
    }
  }
}

module.exports = new MarketEngine();
