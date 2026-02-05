
require('dotenv').config({ path: 'F:/HKWL/.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Spark = require('../models/Spark');
const Interaction = require('../models/Interaction');
const MarketEngine = require('../services/MarketEngine');

async function main() {
    try {
        console.log('♟️ Starting Game Theory Simulation...');

        // 1. DB Connection
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ DB Connected');

        // 2. Setup Users
        const createTestUser = async (username) => {
            // Cleanup first
            await User.deleteOne({ username });
            
            // Create rich user
            return await User.create({
                username,
                password: 'password123',
                energy: 1000, // Increased from default to cover deposits
                reputation: 1
            });
        };

        const host = await createTestUser('sim_host');
        const alice = await createTestUser('sim_alice'); // Honest Verifier
        const bob = await createTestUser('sim_bob');     // Honest Verifier
        const eve = await createTestUser('sim_eve');     // Attacker/Dissenter

        console.log('✅ Users Created: Host, Alice, Bob, Eve');

        // 3. Host creates Spark
        const loc = [114.1, 22.3];
        const spark = await MarketEngine.createSpark(host, {
            coordinates: loc,
            content: 'The sky is blue',
            type: 'HARD_FACT',
            radius: 100
        });
        console.log(`✅ Spark Created by Host. Confidence: ${spark.spark.snapshot.confidence}`);

        // 4. Round 1: Alice Confirms
        const aliceStartEnergy = alice.energy;
        const res1 = await MarketEngine.verify(alice, spark.spark._id, 'CONFIRM', { 
            userLocation: loc, 
            distance: 10 
        });
        const aliceEndEnergy = (await User.findById(alice._id)).energy;
        
        console.log(`\n🔹 Round 1: Alice CONFIRMS`);
        console.log(`   Confidence: ${res1.newConfidence.toFixed(4)}`);
        console.log(`   Alice Energy: ${aliceStartEnergy} -> ${aliceEndEnergy} (Change: ${aliceEndEnergy - aliceStartEnergy})`);

        // 5. Round 2: Bob Confirms
        const res2 = await MarketEngine.verify(bob, spark.spark._id, 'CONFIRM', { 
            userLocation: loc, 
            distance: 20 
        });
        console.log(`\n🔹 Round 2: Bob CONFIRMS`);
        console.log(`   Confidence: ${res2.newConfidence.toFixed(4)}`);

        // 6. Round 3: Eve Challenges (Collusion/Attack attempt?)
        const res3 = await MarketEngine.verify(eve, spark.spark._id, 'CHALLENGE', { 
            userLocation: loc, 
            distance: 5 
        });
        console.log(`\n🔹 Round 3: Eve CHALLENGES`);
        console.log(`   Confidence: ${res3.newConfidence.toFixed(4)}`);

        // 7. Analysis
        console.log('\n📊 Game Theory Analysis:');
        if (res2.newConfidence > res1.newConfidence) {
            console.log('   ✅ Consensus mechanism working: More confirmations = Higher confidence');
        } else {
            console.log('   ❌ Consensus mechanism failing');
        }

        if (res3.newConfidence < res2.newConfidence) {
            console.log('   ✅ Dissent mechanism working: Challenge lowers confidence');
        } else {
            console.log('   ❌ Dissent mechanism failing');
        }
        
        if (aliceEndEnergy === aliceStartEnergy) {
            console.log('   ⚠️ Incentive Warning: No immediate energy reward for verification.');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

main();
