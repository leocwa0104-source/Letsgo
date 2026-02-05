const mongoose = require('mongoose');
require('dotenv').config(); // Load .env from cwd (project root)
const User = require('../models/User');
const Spark = require('../models/Spark');
const ShineConfig = require('../models/ShineConfig');
console.log('Requiring MarketEngine...');
const MarketEngine = require('../services/MarketEngine');
console.log('MarketEngine Required');
const h3 = require('h3-js');

// Config
const MONGO_URI = process.env.MONGODB_URI;
const TEST_DB_NAME = 'shineshone_test_cost';

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  process.exit(1);
});

async function runTest() {
    try {
        console.log('Starting Test Script...');
        if (!MONGO_URI) {
            throw new Error('MONGODB_URI not found in .env');
        }
        console.log('Connecting to MongoDB Atlas...');
        
        await mongoose.connect(MONGO_URI, { 
            dbName: TEST_DB_NAME,
            serverSelectionTimeoutMS: 10000 
        });
        console.log('Connected to ' + TEST_DB_NAME);
        
        // 1. Setup Config
        await ShineConfig.deleteMany({});
        await ShineConfig.create({
            economy: {
                costCreate: 50,    // x
                spatialRent: 10,   // c
                riskDeposit: 100,  // Deposit
                dailyFreePings: 5
            }
        });
        console.log('Config set: x=50, c=10, deposit=100');

        // 2. Create User
        await User.deleteMany({ username: 'test_cost_user' });
        const user = await User.create({
            username: 'test_cost_user',
            password: 'password123',
            energy: 1000,
            reputation: 10
        });
        console.log(`User created: Energy=${user.energy}`);

        // 3. Define Location (Tiananmen Square)
        const lat = 39.905489;
        const lng = 116.397632;
        const h3Index = h3.latLngToCell(lat, lng, 12);
        console.log(`Target Cell: ${h3Index}`);

        // --- Test 1: First Spark (n=1) ---
        console.log('\n--- Test 1: First Spark (n=1) ---');
        // Expected: x + (1-1)*c + deposit = 50 + 0 + 100 = 150
        const startEnergy1 = user.energy;
        const res1 = await MarketEngine.createSpark(user, {
            coordinates: [lng, lat],
            content: 'Spark 1',
            type: 'HARD_FACT',
            marketH3Indices: [h3Index]
        });
        
        const endEnergy1 = res1.energy;
        const cost1 = startEnergy1 - endEnergy1;
        console.log(`Spark 1 Cost: ${cost1}`);
        
        if (cost1 !== 150) {
            throw new Error(`Test 1 Failed: Expected 150, got ${cost1}`);
        } else {
            console.log('Test 1 Passed: Cost is 150 (50 + 0 + 100)');
        }

        // --- Test 2: Second Spark (n=2) ---
        console.log('\n--- Test 2: Second Spark (n=2) ---');
        // Reset lastPingAt to avoid rate limit and penalty
        await User.updateOne({ _id: user._id }, { lastPingAt: new Date(Date.now() - 20000) });
        
        // Expected: x + (2-1)*c + deposit = 50 + 10 + 100 = 160
        // Need to fetch user again to get updated energy in memory object if not returned by engine?
        // MarketEngine.createSpark updates the user object passed to it? 
        // Let's check MarketEngine implementation.
        // It calls this.burnEnergy(user._id, totalCost).
        // burnEnergy fetches user from DB, updates it, saves it.
        // The `user` object passed to createSpark is NOT automatically updated unless we reload it.
        // So we must reload user.
        
        const user2 = await User.findById(user._id);
        const startEnergy2 = user2.energy;
        
        const res2 = await MarketEngine.createSpark(user2, {
            coordinates: [lng, lat],
            content: 'Spark 2',
            type: 'HARD_FACT',
            marketH3Indices: [h3Index]
        });
        
        const endEnergy2 = res2.energy;
        const cost2 = startEnergy2 - endEnergy2;
        console.log(`Spark 2 Cost: ${cost2}`);
        
        if (cost2 !== 160) {
            throw new Error(`Test 2 Failed: Expected 160, got ${cost2}`);
        } else {
            console.log('Test 2 Passed: Cost is 160 (50 + 10 + 100)');
        }

        // --- Test 3: Third Spark (n=3) ---
        console.log('\n--- Test 3: Third Spark (n=3) ---');
        // Reset lastPingAt
        await User.updateOne({ _id: user._id }, { lastPingAt: new Date(Date.now() - 20000) });
        
        // Expected: x + (3-1)*c + deposit = 50 + 20 + 100 = 170
        const user3 = await User.findById(user._id);
        const startEnergy3 = user3.energy;
        
        const res3 = await MarketEngine.createSpark(user3, {
            coordinates: [lng, lat],
            content: 'Spark 3',
            type: 'HARD_FACT',
            marketH3Indices: [h3Index]
        });
        
        const endEnergy3 = res3.energy;
        const cost3 = startEnergy3 - endEnergy3;
        console.log(`Spark 3 Cost: ${cost3}`);
        
        if (cost3 !== 170) {
            throw new Error(`Test 3 Failed: Expected 170, got ${cost3}`);
        } else {
            console.log('Test 3 Passed: Cost is 170 (50 + 20 + 100)');
        }
        
        // --- Test 4: Different Cell (n=1) ---
        console.log('\n--- Test 4: Different Cell (n=1) ---');
        // Reset lastPingAt
        await User.updateOne({ _id: user._id }, { lastPingAt: new Date(Date.now() - 20000) });

        // New location nearby
        const lat2 = 39.906; 
        const lng2 = 116.398;
        const h3Index2 = h3.latLngToCell(lat2, lng2, 12);
        
        if (h3Index === h3Index2) console.warn("Warning: Cell 2 is same as Cell 1!");
        
        const user4 = await User.findById(user._id);
        const startEnergy4 = user4.energy;
        
        const res4 = await MarketEngine.createSpark(user4, {
            coordinates: [lng2, lat2],
            content: 'Spark 4 (New Cell)',
            type: 'HARD_FACT',
            marketH3Indices: [h3Index2]
        });
        
        const endEnergy4 = res4.energy;
        const cost4 = startEnergy4 - endEnergy4;
        console.log(`Spark 4 Cost: ${cost4}`);
        
        // Should be 150 again
        if (cost4 !== 150) {
            throw new Error(`Test 4 Failed: Expected 150, got ${cost4}`);
        } else {
            console.log('Test 4 Passed: Cost is 150 (Reset for new cell)');
        }

        console.log('\nALL TESTS PASSED');

    } catch (e) {
        console.error('TEST FAILED:', e);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
