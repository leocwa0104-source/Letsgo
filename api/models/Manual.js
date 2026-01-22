const mongoose = require('mongoose');

const ManualSchema = new mongoose.Schema({
  content: { type: String, default: '' },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: String }
});

module.exports = mongoose.model('Manual', ManualSchema);
