# PDF Extraction Service

A Node.js microservice for extracting text from PDF and DOCX documents, with OCR capabilities for scanned documents.

## Features

- Extract text from PDF and DOCX documents
- Fallback to OCR when standard text extraction yields insufficient results
- API key authentication
- Designed for serverless deployment on Vercel
- Text cleaning and formatting for improved readability
- Health monitoring endpoint

## Prerequisites

- Node.js 18.x
- Vercel account (for deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pdf-parse-node.git
cd pdf-parse-node/pdf-extractor-service
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your API key:
```
API_KEY=your_secure_api_key_here
```

## Usage

### Running Locally

Start the development server:

```bash
npm run dev
```

The server will run on port 3000 by default.

### API Endpoints

#### Extract Text from Document

```
POST /api/extract
```

**Headers:**
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "cloudinaryUrl": "https://example.com/path/to/document.pdf",
  "documentId": "doc123",
  "filename": "example.pdf",
  "fileType": "pdf",
  "enableOCR": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "doc123",
    "extractedText": "The extracted text content...",
    "metadata": {
      "totalPages": 5,
      "wordCount": 1250,
      "extractionMethod": "text",
      "processingTime": 1543,
      "confidence": 0.95
    }
  }
}
```

#### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uptime": 1000,
    "timestamp": 1632145079135,
    "status": "ok",
    "version": "1.0.0",
    "memory": {
      "rss": 45678912,
      "heapTotal": 23456789,
      "heapUsed": 12345678,
      "external": 1234567
    },
    "cpu": {
      "user": 123456,
      "system": 12345
    }
  }
}
```

## Deployment

This service is optimized for deployment on Vercel:

1. Set up a Vercel account and install the Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy to Vercel:
```bash
vercel
```

3. Set the API_KEY environment variable in your Vercel project settings.

## Configuration

The service can be configured through the following environment variables:

- `PORT`: The port on which the service runs locally (default: 3000)
- `API_KEY`: Secret key for API authentication

## Technical Details

### Technologies Used

- **Express.js**: Web server framework
- **pdf-parse**: Extract text from PDFs
- **mammoth**: Extract text from DOCX files
- **Tesseract.js**: OCR for scanned documents
- **sharp**: Image processing for OCR
- **axios**: HTTP client for downloading files

### Architecture

The service follows a modular architecture:
- `api/`: API routes for different endpoints
- `lib/`: Core functionality modules
  - `fileDownloader.js`: Downloads files from URLs
  - `pdfProcessor.js`: Extracts text from documents
  - `textCleaner.js`: Cleans and formats extracted text

## License

MIT # pdf-parse-node
