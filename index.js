const express = require('express');
const path = require('path');
const cors = require('cors');
const { connectToDatabase } = require('./lib/db');
const { registerRoutes } = require('./routes');
require('dotenv').config();

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing required environment variable: OPENAI_API_KEY');
  console.error('Please set this variable in your .env file or environment');
  process.exit(1);
}

// Create Express application
const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static Angular files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client-angular/dist')));
}

// Register API routes
registerRoutes(app);

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`https://chatbot.simplextf.com:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();