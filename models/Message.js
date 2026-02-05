const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },   // username
  receiver: { type: String, required: true }, // username (or 'all_users', 'admin')
  content: { type: String, required: true },
  readBy: [{ type: String }], // Array of usernames who have read the message
  isRecalled: { type: Boolean, default: false },
  type: { type: String, default: 'text' }, // text, invitation, system, friend_request
  metadata: { type: mongoose.Schema.Types.Mixed }, // Flexible object for extra data
  timestamp: { type: Date, default: Date.now }
});

// Create index for faster queries
MessageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
MessageSchema.index({ receiver: 1, sender: 1, timestamp: -1 });
MessageSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Message', MessageSchema);
