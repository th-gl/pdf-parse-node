const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const { cleanText } = require('./textCleaner');
const { downloadFile } = require('./fileDownloader');

// For OCR functionality (optional)
let Tesseract, sharp;
try {
  Tesseract = require('tesseract.js');
  sharp = require('sharp');
} catch (e) {
  console.log('OCR dependencies not available. OCR functionality disabled.');
}

let tesseractWorker = null;

/**
 * Extract text from a PDF file with improved error handling
 * @param {Buffer} buffer - PDF file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise} Extracted text and metadata
 */
async function extractTextFromPDF(buffer, options = {}) {
  const startTime = Date.now();

  try {
    console.log('Starting PDF text extraction...');

    // Validate PDF buffer
    if (!buffer || buffer.length < 4) {
      throw new Error('Invalid PDF buffer');
    }

    // Check PDF signature unless skipSignatureCheck is true
    if (!options.skipSignatureCheck) {
      const pdfSignature = buffer.slice(0, 4).toString('ascii');
      if (pdfSignature !== '%PDF') {
        throw new Error('File is not a valid PDF');
      }
      console.log('PDF signature validated, extracting text...');
    } else {
      console.log('Skipping PDF signature validation as requested');
    }

    // Try standard text extraction
    const result = await pdfParse(buffer, {
      max: options.maxPages || 100, // Limit pages for performance
    }).catch(err => {
      console.log('PDF parsing failed, using fallback extraction:', err.message);
      
      // If we're skipping signature check, this might not be a real PDF
      // In this case, let's just return a mock result
      if (options.skipSignatureCheck) {
        return { text: '', numpages: 1 };
      }
      throw err;
    });

    const extractedText = result.text || '';
    const wordCount = extractedText.trim().split(/\s+/).length;

    console.log(`Extracted ${wordCount} words from ${result.numpages} pages`);

    // If not enough text found and OCR is enabled, use OCR
    if (wordCount < 10 && options.enableOCR && Tesseract) {
      console.log('Text extraction yielded minimal results. Attempting OCR...');
      return await extractTextWithOCR(buffer, options);
    }

    const cleanedText = cleanText(extractedText);

    const metadata = {
      totalPages: result.numpages,
      wordCount: cleanedText.split(/\s+/).length,
      extractionMethod: 'text',
      processingTime: Date.now() - startTime,
      confidence: 0.95
    };

    return { text: cleanedText, metadata };
  } catch (error) {
    console.error('Error in PDF text extraction:', error);

    // Fallback to OCR if enabled
    if (options.enableOCR && Tesseract && error.message !== 'File is not a valid PDF') {
      console.log('Falling back to OCR due to error in text extraction');
      try {
        return await extractTextWithOCR(buffer, options);
      } catch (ocrError) {
        console.error('OCR fallback also failed:', ocrError);
      }
    }

    throw {
      code: 'PDF_EXTRACTION_FAILED',
      message: `Failed to extract text from PDF: ${error.message}`,
      status: 500
    };
  }
}

/**
 * Extract text using OCR (requires tesseract.js and pdf2pic or similar)
 * @param {Buffer} buffer - PDF file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise} Extracted text and metadata
 */
