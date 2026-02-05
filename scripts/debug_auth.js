
require('dotenv').config({ path: '../.env' }); // Adjust path if needed
const mongoose = require('mongoose');
const User = require('../models/User');

async function debugAuth() {
    if (!process.env.MONGODB_URI) {
        console.error('No MONGODB_URI found');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Simulate Login
        // Replace with the username you are testing with
        const username = 'shineshone'; 
        const user = await User.findOne({ username });

        if (!user) {
            console.log(`User ${username} not found. Listing all users...`);
            const users = await User.find({}, 'username');
            console.log(users.map(u => u.username));
            return;
        }

        console.log(`Found user: ${user.username}, ID: ${user._id}`);

        // 2. Generate Token
        const token = `${user._id}:${encodeURIComponent(user.username)}`;
        console.log(`Generated Token: ${token}`);

        // 3. Simulate Middleware Verification
        const parts = token.split(':');
        const userIdFromToken = parts[0];
        const usernameFromToken = decodeURIComponent(parts.slice(1).join(':'));

        console.log(`Parsed ID: ${userIdFromToken}`);
        console.log(`Parsed Username: ${usernameFromToken}`);

        const userById = await User.findById(userIdFromToken);
        
        if (userById) {
            console.log('SUCCESS: User found by ID from token.');
            console.log(`Matched User: ${userById.username}, ID: ${userById._id}`);
        } else {
            console.error('FAILURE: User NOT found by ID from token.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

debugAuth();
