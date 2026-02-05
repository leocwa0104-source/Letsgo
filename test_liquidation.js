
require('dotenv').config();
const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server');
const MarketEngine = require('./services/MarketEngine');
const User = require('./models/User');
const Spark = require('./models/Spark');
const Interaction = require('./models/Interaction');
const ShineConfig = require('./models/ShineConfig');

async function runLiquidationTest() {
    console.log('--- Starting Liquidation (Short Selling) Test ---');

    try {
        // Try to use existing connection or standard localhost
        // If 127.0.0.1 failed, maybe try localhost or check if mongod is running?
        // In this env, maybe we need to rely on the fact that the app runs?
        // Let's assume there is a DB or we mock it.
        // Actually, previous tests failed on connection.
        // Let's try to find where the app connects.
        // api/index.js connects to process.env.MONGODB_URI
        
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hkwl_test_liquidation';
        console.log(`Connecting to ${uri}...`);
        
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('Connected to Test DB');

        // Clean slate
        await User.deleteMany({});
        await Spark.deleteMany({});
        await Interaction.deleteMany({});
        await ShineConfig.deleteMany({});

        // 1. Setup Config
        const config = new ShineConfig({
            economy: {
                costPing: 100,
                dividendRatio: 0.5, // 50 per ping to pool
                verifierRetention: 1.0, // 100% to pool for this test (to build it up fast)
                witherThreshold: 0.4 // High threshold to trigger wither easily
            }
        });
        await config.save();

        // 2. Create Users
        const creator = await User.create({ username: 'creator', energy: 1000, password: 'password123' });
        const believer = await User.create({ username: 'believer', energy: 1000, password: 'password123' });
        const skeptic1 = await User.create({ username: 'skeptic1', energy: 1000, password: 'password123' });
        const skeptic2 = await User.create({ username: 'skeptic2', energy: 1000, password: 'password123' });
        const consumer = await User.create({ username: 'consumer', energy: 1000, password: 'password123' });

        // 3. Create Spark (Initial Conf 0.5)
        const location = [114.1, 22.3];
        const { spark } = await MarketEngine.createSpark(creator, {
            content: 'Fake News',
            coordinates: location,
            type: 'HARD_FACT',
            radius: 100
        });
        console.log(`Spark Created. Initial Conf: ${spark.snapshot.confidence}`);

        // 4. Believer Verifies (Confirm) -> Conf goes UP
        await MarketEngine.verify(believer, spark._id, 'CONFIRM', { 
            userLocation: location, distance: 0 
        });
        const sparkAfterConfirm = await Spark.findById(spark._id);
        console.log(`After Confirm: Conf ${sparkAfterConfirm.snapshot.confidence}`);

        // 5. Consumer Pings -> Builds up Reward Pool
        // Pool should get 50 energy
        await MarketEngine.ping(consumer, location, 500, false);
        const sparkAfterPing = await Spark.findById(spark._id);
        console.log(`Reward Pool: ${sparkAfterPing.verifierRewardPool}`);

        // 6. Skeptic1 Verifies (Deny) -> Conf goes DOWN
        await MarketEngine.verify(skeptic1, spark._id, 'CHALLENGE', { 
            userLocation: location, distance: 0 
        });
        console.log('Skeptic1 Denied.');
        
        // 7. Skeptic2 Verifies (Deny) -> Conf goes DOWN
        await MarketEngine.verify(skeptic2, spark._id, 'CHALLENGE', { 
            userLocation: location, distance: 0 
        });
        console.log('Skeptic2 Denied.');

        // Need one more deny to drop below 0.4
        const skeptic3 = await User.create({ username: 'skeptic3', energy: 1000, password: 'password123' });
        await MarketEngine.verify(skeptic3, spark._id, 'CHALLENGE', { 
            userLocation: location, distance: 0 
        });
        console.log('Skeptic3 Denied.');

        const sparkFinal = await Spark.findById(spark._id);
        console.log(`Final Status: ${sparkFinal.status}. Conf: ${sparkFinal.snapshot.confidence}`);
        console.log(`Final Pool: ${sparkFinal.verifierRewardPool} (Should be 0 if liquidated)`);

        // 8. Check Balances
        const skep1 = await User.findById(skeptic1._id);
        const skep2 = await User.findById(skeptic2._id);
        const skep3 = await User.findById(skeptic3._id);
        
        console.log(`Skeptic1 Energy: ${skep1.energy}`);
        console.log(`Skeptic2 Energy: ${skep2.energy}`);
        console.log(`Skeptic3 Energy: ${skep3.energy}`);

        if (sparkFinal.status === 'WITHERED' && sparkFinal.verifierRewardPool === 0 && skep1.energy > 1005) {
            console.log('SUCCESS: Spark liquidated and short sellers rewarded.');
        } else {
            console.log('FAILURE: Liquidation logic mismatch.');
        }

        process.exit(0);

    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

runLiquidationTest();
