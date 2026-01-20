const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // In production, hash this!
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
