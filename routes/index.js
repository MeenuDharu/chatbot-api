const express = require('express');
const multer = require('multer');
const path = require('path');
const storage = require('../lib/storage');
const { processFile } = require('../lib/document-processor');
const { generateEmbedding, generateChatResponse } = require('../lib/openai');

// Configure multer for file upload
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only specific file types
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ];
    
    if (validTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, TXT, and MD files are allowed.'));
    }
  }
});

/**
 * Register routes for the Express application
 * @param {Object} app - Express application
 */
function registerRoutes(app) {
  // Create uploads directory if it doesn't exist
  const fs = require('fs');
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Document routes
  app.post('/api/documents', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const document = await processFile(req.file, req.file.originalname);
      res.status(201).json(document);
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });
  
  app.get('/api/documents', async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });
  
  app.delete('/api/documents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDocument(id);
      
      if (success) {
        res.status(204).end();
      } else {
        res.status(404).json({ error: 'Document not found' });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });
  
  // Chat routes
  app.post('/api/chat', async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      // Create user message
      const userMessage = {
        role: 'user',
        content
      };
      
      await storage.createMessage(userMessage);
      
      // Generate embedding for the message to find relevant chunks
      const embedding = await generateEmbedding(content);
      const similarChunks = await storage.searchSimilarChunks(embedding, 5);
      
      // Get existing messages for context
      const messages = await storage.getMessages();
      
      // Format messages for OpenAI
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Generate AI response
      const assistantResponse = await generateChatResponse(
        formattedMessages,
        { chunks: similarChunks }
      );
      
      // Save assistant message
      const savedMessage = await storage.createMessage({
        role: 'assistant',
        content: assistantResponse.content
      });
      
      res.json({
        message: savedMessage,
        context: {
          chunkCount: similarChunks.length
        }
      });
    } catch (error) {
      console.error('Error in chat API:', error);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  });
  
  app.get('/api/messages', async (req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });
  
  app.post('/api/messages/reset', async (req, res) => {
    try {
      await storage.clearMessages();
      res.json({ message: 'Chat history cleared' });
    } catch (error) {
      console.error('Error resetting messages:', error);
      res.status(500).json({ error: 'Failed to reset chat history' });
    }
  });
  
  // Serve Angular app in production
  /*app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client-angular/dist/index.html'));
  });*/
}

module.exports = {
  registerRoutes
};