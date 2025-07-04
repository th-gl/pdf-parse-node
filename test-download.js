require('dotenv').config(); // Load environment variables
const { downloadFile } = require('./lib/fileDownloader');
const fs = require('fs');
const path = require('path');

async function testDownload() {
  try {
    const url = "https://res.cloudinary.com/djjikb3s2/image/upload/v1751643822/documents/31f3abb1-fd94-4660-b92b-ae3a55a2b554/1751643821707_The%20poem.pdf.pdf";

    console.log('Starting download test...');
    console.log('URL:', url);
    console.log('Using Cloudinary credentials from environment variables:');
    console.log('- Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || 'Not set');
    console.log('- API Key:', process.env.CLOUDINARY_API_KEY ? '****' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'Not set');
    console.log('- API Secret:', process.env.CLOUDINARY_API_SECRET ? '****' + process.env.CLOUDINARY_API_SECRET.slice(-4) : 'Not set');

    const result = await downloadFile(url);

    console.log('Download successful!');
    console.log(`MIME type: ${result.mimeType}`);
    console.log(`Size: ${result.size} bytes`);

    // Create downloads directory if it doesn't exist
    const downloadsDir = './downloads';
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir);
    }

    // Save the file with proper extension
    const extension = result.mimeType === 'application/pdf' ? '.pdf' : '.bin';
    const filename = `downloaded-file-${Date.now()}${extension}`;
    const filepath = path.join(downloadsDir, filename);

    fs.writeFileSync(filepath, result.buffer);
    console.log(`File saved as ${filepath}`);

    // Verify the file was saved correctly
    const stats = fs.statSync(filepath);
    console.log(`File size on disk: ${stats.size} bytes`);

    return result;
  } catch (error) {
    console.error('Test failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Status:', error.status);

    if (error.originalUrl) {
      console.error('Original URL:', error.originalUrl);
    }
  }
}

testDownload(); 