
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const UserData = require('./models/UserData');
const fetch = global.fetch || require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const USERNAME = 'test_remote_user_' + Date.now();
const PASSWORD = 'password123';

async function run() {
    // 1. Database Setup
    console.log('--- Step 1: Creating User in DB ---');
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const user = new User({ 
            username: USERNAME, 
            password: PASSWORD, 
            energy: 100,
            lastUbiAt: new Date() // Prevent UBI from triggering during test
        });
        await user.save();
        
        // Ensure UserData exists (mimic registration)
        await new UserData({ userId: user._id, data: {} }).save();
        
        console.log(`User created in DB: ${USERNAME}`);
        await mongoose.disconnect();
    } catch (e) {
        console.error('DB Setup Error:', e);
        process.exit(1);
    }

    // 2. API Testing
    console.log('\n--- Step 2: Testing API ---');
    try {
        // Login
        console.log('Logging in...');
        const loginRes = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: USERNAME,
                password: PASSWORD
            })
        });
        
        const loginData = await loginRes.json();
        if (!loginData.success) {
            console.error('Login failed:', loginData);
            return;
        }
        const token = loginData.token;
        console.log('Login success.');
        
        // Check Initial Status
        const statusRes = await fetch(`${BASE_URL}/api/auth/status`, {
            headers: { 'Authorization': token }
        });
        const statusData = await statusRes.json();
        let currentEnergy = statusData.energy !== undefined ? statusData.energy : (statusData.user?.energy || 100);
        console.log(`Initial Energy from API: ${currentEnergy}`);

        // 3. Local Ping
        console.log('\n--- Step 3: Local Ping (Expected Cost: 5) ---');
        // Fresh user, no history, should be base cost 5.
        const localRes = await fetch(`${BASE_URL}/api/market?action=ping`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token 
            },
            body: JSON.stringify({
                location: [121.4737, 31.2304], // Shanghai
                isRemote: false
            })
        });
        const localData = await localRes.json();
        if (localData.energy !== undefined) {
            const diff = currentEnergy - localData.energy;
            console.log(`Local Ping Cost: ${diff} (New Balance: ${localData.energy})`);
            if (diff === 5) console.log('PASS: Cost is 5');
            else console.error(`FAIL: Cost is ${diff}, expected 5`);
            currentEnergy = localData.energy;
        } else {
            console.error('Local Ping failed:', localData);
        }

        // 4. Remote Ping
        console.log('\n--- Step 4: Remote Ping (Expected Cost: 15 or 30 with penalty) ---');
        // Wait 4s to clear Rate Limit (3s), but hit Frequency Penalty (<10s)
        console.log('Waiting 4s (clears Rate Limit, hits Penalty)...');
        await new Promise(r => setTimeout(r, 4000)); 
        console.log('Wait over. Sending Remote Ping...');
        
        const remoteRes = await fetch(`${BASE_URL}/api/market?action=ping`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token 
            },
            body: JSON.stringify({
                location: [116.4074, 39.9042], // Beijing
                isRemote: true
            })
        });
        const remoteData = await remoteRes.json();
        if (remoteData.energy !== undefined) {
            const diff = currentEnergy - remoteData.energy;
            console.log(`Remote Ping Cost: ${diff} (New Balance: ${remoteData.energy})`);
            if (diff === 15) console.log('PASS: Cost is 15 (No Penalty)');
            else if (diff === 30) console.log('PASS: Cost is 30 (With Penalty 2x)');
            else console.error(`FAIL: Cost is ${diff}, expected 15 or 30`);
            currentEnergy = remoteData.energy;
        } else {
            console.error('Remote Ping failed:', remoteData);
        }

    } catch (e) {
        console.error('Test Exception:', e);
    }
}

run();
