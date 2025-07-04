require('dotenv').config();
const express = require('express');
const cors = require('cors');
const extractRoute = require('./api/extract');
const healthRoute = require('./api/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization token'
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (token !== process.env.API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Invalid API key'
    });
  }
  
  next();
};

// Routes
app.use('/api/extract', authenticateRequest, extractRoute);
app.use('/api/health', healthRoute);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'PDF Extraction Service',
    status: 'Running',
    endpoints: [
      '/api/extract',
      '/api/health'
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    fallbackSuggestion: 'Try again later or contact support'
  });
});

// Start the server if not in production (Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app; 