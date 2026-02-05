
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import Model
// Assuming ShineCell model is in ../api/models/ShineCell.js
const ShineCell = require('../api/models/ShineCell');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in .env');
    process.exit(1);
}

async function cleanup() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // 1. Delete all documents where resolution is NOT 12
        // Note: Legacy documents might not have a resolution field, or have it as 9.
        // We can also check gridId length? Res 12 is longer.
        // But relying on the 'resolution' field if it exists, or assuming 9 if missing is safer.
        // Actually, let's just delete anything where resolution != 12.
        
        console.log('Deleting non-Resolution-12 cells...');
        
        const result = await ShineCell.deleteMany({
            $or: [
                { resolution: { $ne: 12 } },
                { resolution: { $exists: false } } // Treat missing resolution as legacy
            ]
        });

        console.log(`Cleanup Complete: Deleted ${result.deletedCount} documents.`);

        // Optional: We can also verify H3 index validity, but resolution check should cover it.
        
    } catch (error) {
        console.error('Cleanup Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    }
}

cleanup();
