const { processDocument } = require('../lib/pdfProcessor');

// Authentication middleware function
const authenticateRequest = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'UNAUTHORIZED', message: 'Missing or invalid authorization token' };
  }

  const token = authHeader.split(' ')[1];
  
  if (token !== process.env.API_KEY) {
    return { error: 'FORBIDDEN', message: 'Invalid API key' };
  }
  
  return null; // No error
};

/**
 * Extract text from a document - Vercel serverless function
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed'
    });
  }
  
  try {
    // Authenticate request
    const authError = authenticateRequest(req);
    if (authError) {
      return res.status(authError.error === 'UNAUTHORIZED' ? 401 : 403).json({
        success: false,
        error: authError.error,
        message: authError.message
      });
    }
    
    // Validate request body
    const { cloudinaryUrl, documentId, filename, fileType, enableOCR = true } = req.body;
    
    if (!cloudinaryUrl) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_URL',
        message: 'Document URL is required'
      });
    }
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_DOCUMENT_ID',
        message: 'Document ID is required'
      });
    }
    
    console.log(`Processing document ID: ${documentId}, URL: ${cloudinaryUrl}`);
    
    // Detect if this is likely a PDF uploaded to Cloudinary
    const isPdfFile = filename?.toLowerCase().endsWith('.pdf') || fileType?.toLowerCase() === 'pdf';
    
    // Process the document
    try {
      // Set process options
      const processOptions = {
        enableOCR,
        documentId,
        filename,
        // If file has PDF extension or type but Cloudinary might have converted it
        forcePdfMode: isPdfFile, 
        skipPdfValidation: isPdfFile
      };
      
      const { text, metadata } = await processDocument(cloudinaryUrl, processOptions);
      
      // Return the extracted text with metadata
      return res.json({
        success: true,
        data: {
          documentId,
          extractedText: text,
          metadata
        }
      });
    } catch (error) {
      // Special handling for images detected as PDFs
      if (error.code === 'UNSUPPORTED_FILE_TYPE' && 
          error.message.includes('image/') && 
          isPdfFile) {
        console.log('File detected as image but has PDF extension, using OCR directly...');
        
        const { text, metadata } = await processDocument(cloudinaryUrl, {
          enableOCR: true, // Force OCR
          documentId,
          filename,
          useDirectOcr: true // Special flag to use OCR directly
        });
        
        return res.json({
          success: true,
          data: {
            documentId,
            extractedText: text,
            metadata,
            note: 'File was processed with OCR as it was detected as an image'
          }
        });
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Error processing document:', error);
    
    // Return error response
    return res.status(error.status || 500).json({
      success: false,
      error: error.code || 'EXTRACTION_FAILED',
      message: error.message || 'Failed to extract text from document',
      fallbackSuggestion: 'Try again later or contact support'
    });
  }
}; 