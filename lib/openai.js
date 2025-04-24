const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for a text using OpenAI
 * @param {string} text - The text to generate embedding for
 * @returns {Promise<number[]>} - The embedding vector
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

/**
 * Generate a chat response using OpenAI API with RAG context
 * @param {Array<Object>} messages - Array of messages with role and content
 * @param {Object} context - Context information for the chat
 * @returns {Promise<Object>} - The AI response
 */
async function generateChatResponse(messages, context = {}) {
  try {
    // Create a system message with context information
    const contextChunks = context.chunks || [];
    let contextText = '';
    
    if (contextChunks.length > 0) {
      contextText = "IMPORTANT: You are Stephen, a document-based support assistant. You must ONLY answer based on the document excerpts provided below. If the answer cannot be found in these excerpts, explicitly state that you cannot answer based on the available documents. Do NOT use any external knowledge.\n\n";
      contextChunks.forEach((chunk, i) => {
        contextText += `Document excerpt ${i+1}:\n${chunk.content}\n\n`;
      });
    } else {
      contextText = "You are Stephen, a document-based support assistant. You can ONLY answer questions based on uploaded document content. If no relevant documents have been uploaded or if the documents don't contain the necessary information, politely explain that you can only provide answers based on uploaded documents and cannot use external knowledge.";
    }
    
    const systemMessage = {
      role: "system",
      content: contextText
    };
    
    // Prepare the messages array with system message first
    const formattedMessages = [systemMessage, ...messages];
    
    // Generate response from OpenAI with stricter temperature
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model
      messages: formattedMessages,
      temperature: 0.3, // Lower temperature for more deterministic responses
      max_tokens: 1000
    });
    
    return response.choices[0].message;
  } catch (error) {
    console.error("Error generating chat response:", error);
    throw new Error("Failed to generate response");
  }
}

module.exports = {
  generateEmbedding,
  generateChatResponse
};