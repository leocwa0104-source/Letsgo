const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['mood', 'intel'], required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL 24 hours
});

// Create geospatial index for location queries
SignalSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Signal', SignalSchema);
