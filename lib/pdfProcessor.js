const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { cleanText } = require('./textCleaner');
const { downloadFile } = require('./fileDownloader');

// Initialize Tesseract worker
let tesseractWorker = null;

/**
 * Extract text from a PDF file
 * @param {Buffer} buffer - PDF file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function extractTextFromPDF(buffer, options = {}) {
  const startTime = Date.now();
  
  try {
    // First try standard text extraction
    const result = await pdfParse(buffer);
    
    // Check if text was successfully extracted
    const extractedText = result.text;
    const wordCount = extractedText.split(/\s+/).length;
    
    // If not enough text found and OCR is enabled, use OCR
    if (wordCount < 50 && options.enableOCR) {
      console.log('Text extraction yielded minimal results. Attempting OCR...');
      return await extractTextWithOCR(buffer, options);
    }
    
    const cleanedText = cleanText(extractedText);
    
    const metadata = {
      totalPages: result.numpages,
      wordCount: cleanedText.split(/\s+/).length,
      extractionMethod: 'text',
      processingTime: Date.now() - startTime,
      confidence: 0.95 // High confidence for native text extraction
    };
    
    return { text: cleanedText, metadata };
  } catch (error) {
    console.error('Error in PDF text extraction:', error);
    
    // Fallback to OCR if enabled
    if (options.enableOCR) {
      console.log('Falling back to OCR due to error in text extraction');
      return await extractTextWithOCR(buffer, options);
    }
    
    throw {
      code: 'PDF_EXTRACTION_FAILED',
      message: 'Failed to extract text from PDF',
      status: 500
    };
  }
}

/**
 * Extract text using OCR
 * @param {Buffer} buffer - PDF file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function extractTextWithOCR(buffer, options = {}) {
  const startTime = Date.now();
  let tempDir = null;
  
  try {
    // Create temporary directory for image processing
    tempDir = fs.mkdtempSync(path.join('/tmp', 'pdf-ocr-'));
    const images = await convertPDFToImages(buffer, tempDir);
    
    if (!images || images.length === 0) {
      throw new Error('Could not convert PDF to images');
    }
    
    // Initialize Tesseract worker if not already done
    if (!tesseractWorker) {
      tesseractWorker = await Tesseract.createWorker('eng');
    }
    
    // Process each image with OCR
    let fullText = '';
    let totalConfidence = 0;
    
    for (let i = 0; i < images.length; i++) {
      const { data } = await tesseractWorker.recognize(images[i]);
      fullText += data.text + '\\n\\n';
      totalConfidence += data.confidence;
    }
    
    // Clean the extracted text
    const cleanedText = cleanText(fullText);
    
    const metadata = {
      totalPages: images.length,
      wordCount: cleanedText.split(/\\s+/).length,
      extractionMethod: 'ocr',
      processingTime: Date.now() - startTime,
      confidence: images.length > 0 ? totalConfidence / images.length : 0
    };
    
    return { text: cleanedText, metadata };
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
 * Convert PDF to images
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} outputDir - Directory to save images
 * @returns {Promise<string[]>} Paths to generated images
 */
async function convertPDFToImages(buffer, outputDir) {
  // This is a simplified implementation
  // In a real-world scenario, you would use a proper PDF to image conversion library
  // such as pdf2image, pdf.js, or ghostscript
  
  // For now, we'll simulate by assuming the PDF is already an image
  // In a complete implementation, you would:
  // 1. Convert each PDF page to an image
  // 2. Save each image to the outputDir
  // 3. Return paths to all images
  
  const imagePath = path.join(outputDir, 'page1.png');
  
  // Simply save the buffer as an image (this won't work for real PDFs)
  await fs.promises.writeFile(imagePath, buffer);
  
  return [imagePath];
}

/**
 * Extract text from a DOCX file
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function extractTextFromDOCX(buffer, options = {}) {
  const startTime = Date.now();
  
  try {
    const result = await mammoth.extractRawText({ buffer });
    const extractedText = result.value;
    const cleanedText = cleanText(extractedText);
    
    const metadata = {
      totalPages: 1, // Mammoth doesn't provide page count
      wordCount: cleanedText.split(/\\s+/).length,
      extractionMethod: 'docx',
      processingTime: Date.now() - startTime,
      confidence: 0.98
    };
    
    return { text: cleanedText, metadata };
  } catch (error) {
    console.error('Error in DOCX text extraction:', error);
    throw {
      code: 'DOCX_EXTRACTION_FAILED',
      message: 'Failed to extract text from DOCX',
      status: 500
    };
  }
}

/**
 * Process document based on file type
 * @param {string} fileUrl - URL to the file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function processDocument(fileUrl, options = {}) {
  try {
    // Download file from URL
    const fileData = await downloadFile(fileUrl);
    const { buffer, mimeType } = fileData;
    
    // Process based on file type
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(buffer, options);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCX(buffer, options);
    } else {
      throw {
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `Unsupported file type: ${mimeType}`,
        status: 400
      };
    }
  } catch (error) {
    if (error.code && error.status) {
      throw error;
    }
    throw {
      code: 'PROCESSING_FAILED',
      message: 'Failed to process document',
      status: 500,
      originalError: error.message
    };
  } finally {
    // Cleanup any Tesseract workers when done
    if (tesseractWorker && options.cleanupWorkers) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
  }
}

module.exports = {
  processDocument,
  extractTextFromPDF,
  extractTextFromDOCX
}; 