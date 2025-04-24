const mongoose = require('mongoose');

const documentChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster searches
documentChunkSchema.index({ documentId: 1 });

module.exports = mongoose.model('DocumentChunk', documentChunkSchema);