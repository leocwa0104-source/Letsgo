const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true }, // username
  receiver: { type: String, required: true }, // username or 'all_users' or 'admin'
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String }], // Array of usernames who have read this message
});

module.exports = mongoose.model('Message', messageSchema);
