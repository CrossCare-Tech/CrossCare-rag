// src/app/api/vector-store/route.ts
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { processSystemPrompts } from '@/utils/document-processor';
import { processScrapedDocuments } from '@/utils/document-processor';
import { scrapedContent } from '@/app/constants/scraped-content';

// Get environment variables (server-side)
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX = process.env.PINECONE_INDEX || '';
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Initialize clients
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Get the Pinecone index
const index = pinecone.index(PINECONE_INDEX);

// API endpoint for initializing the vector store
export async function POST(request: NextRequest) {
  try {
    const { forceReindex } = await request.json();
    
    // Check if the index already has vectors
    const stats = await index.describeIndexStats();
    const vectorCount = stats.totalRecordCount;
    
    console.log(`Vector store contains ${vectorCount} vectors`);
    
    if (vectorCount === 0 || forceReindex) {
      console.log('Populating vector store with chunks...');
      
      // Get chunks from the knowledge base
      const systemChunks = processSystemPrompts();
      console.log(`Created ${systemChunks.length} chunks from system prompts`);
      
      // Get chunks from scraped content - IMPORTANT!
      const scrapedChunks = processScrapedDocuments(scrapedContent);
      console.log(`Created ${scrapedChunks.length} chunks from scraped content`);
      
      // Combine all chunks
      const allChunks = [...systemChunks, ...scrapedChunks];
      console.log(`Total chunks to process: ${allChunks.length}`);
      
      // Extract texts for embedding creation
      const texts = allChunks.map(chunk => chunk.text);
      
      // Create embeddings in batches
      const batchSize = 25;
      const embeddings: number[][] = [];
      
      // Process in batches to avoid rate limits
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        console.log(`Creating embeddings for batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(texts.length/batchSize)}`);
        
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
        });
        
        // Extract embeddings
        const batchEmbeddings = response.data.map(item => item.embedding);
        embeddings.push(...batchEmbeddings);
        
        // Respect API rate limits
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Prepare vectors for Pinecone
      const vectors = allChunks.map((chunk, i) => ({
        id: chunk.id,
        values: embeddings[i],
        metadata: {
          text: chunk.text,
          ...chunk.metadata
        }
      }));
      
      // Clear existing vectors first (optional)
      // await index.deleteAll();
      
      // Store vectors in batches
      const upsertBatchSize = 100;
      
      for (let i = 0; i < vectors.length; i += upsertBatchSize) {
        const batch = vectors.slice(i, i + upsertBatchSize);
        console.log(`Upserting batch ${Math.floor(i/upsertBatchSize) + 1} of ${Math.ceil(vectors.length/upsertBatchSize)}`);
        await index.upsert(batch);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully stored ${allChunks.length} chunks in Pinecone (${systemChunks.length} system, ${scrapedChunks.length} scraped)`
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: 'Vector store already contains data, skipping initialization'
      });
    }
  } catch (error) {
    console.error('Error initializing vector store:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

// API endpoint for searching similar chunks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const topK = parseInt(searchParams.get('topK') || '3');
    
    if (!query) {
      return NextResponse.json({ 
        success: false, 
        error: 'Query parameter is required' 
      }, { status: 400 });
    }
    
    // Create embedding for the query
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
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
    const matchedChunks = results.matches.map(match => ({
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
    
    return NextResponse.json({ 
      success: true, 
      results: matchedChunks 
    });
  } catch (error) {
    console.error('Error searching vector store:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}