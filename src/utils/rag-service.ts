// src/utils/rag-service.ts
import { OpenAI } from 'openai';
import { findSimilarChunks } from './vector-store';
import { UserContext } from './user-context';

// Initialize OpenAI client
let openaiInstance: OpenAI | null = null;

/**
 * Gets or initializes the OpenAI instance
 */
function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true, // Note: In production, make API calls server-side
    });
  }
  return openaiInstance;
}

/**
 * Creates a RAG service that combines vector search with user context
 * @param userContext The user context manager
 * @returns Functions to generate responses using RAG
 */
export function createRagService(userContext: UserContext) {
  const openai = getOpenAI();
  
  /**
   * Generates a response using RAG (Retrieval-Augmented Generation)
   * @param query The user's question
   * @returns A response based on both knowledge base and user context
   */
  async function generateResponse(query: string): Promise<string> {
    console.log(`Generating RAG response for: "${query.substring(0, 50)}..."`);
    
    try {
      // 1. Retrieve relevant documents from the knowledge base
      const relevantDocs = await findSimilarChunks(query, 3);
      
      // 2. Format the retrieved knowledge
      const knowledgeContext = formatKnowledgeContext(relevantDocs);
      
      // 3. Get relevant user context
      const userProfile = userContext.getUserProfile();
      const relevantUserContext = userContext.getRelevantContext(query);
      
      // 4. Create the augmented prompt
      const prompt = createAugmentedPrompt(query, knowledgeContext, userProfile, relevantUserContext);
      
      // 5. Generate response using OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: query }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("Error generating RAG response:", error);
      return "I'm sorry, I encountered an error while processing your question. Please try again.";
    }
  }
  
  /**
   * Formats the retrieved documents into a knowledge context string
   * @param docs The retrieved documents with similarity scores
   * @returns Formatted knowledge context
   */
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
  
  /**
   * Creates an augmented prompt combining knowledge and user context
   * @param query User's question
   * @param knowledgeContext Retrieved information from knowledge base
   * @param userProfile Complete user profile
   * @param relevantUserContext User context relevant to the query
   * @returns Augmented prompt for the LLM
   */
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
1. Provide a helpful, accurate response to the user's question: "${query}"
2. Base your response on the provided knowledge and user context
3. If addressing a health concern, include relevant guidance from the knowledge base
4. If addressing a social need, consider the user's specific situation from their assessment
5. Be empathetic and supportive, especially regarding any identified concerns
6. If you don't have enough information, acknowledge limitations and provide general guidance
7. Format your response in a clear, organized way with appropriate paragraphs

Remember, this person may be dealing with significant health and social challenges. Your response should be both informative and compassionate.
`;

    return prompt;
  }
  
  /**
   * Generates a response with conversation history
   * @param messages Array of previous messages in the conversation
   * @param query The user's latest question
   * @returns A response based on knowledge base, user context, and conversation history
   */
  async function generateConversationalResponse(
    messages: {role: 'user' | 'assistant', content: string}[],
    query: string
  ): Promise<string> {
    try {
      // 1. Retrieve relevant documents from the knowledge base
      const relevantDocs = await findSimilarChunks(query, 3);
      
      // 2. Format the retrieved knowledge
      const knowledgeContext = formatKnowledgeContext(relevantDocs);
      
      // 3. Get relevant user context
      const userProfile = userContext.getUserProfile();
      const relevantUserContext = userContext.getRelevantContext(query);
      
      // 4. Create the system prompt
      const systemPrompt = createAugmentedPrompt(
        query, 
        knowledgeContext, 
        userProfile, 
        relevantUserContext
      );
      
      // 5. Prepare messages array with system prompt and conversation history
      const openaiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages,
        { role: "user" as const, content: query }
      ];
      
      // 6. Generate response using OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1000
      });
      
      return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("Error generating conversational RAG response:", error);
      return "I'm sorry, I encountered an error while processing your question. Please try again.";
    }
  }
  
  // Return the public interface
  return {
    generateResponse,
    generateConversationalResponse,
  };
}

// Type for the object returned by createRagService
export type RagService = ReturnType<typeof createRagService>;