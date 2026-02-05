const mongoose = require('mongoose');

const GenerationJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for now (anonymous)
  type: { type: String, enum: ['video', 'image'], default: 'video' },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  fileName: { type: String }, // Original file name
  resultUrl: { type: String }, // URL of generated .splat
  progress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

module.exports = mongoose.model('GenerationJob', GenerationJobSchema);