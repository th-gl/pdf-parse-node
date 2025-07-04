const axios = require('axios');
const fs = require('fs');

/**
 * Download a file from Cloudinary URL with proper handling
 * @param {string} url - Cloudinary URL of the file to download
 * @returns {Promise} Object containing the file buffer and mimeType
 */
async function downloadFile(url) {
  try {
    console.log(`Attempting to download: ${url}`);

    // Get Cloudinary credentials from environment variables
    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

    // Extract filename from URL for better type detection
    const filename = extractFilenameFromUrl(url);
    console.log(`Extracted filename: ${filename}`);

    // Method 1: Try direct download without transformation
    try {
      console.log("Method 1: Direct download from original URL");
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // Accept 4xx errors to try other methods
      });

      if (response.status === 200) {
        const buffer = Buffer.from(response.data);
        const mimeType = detectMimeType(buffer, filename, response.headers['content-type']);

        console.log("Direct download successful!");
        console.log(`Content-Type: ${mimeType}, Size: ${buffer.length} bytes`);
        return { buffer, mimeType, size: buffer.length, url };
      } else {
        console.log(`Direct download failed with status: ${response.status}`);
      }
    } catch (e) {
      console.log("Direct download failed:", e.response?.status, e.message);
    }

    // Method 2: Try with proper resource type for PDFs
    try {
      console.log("Method 2: Using correct resource type");

      const publicId = extractPublicId(url);
      const cloudName = extractCloudName(url) || CLOUDINARY_CLOUD_NAME;

      if (publicId && cloudName) {
        // For PDFs, use raw resource type without transformations
        const isPdf = filename && filename.toLowerCase().endsWith('.pdf');
        const resourceType = isPdf ? 'raw' : 'image';

        let reconstructedUrl;
        if (isPdf) {
          // For PDFs, use raw delivery without any transformations
          reconstructedUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`;
        } else {
          // For images, use image delivery
          reconstructedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
        }

        console.log(`Using reconstructed URL (${resourceType}): ${reconstructedUrl}`);

        const response = await axios({
          method: 'get',
          url: reconstructedUrl,
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          maxRedirects: 5
        });

        const buffer = Buffer.from(response.data);
        const mimeType = detectMimeType(buffer, filename, response.headers['content-type']);

        console.log("Reconstructed URL download successful!");
        return { buffer, mimeType, size: buffer.length, url: reconstructedUrl };
      }
    } catch (e) {
      console.log("Reconstructed URL download failed:", e.response?.status, e.message);
    }

    // Method 3: Try with fl_attachment for download
    try {
      console.log("Method 3: Using attachment flag");

      const publicId = extractPublicId(url);
      const cloudName = extractCloudName(url) || CLOUDINARY_CLOUD_NAME;

      if (publicId && cloudName) {
        const attachmentUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/fl_attachment/${publicId}`;

        console.log(`Using attachment URL: ${attachmentUrl}`);

        const response = await axios({
          method: 'get',
          url: attachmentUrl,
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          }
        });

        const buffer = Buffer.from(response.data);
        const mimeType = detectMimeType(buffer, filename, response.headers['content-type']);

        console.log("Attachment URL download successful!");
        return { buffer, mimeType, size: buffer.length, url: attachmentUrl };
      }
    } catch (e) {
      console.log("Attachment URL download failed:", e.response?.status, e.message);
    }

    // Method 4: Try unsigned delivery URL with API key authentication
    try {
      console.log("Method 4: Unsigned delivery URL with authentication");

      const publicId = extractPublicId(url);
      const cloudName = extractCloudName(url) || CLOUDINARY_CLOUD_NAME;

      if (publicId && cloudName && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
        // Generate a timestamp and signature for authentication
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
        const signature = require('crypto').createHash('sha1').update(toSign).digest('hex');
        
        const unsignedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/fl_attachment,f_auto,q_auto/${publicId}?api_key=${CLOUDINARY_API_KEY}&timestamp=${timestamp}&signature=${signature}`;

        console.log(`Using authenticated URL: ${unsignedUrl}`);

        const response = await axios({
          method: 'get',
          url: unsignedUrl,
          responseType: 'arraybuffer',
          timeout: 60000
        });

        const buffer = Buffer.from(response.data);
        const mimeType = detectMimeType(buffer, filename, response.headers['content-type']);

        console.log("Authenticated URL download successful!");
        return { buffer, mimeType, size: buffer.length, url: unsignedUrl };
      }
    } catch (e) {
      console.log("Authenticated URL download failed:", e.response?.status, e.message);
    }

    throw new Error("All download methods failed");

  } catch (error) {
    console.error('All download methods failed:', error.message);

    throw {
      code: 'DOWNLOAD_FAILED',
      message: `Failed to download file: ${error.message}`,
      status: 500,
      originalUrl: url
    };
  }
}

/**
 * Extract filename from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Filename
 */
function extractFilenameFromUrl(url) {
  try {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];

    // Decode URL encoding
    const decoded = decodeURIComponent(lastPart);

    // Extract filename (remove version if present)
    const match = decoded.match(/(?:v\d+_)?(.+)$/);
    return match ? match[1] : decoded;
  } catch (e) {
    console.log("Error extracting filename:", e.message);
    return null;
  }
}

/**
 * Extract cloud name from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Cloud name
 */
function extractCloudName(url) {
  const match = url.match(/https:\/\/res\.cloudinary\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Extract public_id from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID
 */
function extractPublicId(url) {
  try {
    // Match pattern: /upload/v{version}/{public_id} or /upload/{public_id}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (match) {
      let publicId = match[1];

      // URL decode the public ID
      publicId = decodeURIComponent(publicId);

      return publicId;
    }
    return null;
  } catch (e) {
    console.log("Error extracting public ID:", e.message);
    return null;
  }
}

/**
 * Enhanced mime type detection with multiple fallback methods
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} headerContentType - Content-Type from HTTP headers
 * @returns {string} Detected MIME type
 */
function detectMimeType(buffer, filename = null, headerContentType = null) {
  // First, try to detect from file content (most reliable)
  const contentMimeType = detectMimeTypeFromContent(buffer);

  // Then try from filename extension
  const extensionMimeType = filename ? detectMimeTypeFromExtension(filename) : null;

  // Use header content type as fallback
  const headerMimeType = headerContentType && headerContentType !== 'application/octet-stream' 
    ? headerContentType 
    : null;

  // Priority: content detection > extension > header > default
  const detectedType = contentMimeType || extensionMimeType || headerMimeType || 'application/octet-stream';

  console.log(`MIME type detection - Content: ${contentMimeType}, Extension: ${extensionMimeType}, Header: ${headerMimeType}, Final: ${detectedType}`);

  return detectedType;
}

/**
 * Detect MIME type from file content signatures
 * @param {Buffer} buffer - File buffer
 * @returns {string|null} Detected MIME type or null
 */
function detectMimeTypeFromContent(buffer) {
  if (!buffer || buffer.length === 0) {
    return null;
  }

  // Check for PDF signature (%PDF)
  if (buffer.length >= 4) {
    const pdfSignature = buffer.slice(0, 4).toString('ascii', 0, 4);
    if (pdfSignature === '%PDF') {
      return 'application/pdf';
    }
  }

  // Check for DOCX signature (PK zip header)
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    // Further check for DOCX by looking for word-specific content
    const bufferStr = buffer.toString('hex', 0, Math.min(buffer.length, 1000));
    if (bufferStr.includes('776f72642f') || bufferStr.includes('_rels') || bufferStr.includes('docProps')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return 'application/zip';
  }

  // Check for DOC signature
  if (buffer.length >= 8) {
    const docSignature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    if (buffer.slice(0, 8).equals(Buffer.from(docSignature))) {
      return 'application/msword';
    }
  }

  // Check for PNG signature
  if (buffer.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if (buffer.slice(0, 8).equals(Buffer.from(pngSignature))) {
      return 'image/png';
    }
  }

  // Check for JPEG signature
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // Check for GIF signature
  if (buffer.length >= 6) {
    const gifSignature = buffer.slice(0, 6).toString('ascii');
    if (gifSignature === 'GIF87a' || gifSignature === 'GIF89a') {
      return 'image/gif';
    }
  }

  return null;
}

/**
 * Detect MIME type from file extension
 * @param {string} filename - Filename with extension
 * @returns {string|null} MIME type or null
 */
function detectMimeTypeFromExtension(filename) {
  if (!filename) return null;

  const extension = filename.toLowerCase().split('.').pop();

  const mimeTypes = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/avi'
  };

  return mimeTypes[extension] || null;
}

module.exports = {
  downloadFile
}; 