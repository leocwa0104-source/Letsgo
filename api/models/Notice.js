const mongoose = require('mongoose');

const NoticeSchema = new mongoose.Schema({
  content: { type: String, required: true },
  updatedBy: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
  targetUser: { type: mongoose.Schema.Types.Mixed, default: 'all' } // 'all', string (username), or array of strings
});

module.exports = mongoose.model('Notice', NoticeSchema);
