const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  module: {
    type: String,
    required: true,
    enum: ['spark', 'window', 'anchor', 'echo'],
    index: true
  },
  // Unified fields: A content item can have title, text, and/or image
  title: {
    type: String,
    default: ''
  },
  content: { // This stores the main text body
    type: String,
    default: ''
  },
  image: { // Base64 or URL
    type: String,
    default: ''
  },
  // Legacy field, kept for safety but can be ignored in new logic
  contentType: {
    type: String,
    enum: ['text', 'image', 'mixed'],
    default: 'mixed'
  },
  author: {
    type: String,
    default: 'Shineshone'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  weight: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Content', ContentSchema);
