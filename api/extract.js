const express = require('express');
const { processDocument } = require('../lib/pdfProcessor');
const router = express.Router();

/**
 * Extract text from a document
 */
router.post('/', async (req, res, next) => {
  try {
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
    
    // Process the document
    const { text, metadata } = await processDocument(cloudinaryUrl, {
      enableOCR,
      documentId,
      filename
    });
    
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
    console.error('Error processing document:', error);
    
    // If it's an already formatted error, pass it to the error handler
    if (error.code && error.status) {
      return next(error);
    }
    
    // Otherwise, create a generic error
    next({
      code: 'EXTRACTION_FAILED',
      message: 'Failed to extract text from document',
      status: 500,
      originalError: error.message
    });
  }
});

module.exports = router; 