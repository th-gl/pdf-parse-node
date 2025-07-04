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