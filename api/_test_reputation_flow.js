
const mongoose = require('mongoose');
// Load environment variables for DB connection
require('dotenv').config({ path: 'F:/HKWL/.env' });

const MarketEngine = require('../services/MarketEngine');
const User = require('../models/User');
const Spark = require('../models/Spark');
const Interaction = require('../models/Interaction');
const ShineConfig = require('../models/ShineConfig');

// Mocks
const mockConfig = {
    economy: {
        costPing: 5,
        costVerify: 2,
        costCreate: 50,
        riskDeposit: 100,
        reputationLossPublisher: 0.5,
        reputationLossBeliever: 0.1,
        reputationGainChallenger: 0.2
    }
};

MarketEngine.getEconomyConfig = async () => mockConfig.economy;

async function runTest() {
    console.log('--- Starting Reputation Flow Test ---');
    
    // Use the main DB defined in .env
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('Error: MONGODB_URI not found in environment');
        process.exit(1);
    }

    console.log(`Connecting to DB...`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    try {
        // Cleanup Test Data Only (Don't wipe entire DB if using shared one)
        // We'll use specific usernames to avoid collision
        await User.deleteMany({ username: { $in: ['rep_publisher', 'rep_believer', 'rep_skeptic'] } });
        // We can't easily isolate Sparks/Interactions without IDs, so we'll rely on fresh user IDs.
        
        // 1. Setup Users
        const publisher = await User.create({ username: 'rep_publisher', password: 'password123', energy: 1000, reputation: 1.0 });
        const believer = await User.create({ username: 'rep_believer', password: 'password123', energy: 1000, reputation: 1.0 });
        const skeptic = await User.create({ username: 'rep_skeptic', password: 'password123', energy: 1000, reputation: 1.0 });

        console.log('Users created. Initial Reputation: 1.0');
        
        // 2. Create Spark (False Info)
        const spark = await Spark.create({
            hostId: publisher._id,
            content: 'Fake News Test',
            location: { type: 'Point', coordinates: [0, 0] },
            deposit: 100,
            verifierRewardPool: 0,
            snapshot: { upvotes: 0, downvotes: 0, confidence: 0.5 },
            validUntil: new Date(Date.now() + 86400000),
            // Missing required fields
            expiresAt: new Date(Date.now() + 86400000),
            stakedEnergy: 100,
            type: 'HARD_FACT'
        });

        // 3. Interactions
        // Believer votes CONFIRM (Wrong)
        await Interaction.create({
            sparkId: spark._id,
            userId: believer._id,
            action: 'CONFIRM',
            weight: 1.0,
            distance: 0,
            userLocation: { type: 'Point', coordinates: [0, 0] }
        });
        spark.snapshot.upvotes += 1;
        spark.verifierRewardPool += 2; 

        // Skeptic votes CHALLENGE (Right)
        await Interaction.create({
            sparkId: spark._id,
            userId: skeptic._id,
            action: 'CHALLENGE',
            weight: 1.0,
            distance: 0,
            userLocation: { type: 'Point', coordinates: [0, 0] }
        });
        spark.snapshot.downvotes += 1;
        spark.verifierRewardPool += 2; 

        // 4. Trigger Liquidation
        spark.snapshot.confidence = 0.05; 
        spark.status = 'WITHERED';

        console.log('Triggering Liquidation for Spark:', spark._id);
        await MarketEngine.liquidateSpark(spark);
        
        // Wait for async updates
        await new Promise(r => setTimeout(r, 1000));

        // 5. Verify Results
        const p = await User.findById(publisher._id);
        const b = await User.findById(believer._id);
        const s = await User.findById(skeptic._id);

        console.log('\n--- Final Reputation ---');
        console.log(`Publisher (Expected 0.5): ${p.reputation}`);
        console.log(`Believer  (Expected 0.9): ${b.reputation}`);
        console.log(`Skeptic   (Expected 1.2): ${s.reputation}`);

        // Assertions
        if (p.reputation !== 0.5) throw new Error(`Publisher rep mismatch: ${p.reputation}`);
        if (b.reputation !== 0.9) throw new Error(`Believer rep mismatch: ${b.reputation}`);
        if (s.reputation !== 1.2) throw new Error(`Skeptic rep mismatch: ${s.reputation}`);

        console.log('\n✅ TEST PASSED: Reputation logic works correctly.');

        // Cleanup
        await Spark.deleteOne({ _id: spark._id });
        await Interaction.deleteMany({ sparkId: spark._id });
        await User.deleteMany({ username: { $in: ['rep_publisher', 'rep_believer', 'rep_skeptic'] } });

    } catch (err) {
        console.error('❌ TEST FAILED:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Done.');
        process.exit(0);
    }
}

runTest();
