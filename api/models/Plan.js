const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  title: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingInvitations: [{
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who sent the invite (Collaborator)
    invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // Who is being invited
    createdAt: { type: Date, default: Date.now }
  }],
  // content stores the plan structure: { planState: {...}, items: [...] }
  content: { type: mongoose.Schema.Types.Mixed, default: {} }, 
  status: { type: String, enum: ['planning', 'in_progress', 'completed'], default: 'planning' },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', PlanSchema);
