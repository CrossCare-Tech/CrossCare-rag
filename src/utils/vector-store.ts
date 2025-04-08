// src/utils/vector-store-client.ts
import { TextChunk } from './document-processor';

/**
 * Initializes the vector store with chunks
 * @param forceReindex Whether to reindex even if data exists
 */
export async function initializeVectorStore(forceReindex: boolean = false): Promise<void> {
  console.log('Initializing vector store via API...');
  
  try {
    const response = await fetch('/api/vector-store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ forceReindex }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    console.log(data.message);
  } catch (error) {
    console.error('Error initializing vector store:', error);
    throw error;
  }
}

/**
 * Searches for chunks similar to the query text
 * @param query The search query
 * @param topK Number of results to return
 * @returns Array of relevant text chunks with similarity scores
 */
export async function findSimilarChunks(
  query: string,
  topK: number = 3
): Promise<(TextChunk & { score: number })[]> {
  console.log(`Searching for chunks similar to: "${query.substring(0, 50)}..."`);
  
  try {
    const response = await fetch(`/api/vector-store?query=${encodeURIComponent(query)}&topK=${topK}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error);
    }
    
    console.log(`Found ${data.results.length} relevant chunks`);
    return data.results;
  } catch (error) {
    console.error('Error searching vector store:', error);
    throw error;
  }
}