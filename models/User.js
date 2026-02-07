const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true }, // Added for Auth migration
  password: { type: String, required: true }, // In production, hash this!
  friendId: { type: String, unique: true, sparse: true }, // 6-char unique ID for adding friends
  friends: [{ type: String }], // Array of usernames
  friendRequests: [{
    from: String, // username
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    timestamp: { type: Date, default: Date.now }
  }],
  nickname: { type: String, default: '' },
  avatar: { type: String, default: '' }, // Emoji or URL
  home: {
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    location: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  // Personal ShineMap Config
  shineConfig: {
    physics: {
        stationaryTime: { type: Number, default: 10000 }, // ms
        stationaryRadius: { type: Number, default: 100 }, // m
        baseEnergyPassing: { type: Number, default: 1 },
        baseEnergyStaying: { type: Number, default: 5 },
        dwellExponent: { type: Number, default: 1.5 }
    },
    visuals: {
        theme: { type: String, default: 'cyberpunk' },
        colorStops: [{ type: mongoose.Schema.Types.Mixed }] // Array of {stop, color, opacity}
    },
    updatedAt: { type: Date, default: Date.now }
  },
  // Market / Anti-DDoS Fields
  energy: { type: Number, default: 100, min: 0 },
  lastPingAt: { type: Date, default: null },
  lastUbiAt: { type: Date, default: null }, // Track last UBI claim
  reputation: { type: Number, default: 1 }, // User Reputation (Credit Score)
  
  // Market Usage Stats (Daily Limits)
  marketStats: {
    lastDailyReset: { type: Date, default: Date.now },
    pingsToday: { type: Number, default: 0 }
  },

  createdAt: { type: Date, default: Date.now },
  lastNoticeSeenAt: { type: Date, default: null }
});

module.exports = mongoose.model('User', UserSchema);
