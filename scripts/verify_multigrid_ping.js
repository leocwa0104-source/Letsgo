const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Spark = require('../models/Spark');
const ShineConfig = require('../models/ShineConfig');
const MarketEngine = require('../services/MarketEngine');
const h3 = require('h3-js');

const MONGO_URI = process.env.MONGODB_URI;
const TEST_DB_NAME = 'shineshone_test_ping';

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  process.exit(1);
});

async function runTest() {
    try {
        console.log('Starting Multi-Grid Ping Test...');
        if (!MONGO_URI) throw new Error('MONGODB_URI not found');

        await mongoose.connect(MONGO_URI, { 
            dbName: TEST_DB_NAME,
            serverSelectionTimeoutMS: 10000 
        });
        console.log('Connected to ' + TEST_DB_NAME);

        // 1. Setup Config
        await ShineConfig.deleteMany({});
        await ShineConfig.create({
            economy: {
                costPing: 5,
                costPingRemote: 15,
                dailyFreePings: 3
            }
        });
        console.log('Config set: costPing=5, dailyFreePings=3');

        // 2. Create User
        await User.deleteMany({ username: 'test_ping_user' });
        let user = await User.create({
            username: 'test_ping_user',
            password: 'password123',
            energy: 1000,
            marketStats: {
                pingsToday: 0,
                lastDailyReset: new Date()
            }
        });
        console.log(`User created: Energy=${user.energy}, PingsToday=0`);

        const engine = MarketEngine; // MarketEngine is already an instance

        // 3. Define Grids
        const h3Index1 = h3.latLngToCell(39.9, 116.4, 12);
        const h3Index2 = h3.latLngToCell(39.9, 116.41, 12);
        const h3Index3 = h3.latLngToCell(39.9, 116.42, 12);

        // --- Test 1: Ping 2 Grids (Both Free) ---
        console.log('\n--- Test 1: Ping 2 Grids (Both Free) ---');
        // Current Pings: 0. Quota: 3.
        // Selecting 2 grids -> Remaining Quota 3 >= 2. All Free.
        
        const res1 = await engine.ping(user, [h3Index1, h3Index2]);
        console.log(`Ping 1 Result: Energy=${res1.energy}, Cost=${res1.cost}`);

        if (res1.cost !== 0) throw new Error(`Test 1 Failed: Expected Cost 0, got ${res1.cost}`);
        
        // Reload user to check stats
        let userAfter1 = await User.findById(user._id);
        console.log(`PingsToday: ${userAfter1.marketStats.pingsToday}`);
        
        if (userAfter1.marketStats.pingsToday !== 2) throw new Error(`Test 1 Failed: Expected pingsToday 2, got ${userAfter1.marketStats.pingsToday}`);

        // --- Test 2: Ping 2 Grids (1 Free, 1 Paid) ---
await new Promise(r => setTimeout(r, 100)); // Small delay
await User.updateOne({ _id: user._id }, { lastPingAt: new Date(Date.now() - 5000) }); // Bypass rate limit
user = await User.findById(user._id); // Reload user to get updated pingsToday
console.log('\n--- Test 2: Ping 2 Grids (1 Free, 1 Paid) ---');
        // Current Pings: 2. Quota: 3. Remaining Free: 1.
        // Selecting 2 grids -> 1 Free, 1 Paid. Cost = 5.
        
        // Need to wait >3s for rate limit? Logic says:
        // if cost > 0, burnEnergy handles it (no manual wait needed usually, unless burnEnergy enforces strict time?)
        // if cost == 0, manual 3s wait.
        // Since this is PARTIAL paid, totalCost > 0, so it hits burnEnergy.
        // Assuming burnEnergy doesn't block immediately if money is enough.
        
        const res2 = await engine.ping(userAfter1, [h3Index1, h3Index2]);
        console.log(`Ping 2 Result: Energy=${res2.energy}, Cost=${res2.cost}`); // Note: ping returns current energy, not cost field usually? Wait, let's check return signature.
        
        // The ping function returns { sparks: [], energy: ..., cost: ... } in my implementation?
        // Checking code: 
        // return { sparks: [], energy: energyResult.energy, cost }; (in error case)
        // But in success case?
        // It returns `safeResults`?
        // Ah, I need to check what `ping` returns at the end.
        
        // Let's check `MarketEngine.js` again.
        // It ends with:
        /*
        return {
            sparks: safeResults,
            energy: energyResult.energy,
            cost: totalCost
        };
        */
        // I need to ensure I added this return structure or verify what existing code returned.
        
    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
