
require('dotenv').config({ path: 'F:/HKWL/.env' }); // Absolute path to be safe
const mongoose = require('mongoose');
const User = require('../models/User');
const UserData = require('../models/UserData');

const BASE_URL = 'http://localhost:3000/api';

async function main() {
    try {
        console.log('🚀 Starting Market Flow Simulation (Direct DB Auth)...');

        // 1. Connect to DB to get/create a user
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const username = 'sim_user_auto';
        let user = await User.findOne({ username });
        if (!user) {
            console.log('Creating test user...');
            user = new User({ username, password: 'password123' });
            await user.save();
            await new UserData({ userId: user._id, data: {} }).save();
        }
        console.log(`✅ Using user: ${user.username} (${user._id})`);

        // Reset Energy
        user.energy = 1000;
        await user.save();
        console.log('⚡ Energy reset to 1000');

        // Construct Token (Simple format used by middleware: "userId:username")
        // Note: Middleware decodes URI component for username
        const token = `${user._id}:${encodeURIComponent(user.username)}`;
        console.log('🔑 Generated Token:', token);

        // 2. Ping
        console.log('🔵 2. Pinging Market...');
        const loc = [114.1694, 22.3193]; // HK
        let res = await fetch(`${BASE_URL}/market?action=ping`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ location: loc })
        });
        
        // Handle 401 specifically
        if (res.status === 401) {
             const err = await res.json();
             throw new Error(`Auth Failed: ${err.error}`);
        }

        const pingData = await res.json();
        if (!res.ok) throw new Error('Ping failed: ' + (pingData.error || res.statusText));
        console.log('✅ Ping Result:', pingData.sparks ? `${pingData.sparks.length} sparks found` : 'No sparks field');

        console.log('Waiting for rate limit...');
        await new Promise(r => setTimeout(r, 3500));

        // 3. Create Spark
        console.log('🔵 3. Creating Spark...');
        res = await fetch(`${BASE_URL}/market?action=create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                coordinates: loc,
                content: 'Simulation Truth Particle ' + Date.now(),
                type: 'HARD_FACT',
                radius: 50
            })
        });
        const createData = await res.json();
        if (!res.ok) throw new Error('Create failed: ' + (createData.error || res.statusText));
        const sparkId = createData.spark._id;
        console.log('✅ Spark Created:', sparkId);

        console.log('Waiting for rate limit...');
        await new Promise(r => setTimeout(r, 3500));

        // 4. Verify Spark
        console.log('🔵 4. Verifying Spark...');
        res = await fetch(`${BASE_URL}/market?action=verify`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                sparkId: sparkId,
                vote: 'CONFIRM',
                meta: { userLocation: loc }
            })
        });
        const verifyData = await res.json();
        if (!res.ok) {
             console.log('⚠️ Verification warning:', verifyData.error);
        } else {
             console.log('✅ Verified. New Confidence:', verifyData.newConfidence);
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
        if(e.cause) console.error(e.cause);
    } finally {
        await mongoose.disconnect();
    }
}

main();
