// src/utils/vector-store-server.ts
import { OpenAI } from 'openai';
import { TextChunk } from './document-processor';

/**
 * Searches for chunks similar to the query text (server-side)
 * @param query The search query
 * @param topK Number of results to return
 * @param index The Pinecone index instance
 * @param openai The OpenAI instance
 * @param embeddingModel The embedding model to use
 * @returns Array of relevant text chunks with similarity scores
 */
export async function findSimilarChunksServer(
  query: string,
  topK: number = 3,
  index: any,
  openai: OpenAI,
  embeddingModel: string
): Promise<(TextChunk & { score: number })[]> {
  console.log(`Searching for chunks similar to: "${query.substring(0, 50)}..."`);
  
  try {
    // Create embedding for the query
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: [query],
    });
    
    const queryEmbedding = response.data[0].embedding;
    
    // Search Pinecone
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });
    
    // Format results
    const matchedChunks = results.matches.map((match: any) => ({
      id: match.id,
      text: match.metadata?.text,
      metadata: {
        section: match.metadata?.section,
        type: match.metadata?.type,
        question: match.metadata?.question,
        index: match.metadata?.index,
      },
      score: match.score
    }));
    
    console.log(`Found ${matchedChunks.length} relevant chunks`);
    return matchedChunks;
  } catch (error) {
    console.error('Error searching vector store:', error);
    throw error;
  }
}