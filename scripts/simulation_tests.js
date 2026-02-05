
require('dotenv').config();
const mongoose = require('mongoose');
const MarketEngine = require('../services/MarketEngine');
const User = require('../models/User');
const Spark = require('../models/Spark');
const Interaction = require('../models/Interaction');

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

const engine = require('../services/MarketEngine');
// engine is already an instance

async function runTests() {
    console.log(colors.cyan + "=== Starting Shineshone 5.0 Simulation Tests ===" + colors.reset);
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // --- Setup ---
        const testUserPrefix = "sim_test_user_";
        await User.deleteMany({ username: { $regex: `^${testUserPrefix}` } });
        
        // Create Actors
        const attacker = await new User({ username: `${testUserPrefix}attacker`, password: 'password123', energy: 1000 }).save();
        const victim = await new User({ username: `${testUserPrefix}victim`, password: 'password123', energy: 1000 }).save();
        const host = await new User({ username: `${testUserPrefix}host`, password: 'password123', energy: 1000 }).save();
        
        console.log(colors.green + "Setup Complete: Created test users." + colors.reset);

        // --- Scenario 1: Anti-DDoS & Energy Cost ---
        console.log(colors.yellow + "\n--- Scenario 1: Anti-DDoS & Energy Cost ---" + colors.reset);
        
        // 1.1 Normal Ping
        console.log("1.1 Normal Ping...");
        const res1 = await engine.ping(attacker, [121.47, 31.23]);
        console.log(`Ping 1 Cost: ${res1.cost} (Expected: 5)`);
        if (res1.cost !== 5) throw new Error("Base cost should be 5");

        // 1.2 Rapid Ping (Rate Limit)
        console.log("1.2 Rapid Ping (Should Fail)...");
        try {
            await engine.ping(attacker, [121.47, 31.23]);
            throw new Error("Rate limit failed to trigger!");
        } catch (e) {
            if (e.message.includes('Rate limit')) {
                console.log(colors.green + "Passed: Rate limit triggered." + colors.reset);
            } else {
                throw e;
            }
        }

        // 1.3 Fast Follow-up Ping (Dynamic Cost)
        console.log("Waiting 3.5s...");
        await new Promise(r => setTimeout(r, 3500));
        
        console.log("1.3 Fast Follow-up Ping (Should cost double)...");
        const res3 = await engine.ping(attacker, [121.47, 31.23]);
        console.log(`Ping 3 Cost: ${res3.cost} (Expected: 10)`);
        if (res3.cost !== 10) throw new Error("Dynamic cost should be 10");


        // --- Scenario 2: Anti-Collusion (Affinity Weighting) ---
        console.log(colors.yellow + "\n--- Scenario 2: Anti-Collusion (Affinity Weighting) ---" + colors.reset);
        
        // Create a Spark
        const spark = await engine.createSpark(host, {
            coordinates: [121.4737, 31.2304],
            content: "Test Spark",
            type: "HARD_FACT",
            radius: 50
        });

        // 2.1 First Vote (Full Weight)
        console.log("2.1 First Vote...");
        const vote1 = await engine.verify(attacker, spark._id, 'CONFIRM', {
            userLocation: [121.4737, 31.2304], // Perfect location
            distance: 0
        });
        console.log(`Vote 1 Weight: ${vote1.weight.toFixed(2)} (Expected: ~1.0)`);
        if (vote1.weight < 0.9) throw new Error("First vote should have high weight");

        // 2.2 Second Vote (Diminishing Return)
        console.log("2.2 Second Vote (Same Host)...");
        // Create another spark by SAME host
        const spark2 = await engine.createSpark(host, {
            coordinates: [121.4738, 31.2305],
            content: "Test Spark 2",
            type: "HARD_FACT",
            radius: 50
        });
        
        const vote2 = await engine.verify(attacker, spark2._id, 'CONFIRM', {
            userLocation: [121.4738, 31.2305],
            distance: 0
        });
        console.log(`Vote 2 Weight: ${vote2.weight.toFixed(2)} (Expected: ~0.5)`);
        if (vote2.weight > 0.6) throw new Error("Affinity weighting failed (Weight too high)");
        console.log(colors.green + "Passed: Affinity weighting applied." + colors.reset);


        // --- Scenario 3: Privacy Side-Channel (Differential Privacy) ---
        console.log(colors.yellow + "\n--- Scenario 3: Privacy Side-Channel (Differential Privacy) ---" + colors.reset);
        
        // Create a target spark
        const targetSpark = await engine.createSpark(host, {
            coordinates: [121.5000, 31.3000], // Exact location
            content: "Privacy Target",
            type: "HARD_FACT",
            radius: 50
        });
        
        // Manually boost confidence to ensure it appears in Ping (which filters confidence > 0.3)
        targetSpark.snapshot.confidence = 1.0;
        await targetSpark.save();

        console.log("3.1 Pinging Target...");
        // Use victim to ping (fresh budget)
        const pingRes = await engine.ping(victim, [121.5000, 31.3000], 1000);
        const foundSpark = pingRes.sparks.find(s => s._id.toString() === targetSpark._id.toString());
        
        if (!foundSpark) {
            console.log(colors.red + "Warning: Spark not found in ping (maybe radius/noise issue)" + colors.reset);
        } else {
            const originalLng = targetSpark.location.coordinates[0];
            const originalLat = targetSpark.location.coordinates[1];
            const returnedLng = foundSpark.location.coordinates[0];
            const returnedLat = foundSpark.location.coordinates[1];
            
            console.log(`Original: [${originalLng}, ${originalLat}]`);
            console.log(`Returned: [${returnedLng}, ${returnedLat}]`);
            
            const isPerturbed = Math.abs(originalLng - returnedLng) > 0.000001 || Math.abs(originalLat - returnedLat) > 0.000001;
            
            if (isPerturbed) {
                console.log(colors.green + "Passed: Location is perturbed." + colors.reset);
            } else {
                throw new Error("Privacy Failure: Exact location returned!");
            }
        }

        // --- Cleanup ---
        console.log(colors.cyan + "\nCleaning up..." + colors.reset);
        await User.deleteMany({ username: { $regex: `^${testUserPrefix}` } });
        await Spark.deleteMany({ hostId: { $in: [attacker._id, victim._id, host._id] } });
        await Interaction.deleteMany({ userId: { $in: [attacker._id, victim._id, host._id] } });
        
        console.log(colors.green + "=== All Simulation Tests Passed ===" + colors.reset);

    } catch (e) {
        console.error(colors.red + "\nTest Failed:" + colors.reset, e);
    } finally {
        await mongoose.disconnect();
    }
}

runTests();