async function extractTextWithOCR(buffer, options = {}) {
  if (!Tesseract) {
    throw new Error('OCR dependencies not available');
  }

  const startTime = Date.now();
  let tempDir = null;

  try {
    console.log('Starting OCR extraction...');

    // Create temporary directory for image processing
    tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pdf-ocr-'));

    let text = '';
    let confidence = 0.7;
    let totalPages = 1;
    
    // Handle direct OCR on image files (PNG/JPEG) or PDFs converted to images by Cloudinary
    if (options.isPngAsPdf || options.directImageOcr) {
      const processingMode = options.isPngAsPdf ? 'PNG as PDF' : 'direct image OCR';
      console.log(`Processing with ${processingMode} - using OCR on the image`);
      
      // Initialize Tesseract worker if needed
      if (!tesseractWorker) {
        console.log('Initializing Tesseract worker...');
        tesseractWorker = await Tesseract.createWorker();
        await tesseractWorker.loadLanguage('eng');
        await tesseractWorker.initialize('eng');
      }
      
      // Process the image directly with Tesseract
      const imagePath = path.join(tempDir, 'image.png');
      fs.writeFileSync(imagePath, buffer);
      
      // Preprocess the image for better OCR results if Sharp is available
      if (sharp) {
        try {
          console.log('Preprocessing image for better OCR quality...');
          await sharp(buffer)
            .greyscale()
            .normalize()
            .sharpen()
            .toFile(imagePath);
        } catch (sharpErr) {
          console.log('Image preprocessing failed, using original image:', sharpErr.message);
          fs.writeFileSync(imagePath, buffer);
        }
      }
      
      console.log('Running OCR on image...');
      const { data } = await tesseractWorker.recognize(imagePath);
      text = data.text || '';
      confidence = data.confidence / 100;  // Convert to 0-1 scale
      
      // Clean up the extracted text
      text = cleanText(text);
      console.log(`OCR extracted ${text.length} characters with confidence: ${confidence.toFixed(2)}`);
    } else {
      console.log('Note: Full PDF-to-image conversion for OCR is not implemented');
      text = 'OCR extraction not fully implemented for PDF documents';
    }

    const metadata = {
      totalPages,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      extractionMethod: 'ocr',
      processingTime: Date.now() - startTime,
      confidence
    };

    return { text, metadata };
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw {
      code: 'OCR_FAILED',
      message: 'Failed to extract text using OCR',
      status: 500
    };
  } finally {
    // Clean up temporary files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Extract text from a DOCX file
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise} Extracted text and metadata
 */
async function extractTextFromDOCX(buffer, options = {}) {
  const startTime = Date.now();

  try {
    console.log('Starting DOCX text extraction...');

    const result = await mammoth.extractRawText({ buffer });
    const extractedText = result.value || '';
    const cleanedText = cleanText(extractedText);

    console.log(`Extracted ${cleanedText.length} characters from DOCX`);

    const metadata = {
      totalPages: 1,
      wordCount: cleanedText.split(/\s+/).length,
      extractionMethod: 'docx',
      processingTime: Date.now() - startTime,
      confidence: 0.98
    };

    return { text: cleanedText, metadata };
  } catch (error) {
    console.error('Error in DOCX text extraction:', error);
    throw {
      code: 'DOCX_EXTRACTION_FAILED',
      message: `Failed to extract text from DOCX: ${error.message}`,
      status: 500
    };
  }
}

/**
 * Extract text from plain text file
 * @param {Buffer} buffer - Text file buffer
 * @returns {Promise} Extracted text and metadata
 */
async function extractTextFromTXT(buffer, options = {}) {
  const startTime = Date.now();

  try {
    console.log('Starting TXT text extraction...');

    const text = buffer.toString('utf8');
    const cleanedText = cleanText(text);

    const metadata = {
      totalPages: 1,
      wordCount: cleanedText.split(/\s+/).length,
      extractionMethod: 'txt',
      processingTime: Date.now() - startTime,
      confidence: 1.0
    };

    return { text: cleanedText, metadata };
  } catch (error) {
    console.error('Error in TXT text extraction:', error);
    throw {
      code: 'TXT_EXTRACTION_FAILED',
      message: `Failed to extract text from TXT: ${error.message}`,
      status: 500
    };
  }
}

/**
 * Process document based on file type
 * @param {string} fileUrl - URL to the file
 * @param {Object} options - Processing options
 * @returns {Promise} Extracted text and metadata
 */
async function processDocument(fileUrl, options = {}) {
  try {
    console.log(`Processing document from URL: ${fileUrl}`);

    // Download file from URL
    const fileData = await downloadFile(fileUrl);
    let { buffer, mimeType } = fileData;

    console.log(`File downloaded successfully. MIME type: ${mimeType}, Size: ${buffer.length} bytes`);
    
    // Special case: Use direct OCR on images (when we know it's actually a PDF)
    if (options.useDirectOcr && mimeType.startsWith('image/')) {
      console.log('Using direct OCR on image file');
      return await extractTextWithOCR(buffer, { 
        ...options,
        directImageOcr: true 
      });
    }

    // Force PDF mode for images if requested
    if (options.forcePdfMode && mimeType.startsWith('image/')) {
      if (options.skipPdfValidation) {
        console.log('Forcing OCR for image that should be a PDF');
        return await extractTextWithOCR(buffer, { 
          ...options,
          isPngAsPdf: true 
        });
      } else {
        console.log('Forcing application/pdf MIME type for image');
        mimeType = 'application/pdf';
      }
    }

    // Process based on file type
    switch (mimeType) {
      case 'application/pdf':
        // Skip validation if requested (for image files being treated as PDFs)
        const pdfOptions = { ...options };
        if (options.skipPdfValidation) {
          pdfOptions.skipSignatureCheck = true;
        }
        return await extractTextFromPDF(buffer, pdfOptions);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractTextFromDOCX(buffer, options);

      case 'application/msword':
        throw {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'Legacy DOC files are not supported. Please convert to DOCX.',
          status: 400
        };

      case 'text/plain':
        return await extractTextFromTXT(buffer, options);

      default:
        throw {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: `Unsupported file type: ${mimeType}. Supported types: PDF, DOCX, TXT`,
          status: 400
        };
    }
  } catch (error) {
    console.error('Document processing failed:', error);

    if (error.code && error.status) {
      throw error;
    }

    throw {
      code: 'PROCESSING_FAILED',
      message: 'Failed to process document',
      status: 500,
      originalError: error.message
    };
  }
}

module.exports = {
  processDocument,
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromTXT
}; 