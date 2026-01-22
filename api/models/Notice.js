const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema({
  content: { type: String, required: true },
  updatedBy: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
  targetUser: { type: String, default: 'all' } // 'all' or specific username
});

module.exports = mongoose.model('Notice', NoticeSchema);
