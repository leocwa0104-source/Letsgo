const mongoose = require('mongoose');
const User = require('../models/User');
const UserData = require('../models/UserData');
require('dotenv').config();

const resetAdmin = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  // Admin credentials
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Default fallback

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let user = await User.findOne({ username: adminUsername });
    
    if (user) {
      console.log(`Admin user '${adminUsername}' found. Resetting password...`);
      user.password = adminPassword;
      await user.save();
      console.log(`Password reset to: ${adminPassword}`);
    } else {
      console.log(`Admin user '${adminUsername}' not found. Creating...`);
      user = new User({
        username: adminUsername,
        password: adminPassword,
        role: 'admin' // If your schema uses roles, otherwise just username check
      });
      await user.save();
      
      // Create user data entry if needed
      await new UserData({ userId: user._id, data: {} }).save();
      console.log(`Admin user created with password: ${adminPassword}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error resetting admin:', err);
    process.exit(1);
  }
};

resetAdmin();
