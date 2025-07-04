const axios = require('axios');

/**
 * Download a file from a URL
 * @param {string} url - URL of the file to download
 * @returns {Promise<Object>} Object containing the file buffer and mimeType
 */
async function downloadFile(url) {
  try {
    console.log(`Downloading file from: ${url}`);
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000, // 30 seconds timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max file size
      headers: {
        'User-Agent': 'PDF-Extractor-Service/1.0'
      }
    });
    
    // Convert to Buffer and determine mimeType
    const buffer = Buffer.from(response.data, 'binary');
    const mimeType = response.headers['content-type'] || detectMimeType(buffer);
    
    return {
      buffer,
      mimeType,
      size: buffer.length,
      url
    };
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a non-2xx status
      throw {
        code: 'DOWNLOAD_FAILED',
        message: `Failed to download file: ${error.response.status} ${error.response.statusText}`,
        status: 500
      };
    } else if (error.request) {
      // The request was made but no response was received
      throw {
        code: 'DOWNLOAD_FAILED',
        message: 'No response received from server',
        status: 500
      };
    } else {
      // Something else happened in setting up the request
      throw {
        code: 'DOWNLOAD_FAILED',
        message: `Error downloading file: ${error.message}`,
        status: 500
      };
    }
  }
}

/**
 * Simple mime type detection based on file signatures
 * @param {Buffer} buffer - File buffer
 * @returns {string} Detected MIME type
 */
function detectMimeType(buffer) {
  // Check for PDF signature
  if (buffer.length > 4 && buffer.slice(0, 4).toString() === '%PDF') {
    return 'application/pdf';
  }
  
  // Check for DOCX signature (PK zip header)
  if (buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4B) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  
  // Default to octet-stream if unknown
  return 'application/octet-stream';
}

module.exports = {
  downloadFile
}; 