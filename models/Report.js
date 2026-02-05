const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Report Model (Legal & Compliance)
 * Addresses Vulnerability: Legal Liability Vacuum
 * Allows users to flag illegal/harmful content for removal.
 */
const ReportSchema = new Schema({
  targetId: { 
    type: Schema.Types.ObjectId, 
    required: true, 
    index: true 
  },
  targetType: { 
    type: String, 
    enum: ['Spark', 'User'], 
    required: true 
  },
  reporterId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  reason: { 
    type: String, 
    enum: ['GDPR', 'Illegal', 'Harassment', 'Spam', 'Other'], 
    required: true 
  },
  description: String,
  status: { 
    type: String, 
    enum: ['PENDING', 'RESOLVED', 'DISMISSED'], 
    default: 'PENDING' 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', ReportSchema);