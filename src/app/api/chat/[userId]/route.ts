import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { createUserContext, UserAnswer } from '@/utils/user-context';
import { findSimilarChunksServer } from '@/utils/vector-store-server';

// Get environment variables
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX = process.env.PINECONE_INDEX || '';
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const EXTERNAL_BACKEND_URL = 'https://crosscare-rag-75bo.onrender.com/api';

// Initialize clients
const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Add this cache system at the top of your file
// Simple in-memory cache
interface CacheEntry {
  data: UserAnswer[];
  timestamp: number;
}

const userContextCache: Record<string, CacheEntry> = {};
const CACHE_EXPIRY_TIME = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

// Function to fetch user data with caching
async function fetchUserDataWithCache(userId: string): Promise<UserAnswer[]> {
  const currentTime = Date.now();
  
  // Check if we have a valid cache entry
  if (userContextCache[userId] && 
      (currentTime - userContextCache[userId].timestamp < CACHE_EXPIRY_TIME)) {
    console.log(`Using cached user context data for user ${userId}`);
    return userContextCache[userId].data;
  }
  
  // If no cache or expired, fetch from backend
  console.log(`Cache miss or expired for user ${userId}, fetching fresh data`);
  console.log(`Fetching user data from ${EXTERNAL_BACKEND_URL}/user/${userId}/responses`);
  
  const response = await axios.get(`${EXTERNAL_BACKEND_URL}/user/${userId}/responses`);
  
  // Check if we got valid data
  if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
    console.error('Invalid response format from user domain API:', response.data);
    throw new Error('Failed to fetch user domain data');
  }
  
  const domainData = response.data.data || [];
  console.log(`Retrieved ${domainData.length} domains from user's data`);
  
  // Convert the domain data to UserAnswer format
  const userAnswers: UserAnswer[] = [];
  
  domainData.forEach((domain: any) => {
    if (domain.questions && Array.isArray(domain.questions)) {
      domain.questions.forEach((question: any) => {
        userAnswers.push({
          domainName: `${domain.title}: ${domain.description}`,
          questionText: question.text,
          answer: question.response,
          flag: question.flag || undefined
        });
      });
    }
  });
  
  console.log(`Converted ${userAnswers.length} user answers for context`);
  
  // Update the cache
  userContextCache[userId] = {
    data: userAnswers,
    timestamp: currentTime
  };
  
  return userAnswers;
}


async function translateToLanguage(text: string, languageCode: string): Promise<string> {
  const languageMap: Record<string, string> = {
    en: "English",
    es: "Spanish",
    hi: "Hindi",
    ht: "Haitian Creole",
    pt: "Portuguese"
  };
  
  const targetLanguage = languageMap[languageCode] || "English";
  if (targetLanguage === "English") return text;

  const translationResult = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: `Translate the following text to ${targetLanguage}. Preserve all formatting, section titles, and bullet points.` },
      { role: "user", content: text }
    ],
    max_tokens: 1000
  });

  return translationResult.choices[0].message.content ?? text;
}


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const userId = (await params).userId
    const { query, conversationHistory, currentLanguage } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }
    
    if (!query) {
      return NextResponse.json({ 
        success: false, 
        error: 'Query is required' 
      }, { status: 400 });
    }
    
    console.log(`Processing RAG request for user ${userId} with query: "${query}"`);
    
    // Use the new function to fetch user data with caching
    let userAnswers: UserAnswer[];
    try {
      userAnswers = await fetchUserDataWithCache(userId);
    } catch (error) {
      console.error('Error fetching user data:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch user domain data' 
      }, { status: 500 });
    }
    
    // Step 3: Create user context with answers
    const userContext = createUserContext(userAnswers);
    
    // Rest of your code remains the same...
    // Step 4: Get the Pinecone index
    const index = pinecone.index(PINECONE_INDEX);
    
    // Step 5: Retrieve relevant documents from the knowledge base
    console.log(`Searching vector store for content relevant to: "${query}"`);
    const relevantDocs = await findSimilarChunksServer(query, 3, index, openai, EMBEDDING_MODEL);
    
    // Log source of retrieved docs for debugging
    // console.log("\n----- SOURCE TRACKING -----");
    // console.log(`Query: "${query}"`);
    // console.log("Retrieved chunks:");
    // relevantDocs.forEach((doc, index) => {
    //   console.log(`[${index + 1}] ID: ${doc.id}`);
    //   console.log(`    Type: ${doc.metadata?.type || 'unknown'}`);
    //   console.log(`    Source: ${doc.metadata?.source || 'unknown'}`);
    //   console.log(`    Section: ${doc.metadata?.section || 'unknown'}`);
    //   console.log(`    Score: ${doc.score}`);
    //   console.log(`    Text (first 70 chars): ${doc.text.substring(0, 70)}...`);
    // });
    // console.log("---------------------------\n");
    
    // Step 6: Format the retrieved knowledge
    const knowledgeContext = formatKnowledgeContext(relevantDocs);
    
    // Step 7: Get relevant user context
    console.log("Generating user profile and relevant context");
    const userProfile = userContext.getUserProfile();
    const relevantUserContext = userContext.getRelevantContext(query);
    
    // Step 8: Create the augmented prompt
    const systemPrompt = createAugmentedPrompt(
      query, 
      knowledgeContext, 
      userProfile, 
      relevantUserContext
    );
    
    // Step 9: Prepare messages array with system prompt and conversation history
    const messages: Array<{ role: "system" | "user" | "assistant", content: string }> = [
      { role: "system", content: systemPrompt }
    ];
    
    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Format the conversation history properly
      const formattedHistory = conversationHistory.map(msg => ({
        role: (msg.role === 'user' || msg.role === 'assistant') ? msg.role as "user" | "assistant" : 'user' as "user",
        content: msg.content
      }));
      
      messages.push(...formattedHistory);
      console.log(`Added ${formattedHistory.length} messages from conversation history`);
    }
    
    // Add the current query
    messages.push({ role: "user", content: query });
    
    // Step 10: Generate response using OpenAI
    console.log("Generating response with OpenAI");
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500 // Shorter responses for mobile
    });
    
    let responseContent = completion.choices[0].message.content || 
      "I'm sorry, I couldn't generate a response.";

      if (currentLanguage && currentLanguage !== "en") {
        responseContent = await translateToLanguage(responseContent, currentLanguage);
      }
      
    
    console.log(`Generated response (${responseContent.length} chars)`);
    
    return NextResponse.json({ 
      success: true, 
      response: responseContent,
      sourceInfo: {
        relevantDocCount: relevantDocs.length,
        topSources: relevantDocs.slice(0, 3).map(doc => ({
          id: doc.id,
          type: doc.metadata?.type || 'unknown',
          section: doc.metadata?.section || 'unknown',
          score: doc.score
        }))
      }
    });
  } catch (error: any) {
    console.error('Error generating chat response:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to generate response'
    }, { status: error.response?.status || 500 });
  }
}

