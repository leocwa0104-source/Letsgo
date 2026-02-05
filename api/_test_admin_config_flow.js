
require('dotenv').config({ path: 'F:/HKWL/.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const ShineConfig = require('../models/ShineConfig');

const BASE_URL = 'http://localhost:3000/api';

async function main() {
    try {
        console.log('🚀 Starting Admin Config & User Flow Simulation...');

        // 1. DB Connection
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Ensure Admin User Exists
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        let adminUser = await User.findOne({ username: adminUsername });
        if (!adminUser) {
            console.log('Creating admin user...');
            adminUser = new User({ username: adminUsername, password: 'password123', energy: 10000 });
            await adminUser.save();
        }
        const adminToken = `${adminUser._id}:${encodeURIComponent(adminUser.username)}`;
        console.log(`🔑 Admin Token for ${adminUsername}: ${adminToken}`);

        // 3. Admin Updates Config (Set Risk Deposit to 250)
        console.log('🔵 3. Admin setting Risk Deposit to 250...');
        const newRiskDeposit = 250;
        let res = await fetch(`${BASE_URL}/admin/shinemap/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
            body: JSON.stringify({
                economy: { riskDeposit: newRiskDeposit }
            })
        });
        
        const configData = await res.json();
        if (!configData.success) throw new Error('Failed to update config: ' + configData.error);
        console.log('✅ Admin Config Updated. New Risk Deposit:', configData.config.economy.riskDeposit);

        // 4. Verify via User Market API
        console.log('🔵 4. Verifying via Market API...');
        // Create a regular user for this check
        const userUsername = 'test_user_config';
        let normalUser = await User.findOne({ username: userUsername });
        if (!normalUser) {
            normalUser = new User({ username: userUsername, password: 'password123', energy: 1000 });
            await normalUser.save();
        }
        const userToken = `${normalUser._id}:${encodeURIComponent(normalUser.username)}`;

        res = await fetch(`${BASE_URL}/market?action=config`, {
            method: 'GET',
            headers: { 'Authorization': userToken }
        });
        const marketConfig = await res.json();
        if (marketConfig.config.riskDeposit !== newRiskDeposit) {
            throw new Error(`Mismatch! Expected ${newRiskDeposit}, got ${marketConfig.config.riskDeposit}`);
        }
        console.log('✅ Market API reflects new Risk Deposit:', marketConfig.config.riskDeposit);

        // 5. Attempt to create Spark with insufficient energy (checking if logic uses new cost)
        // Default create cost is 50. Risk Deposit is 250. Total needed = 300.
        // User has 1000. Let's set user energy to 200 (insufficient)
        normalUser.energy = 200;
        await normalUser.save();

        console.log('🔵 5. Testing creation with 200 energy (Need 300)...');
        const createCost = marketConfig.config.costCreate || 50; 
        
        // Expect Failure
        res = await fetch(`${BASE_URL}/market?action=create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': userToken
            },
            body: JSON.stringify({
                coordinates: [114.1, 22.3], 
                content: 'Should Fail Spark',
                type: 'HARD_FACT',
                radius: 50
            })
        });
        
        if (res.ok) {
            throw new Error('Should have failed due to insufficient energy (200 < 300)');
        }
        console.log('✅ Correctly rejected creation due to insufficient energy.');

        // 6. Test Success with Enough Energy
        console.log('🔵 6. Testing creation with 1000 energy...');
        normalUser.energy = 1000;
        await normalUser.save();
        const startEnergy = normalUser.energy;

        res = await fetch(`${BASE_URL}/market?action=create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': userToken
            },
            body: JSON.stringify({
                coordinates: [114.1, 22.3], 
                content: 'Risk Deposit Test Spark',
                type: 'HARD_FACT',
                radius: 50
            })
        });
        const createData = await res.json();
        if (!res.ok) throw new Error('Create failed: ' + createData.error);

        const endEnergy = createData.energy;
        const deduction = startEnergy - endEnergy;
        
        console.log(`✅ Spark Created. Energy: ${startEnergy} -> ${endEnergy} (Deducted: ${deduction})`);
        
        // Check if deduction includes the deposit
        // We know at least 50 (create) + 250 (deposit) = 300
        if (deduction < 300) {
            throw new Error(`Deduction too low! Expected at least 300, got ${deduction}`);
        }
        
        // 7. Reset Config
        console.log('🔵 7. Resetting Config to default (100)...');
        await fetch(`${BASE_URL}/admin/shinemap/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': adminToken },
            body: JSON.stringify({
                economy: { riskDeposit: 100 }
            })
        });
        console.log('✅ Config Reset.');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await mongoose.disconnect();
    }
}

main();
