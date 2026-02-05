require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Spark = require('../models/Spark');
const Interaction = require('../models/Interaction');
const MarketEngine = require('../services/MarketEngine');

// Connect to DB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ DB Connected'))
    .catch(err => console.error('DB Connection Error:', err));

async function main() {
    try {
        console.log('📉 Starting Liquidation Flow Test...');

        // 1. Setup Users
        const host = await createTestUser('liq_host');
        const believer = await createTestUser('liq_believer');
        const skeptic = await createTestUser('liq_skeptic');

        console.log('✅ Users Created (Energy: 1000)');

        // 2. Host creates Spark (Deposit 100 + Cost 50 = 150)
        const loc = [114.1, 22.3];
        const { spark } = await MarketEngine.createSpark(host, {
            coordinates: loc,
            content: 'This is a Fake News',
            type: 'HARD_FACT',
            radius: 100
        });
        
        const hostAfter = await User.findById(host._id);
        console.log(`✅ Spark Created. Host Energy: 1000 -> ${hostAfter.energy}. Deposit: ${spark.deposit}`);

        // 3. Believer Confirms (Cost 5 -> Pool)
        await MarketEngine.verify(believer, spark._id, 'CONFIRM', { userLocation: loc, distance: 10 });
        const sparkAfterConfirm = await Spark.findById(spark._id);
        console.log(`✅ Believer Confirmed. Pool: ${sparkAfterConfirm.verifierRewardPool} (Should be 5)`);

        // 4. Skeptic Challenges (Cost 5 -> Pool)
        await MarketEngine.verify(skeptic, spark._id, 'CHALLENGE', { userLocation: loc, distance: 10 });
        const sparkAfterChallenge = await Spark.findById(spark._id);
        console.log(`✅ Skeptic Challenged. Pool: ${sparkAfterChallenge.verifierRewardPool} (Should be 10)`);
        console.log(`   Confidence: ${sparkAfterChallenge.snapshot.confidence}`);

        // 5. Force Wither (Simulate Confidence Drop)
        sparkAfterChallenge.snapshot.confidence = 0.05; // Below threshold
        sparkAfterChallenge.status = 'WITHERED'; // Mark as withered
        await sparkAfterChallenge.save();
        console.log('📉 Spark forcibly withered (Confidence 0.05)');

        // 6. Trigger Liquidation
        const skepticBefore = await User.findById(skeptic._id);
        console.log(`   Skeptic Energy Before Liquidation: ${skepticBefore.energy}`);

        await MarketEngine.liquidateSpark(sparkAfterChallenge);

        // 7. Verify Results
        const skepticAfter = await User.findById(skeptic._id);
        const hostFinal = await User.findById(host._id);
        const believerFinal = await User.findById(believer._id);

        console.log('\n📊 Final Results:');
        console.log(`   Host Energy: ${hostFinal.energy} (Lost Deposit)`);
        console.log(`   Believer Energy: ${believerFinal.energy} (Lost Investment)`);
        console.log(`   Skeptic Energy: ${skepticBefore.energy} -> ${skepticAfter.energy} (Profit: ${skepticAfter.energy - skepticBefore.energy})`);

        // Expected Profit for Skeptic:
        // Deposit (100) + Believer (5) + Skeptic (5) = 110?
        // Wait, Liquidate logic: pool + deposit.
        // Pool = 10. Deposit = 100. Total = 110.
        // Skeptic is the ONLY challenger. So he should get 110.
        // Net Profit = 110 - Cost(5) = 105.

        if (skepticAfter.energy - skepticBefore.energy === 110) {
            console.log('✅ TEST PASSED: Skeptic took it all!');
        } else {
            console.log('❌ TEST FAILED: Distribution mismatch.');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        mongoose.connection.close();
    }
}

async function createTestUser(username) {
    await User.deleteOne({ username });
    return await User.create({
        username,
        password: 'password123',
        energy: 1000,
        reputation: 1
    });
}

main();