const mongoose = require('mongoose');

const UserDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  data: { type: Map, of: String }, // Stores key-value pairs of localStorage data
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserData', UserDataSchema);
