const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 2000
  },
  verificationInfo: {
    type: String,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'documents', 'pets', 'accessories', 'clothing', 'keys', 'bags', 'other']
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: {
      address: String
    },
    required: true
  },
  imageUrl: {
    type: String
  },
  imageEmbedding: {
    type: [Number]
  },
  audioUrl: {
    type: String
  },
  audioTranscript: {
    type: String
  },
  textEmbedding: {
    type: [Number]
  },
  status: {
    type: String,
    enum: ['active', 'matched', 'resolved', 'expired'],
    default: 'active'
  },
  matchedWith: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  matchScore: {
    type: Number
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
itemSchema.index({ user: 1, type: 1 });
itemSchema.index({ status: 1, type: 1 });
itemSchema.index({ category: 1, type: 1 });
itemSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Item', itemSchema);
