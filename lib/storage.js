const Document = require('../models/Document');
const DocumentChunk = require('../models/DocumentChunk');
const Message = require('../models/Message');
const { calculateCosineSimilarity } = require('./utils');

/**
 * MongoDB storage adapter for application data
 */
class MongoStorage {
  /**
   * Create a new document
   * @param {Object} document - Document data
   * @returns {Promise<Object>} - Created document
   */
  async createDocument(document) {
    const newDocument = new Document(document);
    return await newDocument.save();
  }

  /**
   * Get all documents
   * @returns {Promise<Array>} - List of documents
   */
  async getDocuments() {
    return await Document.find().sort({ createdAt: -1 });
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} - Document or null if not found
   */
  async getDocument(id) {
    return await Document.findById(id);
  }

  /**
   * Delete document by ID
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} - True if document was deleted
   */
  async deleteDocument(id) {
    // Delete the document
    const result = await Document.findByIdAndDelete(id);
    
    if (!result) {
      return false;
    }
    
    // Delete all chunks associated with the document
    await DocumentChunk.deleteMany({ documentId: id });
    
    return true;
  }

  /**
   * Create a document chunk
   * @param {Object} chunk - Chunk data
   * @returns {Promise<Object>} - Created chunk
   */
  async createDocumentChunk(chunk) {
    const newChunk = new DocumentChunk(chunk);
    return await newChunk.save();
  }

  /**
   * Get all chunks for a document
   * @param {string} documentId - Document ID
   * @returns {Promise<Array>} - List of chunks
   */
  async getDocumentChunks(documentId) {
    return await DocumentChunk.find({ documentId });
  }

  /**
   * Update embedding for a document chunk
   * @param {string} id - Chunk ID
   * @param {Array<number>} embedding - Embedding vector
   * @returns {Promise<Object>} - Updated chunk
   */
  async updateDocumentChunkEmbedding(id, embedding) {
    return await DocumentChunk.findByIdAndUpdate(
      id,
      { embedding },
      { new: true }
    );
  }

  /**
   * Search for similar chunks based on embedding vector
   * @param {Array<number>} embedding - Query embedding vector
   * @param {number} limit - Max number of results
   * @returns {Promise<Array>} - List of similar chunks
   */
  async searchSimilarChunks(embedding, limit) {
    // Get all chunks that have embeddings
    const chunks = await DocumentChunk.find({
      embedding: { $ne: null }
    }).populate('documentId', 'name');
    
    // Calculate similarity scores
    const chunksWithScores = chunks.map(chunk => {
      const similarity = calculateCosineSimilarity(embedding, chunk.embedding);
      return { chunk, similarity };
    });
    
    // Sort by similarity (descending) and take top results
    chunksWithScores.sort((a, b) => b.similarity - a.similarity);
    
    // Return top chunks
    return chunksWithScores
      .slice(0, limit)
      .map(item => item.chunk);
  }

  /**
   * Create a new message
   * @param {Object} message - Message data
   * @returns {Promise<Object>} - Created message
   */
  async createMessage(message) {
    const newMessage = new Message(message);
    return await newMessage.save();
  }

  /**
   * Get all messages
   * @returns {Promise<Array>} - List of messages
   */
  async getMessages() {
    return await Message.find().sort({ createdAt: 1 });
  }

  /**
   * Clear all messages
   * @returns {Promise<void>}
   */
  async clearMessages() {
    await Message.deleteMany({});
  }

  /**
   * Legacy methods for compatibility with the TypeScript version
   */
  
  /**
   * Get user by ID (legacy)
   * @param {number} id - User ID
   * @returns {Promise<Object|undefined>} - User or undefined
   */
  async getUser(id) {
    return undefined;
  }

  /**
   * Get user by username (legacy)
   * @param {string} username - Username
   * @returns {Promise<Object|undefined>} - User or undefined
   */
  async getUserByUsername(username) {
    return undefined;
  }

  /**
   * Create a new user (legacy)
   * @param {Object} user - User data
   * @returns {Promise<Object>} - Created user
   */
  async createUser(user) {
    return {};
  }
}

// Export singleton instance
module.exports = new MongoStorage();