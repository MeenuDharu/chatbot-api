const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { generateEmbedding } = require('./openai');
const Document = require('../models/Document');
const DocumentChunk = require('../models/DocumentChunk');

/**
 * Process an uploaded file, create document record, and split into chunks
 * @param {Object} file - The uploaded file object from multer
 * @param {string} originalName - Original file name
 * @returns {Promise<Object>} - The created document
 */
async function processFile(file, originalName) {
  let text = '';
  
  // Extract file extension from original name
  const fileExtension = path.extname(originalName).toLowerCase();
  
  // Extract text based on file type
  try {
    if (fileExtension === '.pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (fileExtension === '.docx') {
      const dataBuffer = fs.readFileSync(file.path);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      text = result.value;
    } else if (fileExtension === '.txt' || fileExtension === '.md') {
      text = fs.readFileSync(file.path, 'utf8');
    } else {
      throw new Error('Unsupported file type');
    }
    
    // Create document entry
    const document = new Document({
      name: originalName,
      type: fileExtension.substring(1).toUpperCase(), // Remove the dot from extension
      size: file.size
    });
    
    const savedDocument = await document.save();
    
    // Process document into chunks
    await processDocumentChunks(savedDocument._id, text);
    
    // Clean up temporary file
    fs.unlinkSync(file.path);
    
    return savedDocument;
  } catch (error) {
    console.error('Error processing file:', error);
    
    // Clean up temporary file if it exists
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    throw error;
  }
}

/**
 * Process text from a document into chunks and store with embeddings
 * @param {string} documentId - The document ID
 * @param {string} text - The document text
 */
async function processDocumentChunks(documentId, text) {
  // Split text into chunks
  const chunkSize = 1000; // Characters per chunk
  const overlap = 200; // Overlap between chunks
  const chunks = splitTextIntoChunks(text, chunkSize, overlap);
  
  // Process each chunk
  for (const chunkText of chunks) {
    // Skip empty chunks
    if (!chunkText.trim()) continue;
    
    try {
      // Create chunk document
      const chunk = new DocumentChunk({
        documentId,
        content: chunkText
      });
      
      const savedChunk = await chunk.save();
      
      // Generate embedding in background
      generateEmbedding(chunkText)
        .then(async (embedding) => {
          // Update chunk with embedding
          savedChunk.embedding = embedding;
          await savedChunk.save();
        })
        .catch(error => {
          console.error('Error generating embedding for chunk:', error);
        });
    } catch (error) {
      console.error('Error saving document chunk:', error);
    }
  }
}

/**
 * Split text into chunks with overlap
 * @param {string} text - The text to split
 * @param {number} chunkSize - Max characters per chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} - Array of text chunks
 */
function splitTextIntoChunks(text, chunkSize, overlap) {
  const chunks = [];
  let startPos = 0;
  
  while (startPos < text.length) {
    // Calculate end position for this chunk
    let endPos = startPos + chunkSize;
    
    // Adjust end position to nearest paragraph or sentence end if possible
    if (endPos < text.length) {
      // Try to find paragraph end
      const paragraphEnd = text.indexOf('\n\n', endPos - 100);
      if (paragraphEnd !== -1 && paragraphEnd < endPos + 100) {
        endPos = paragraphEnd;
      } else {
        // Try to find sentence end
        const sentenceEnd = text.indexOf('. ', endPos - 100);
        if (sentenceEnd !== -1 && sentenceEnd < endPos + 50) {
          endPos = sentenceEnd + 1; // Include the period
        }
      }
    }
    
    // Ensure we don't go beyond text length
    endPos = Math.min(endPos, text.length);
    
    // Extract chunk
    const chunk = text.substring(startPos, endPos);
    chunks.push(chunk);
    
    // Move start position for next chunk, with overlap
    startPos = endPos - overlap;
    
    // Ensure we make progress
    if (startPos >= text.length || endPos === text.length) {
      break;
    }
  }
  
  return chunks;
}

module.exports = {
  processFile
};