// Format the retrieved documents into a knowledge context string
function formatKnowledgeContext(docs: any[]): string {
  if (docs.length === 0) {
    return "No relevant information found in the knowledge base.";
  }
  
  // Add headers to show section information and sort by score
  const formattedDocs = docs
    .sort((a, b) => b.score - a.score)
    .map((doc, index) => {
      // Clean up section title if present
      const sectionTitle = doc.metadata?.section
        ? doc.metadata.section.replace(/^\d+\.\s+/, '')
        : 'General Information';
      
      // Format based on document type
      if (doc.metadata?.type === 'qa') {
        return `INFORMATION ${index + 1} (${sectionTitle}):\n${doc.text}`;
      } else {
        return `INFORMATION ${index + 1} (${sectionTitle}):\n${doc.text}`;
      }
    })
    .join('\n\n');
  
  return formattedDocs;
}



// Create an augmented prompt combining knowledge and user context
function createAugmentedPrompt(
  query: string,
  knowledgeContext: string,
  userProfile: string,
  relevantUserContext: string
): string {
  // Analyze the query to determine if it's primarily about health, social needs, or both
  const healthTerms = ['pregnancy', 'symptom', 'health', 'pain', 'nausea', 'diet', 'exercise', 'sleep', 'medical', 'trimester', 'birth'];
  const socialTerms = ['housing', 'food', 'job', 'work', 'transportation', 'safety', 'education', 'money', 'financial', 'utility', 'utilities', 'childcare'];
  
  const queryLower = query.toLowerCase();
  const containsHealthTerms = healthTerms.some(term => queryLower.includes(term));
  const containsSocialTerms = socialTerms.some(term => queryLower.includes(term));
  
  let promptFocus = 'balanced';
  if (containsHealthTerms && !containsSocialTerms) {
    promptFocus = 'health';
  } else if (containsSocialTerms && !containsHealthTerms) {
    promptFocus = 'social';
  }
  
  // Create different prompt structures based on the focus
  let prompt = `You are a compassionate and knowledgeable assistant that specializes in health and social services information.

USER ASSESSMENT SUMMARY:
${userProfile}

`;

  if (promptFocus === 'health' || promptFocus === 'balanced') {
    prompt += `
RELEVANT HEALTH KNOWLEDGE:
${knowledgeContext}
`;
  }

  if (promptFocus === 'social' || promptFocus === 'balanced') {
    prompt += `
RELEVANT PERSONAL CONTEXT:
${relevantUserContext}
`;
  }

  prompt += `
YOUR TASK:
1. Provide a concise, helpful response to the user's question: "${query}"
2. Keep your answer brief and direct - aim for 3-5 sentences maximum
3. Base your response on the provided knowledge and user context
4. If addressing a health concern, include relevant guidance from the knowledge base
5. If addressing a social need, consider the user's specific situation from their assessment
6. Be empathetic and supportive, especially regarding any identified concerns
7. If you don't have enough information, acknowledge limitations and provide general guidance
8. Format your response in a clear, organized way, divide the response into 2-3 short but accurate paragraphs and give title to each paragraph, but only do this if required, if the answer is very long

Remember, the user prefers short, to-the-point answers that address their specific question.
`;

  return prompt;
}