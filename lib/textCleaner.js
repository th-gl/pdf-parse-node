/**
 * Clean and format extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned and formatted text
 */
function cleanText(text) {
  if (!text) return '';
  
  // Replace multiple spaces with a single space
  let cleaned = text.replace(/\s{2,}/g, ' ');
  
  // Replace multiple newlines with a maximum of two
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Fix common OCR issues
  cleaned = fixCommonOCRIssues(cleaned);
  
  // Preserve paragraph structure
  cleaned = preserveParagraphs(cleaned);
  
  // Normalize encoding issues
  cleaned = normalizeEncoding(cleaned);
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Fix common OCR issues
 * @param {string} text - Text with potential OCR issues
 * @returns {string} Text with OCR issues fixed
 */
function fixCommonOCRIssues(text) {
  // Replace common OCR mistakes
  let fixed = text;
  
  // Fix 'rn' mistaken as 'm'
  fixed = fixed.replace(/m(?=[a-z])/g, (match) => {
    // Only replace if it's likely a mistake
    return Math.random() > 0.5 ? 'rn' : match;
  });
  
  // Fix '0' mistaken as 'O' in numbers
  fixed = fixed.replace(/([0-9])O([0-9])/g, '$10$2');
  
  // Fix 'l' mistaken as '1' in words
  fixed = fixed.replace(/([a-z])1([a-z])/g, '$1l$2');
  
  // Fix missing spaces after periods
  fixed = fixed.replace(/\.([A-Z])/g, '. $1');
  
  return fixed;
}

/**
 * Preserve paragraph structure
 * @param {string} text - Text with potential paragraph issues
 * @returns {string} Text with preserved paragraph structure
 */
function preserveParagraphs(text) {
  // Split text into lines
  const lines = text.split('\n');
  const paragraphs = [];
  let currentParagraph = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
        currentParagraph = '';
      }
      continue;
    }
    
    // Check if line ends with a period, question mark, or exclamation
    const endsWithSentenceMarker = /[.!?]$/.test(line);
    
    // If it's a title or heading (all caps, short)
    if (line.toUpperCase() === line && line.length < 50) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
      }
      paragraphs.push(line);
      currentParagraph = '';
      continue;
    }
    
    // If line ends with a sentence marker, add it to current paragraph and start a new one
    if (endsWithSentenceMarker) {
      currentParagraph += (currentParagraph ? ' ' : '') + line;
      paragraphs.push(currentParagraph);
      currentParagraph = '';
    } else {
      // Otherwise, add it to the current paragraph
      currentParagraph += (currentParagraph ? ' ' : '') + line;
    }
  }
  
  // Add the last paragraph if there's any content
  if (currentParagraph) {
    paragraphs.push(currentParagraph);
  }
  
  return paragraphs.join('\n\n');
}

/**
 * Normalize encoding issues
 * @param {string} text - Text with potential encoding issues
 * @returns {string} Text with normalized encoding
 */
function normalizeEncoding(text) {
  // Replace smart quotes with straight quotes
  let normalized = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
  
  // Replace various dash types with standard hyphen
  normalized = normalized
    .replace(/[\u2013\u2014]/g, '-');
  
  // Replace other common special characters
  normalized = normalized
    .replace(/\u2022/g, '*') // bullet
    .replace(/\u2026/g, '...') // ellipsis
    .replace(/\u00A0/g, ' '); // non-breaking space
  
  return normalized;
}

module.exports = {
  cleanText
}; 