import { systemPrompts } from "../app/constants/systemPrompts";

// Define TypeScript interfaces for our data
export interface TextChunk {
  id: string;
  text: string;
  metadata?: {
    section?: string;
    type?: string;
    question?: string;
    index?: number;
    [key: string]: string | number | undefined;
  };
}

/**
 * Processes the system prompts text into smaller, searchable chunks
 * @returns An array of text chunks with metadata
 */
export function processSystemPrompts(): TextChunk[] {
  console.log("Processing system prompts into chunks...");
  
  // 1. Split the text by sections (using numbered headings as delimiters)
  const sectionDelimiter = /\d+\.\s+[A-Za-z\s&]+\n/g;
  const sectionMatches = [...systemPrompts.matchAll(sectionDelimiter)];
  const sectionTitles = sectionMatches.map(match => match[0].trim());
  
  // 2. Get the start indices of each section
  const sectionIndices = sectionMatches.map(match => match.index);
  
  // 3. Extract each section's content
  const chunks: TextChunk[] = [];
  let chunkIdCounter = 0;
  
  // Process each section
  for (let i = 0; i < sectionTitles.length; i++) {
    const sectionTitle = sectionTitles[i];
    const startIndex = sectionIndices[i];
    const endIndex = (i < sectionTitles.length - 1) ? sectionIndices[i + 1] : systemPrompts.length;
    
    if (startIndex === undefined) continue;
    
    const sectionContent = systemPrompts.substring(startIndex! + sectionTitle.length, endIndex).trim();
    
    // Check if section contains Q&A format
    if (sectionContent.includes("Q:") && sectionContent.includes("A:")) {
      // Process as Q&A pairs
      const qaPattern = /Q:([^Q]+?)A:([^Q]+?)(?=Q:|$)/gs;
      let qaMatch;
      let qaIndex = 0;
      
      while ((qaMatch = qaPattern.exec(sectionContent)) !== null) {
        const question = qaMatch[1].trim();
        const answer = qaMatch[2].trim();
        
        chunks.push({
          id: `chunk_${chunkIdCounter++}`,
          text: `Question: ${question}\nAnswer: ${answer}`,
          metadata: {
            section: sectionTitle,
            type: "qa",
            question: question,
            index: qaIndex++
          }
        });
      }
    } else {
      // Split section by paragraphs or sub-sections
      const paragraphs = sectionContent.split(/\n\n+/);
      
      paragraphs.forEach((paragraph, paragraphIndex) => {
        if (paragraph.trim().length > 0) {
          chunks.push({
            id: `chunk_${chunkIdCounter++}`,
            text: paragraph.trim(),
            metadata: {
              section: sectionTitle,
              type: "paragraph",
              index: paragraphIndex
            }
          });
        }
      });
    }
  }
  
  console.log(`Created ${chunks.length} chunks from system prompts`);
  return chunks;
}

/**
 * Processes scraped content into searchable chunks
 * @param scrapedDocuments Array of scraped documents with title and paragraphs
 * @returns An array of text chunks with metadata
 */
export function processScrapedDocuments(scrapedDocuments: Array<{
  title: string;
  paragraphs: string[];
  source?: string;
}>): TextChunk[] {
  console.log(`Processing ${scrapedDocuments.length} scraped documents into chunks...`);
  
  const chunks: TextChunk[] = [];
  let chunkIdCounter = 1000; // Start IDs at 1000 to differentiate from system prompts
  
  // Process each scraped document
  scrapedDocuments.forEach((document, docIndex) => {
    // Create a source identifier based on title or provided source
    const source = document.source || document.title.replace(/\s+/g, '_').substring(0, 30);
    
    // Combine related paragraphs to create meaningful chunks
    let currentText = '';
    let paragraphIndex = 0;
    
    for (const paragraph of document.paragraphs) {
      // Skip very short paragraphs or navigation elements
      if (paragraph.trim().length < 5) continue;
      
      // If adding this paragraph would make the chunk too large, save current chunk and start a new one
      if (currentText.length + paragraph.length > 1000 && currentText.length > 0) {
        chunks.push({
          id: `scraped_${docIndex}_${chunkIdCounter++}`,
          text: currentText.trim(),
          metadata: {
            title: document.title,
            source: source,
            type: "scraped_content",
            section: document.title,
            index: paragraphIndex++
          }
        });
        
        currentText = '';
      }
      
      // Add paragraph to current chunk
      currentText += paragraph + '\n\n';
    }
    
    // Add the final chunk if there's text remaining
    if (currentText.trim().length > 0) {
      chunks.push({
        id: `scraped_${docIndex}_${chunkIdCounter++}`,
        text: currentText.trim(),
        metadata: {
          title: document.title,
          source: source,
          type: "scraped_content",
          section: document.title,
          index: paragraphIndex
        }
      });
    }
  });
  
  console.log(`Created ${chunks.length} chunks from ${scrapedDocuments.length} scraped documents`);
  return chunks;
}

/**
 * 
 * Utility function to help us debug the chunks during development
 * @param chunks The array of text chunks to display
 */
export function displayChunks(chunks: TextChunk[]) {
  console.log("\n=== CHUNKS PREVIEW ===");
  chunks.slice(0, 3).forEach((chunk, i) => {
    console.log(`\nChunk ${i + 1} (${chunk.id}):`);
    console.log(`Section: ${chunk.metadata?.section}`);
    console.log(`Type: ${chunk.metadata?.type}`);
    console.log("First 100 chars: " + chunk.text.substring(0, 100) + "...");
  });
  console.log(`\n... and ${chunks.length - 3} more chunks\n`);
}