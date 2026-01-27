const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
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
  createdAt: { type: Date, default: Date.now },
  lastNoticeSeenAt: { type: Date, default: null }
});

module.exports = mongoose.model('User', UserSchema);
