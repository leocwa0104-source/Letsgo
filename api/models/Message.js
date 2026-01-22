const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true }, // username
  receiver: { type: String, required: true }, // username or 'all_users' or 'admin'
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  readBy: [String], // Array of usernames who have read this message
});

// Compound index for common queries
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
