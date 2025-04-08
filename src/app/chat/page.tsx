// src/app/chat/page.tsx
"use client"
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createUserContext, UserAnswer } from "@/utils/user-context";
import { createRagService } from "@/utils/rag-service";
import { initializeVectorStore } from "@/utils/vector-store";
import { domains } from "@/app/constants/domain"; // Create this file or import from wherever your domains are defined

// Define message interface
interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Preparing your personal assistant...");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize the chat with RAG system
  useEffect(() => {
    async function initializeChat() {
      try {
        // Step 1: Initialize vector store (this should already be done, but check just in case)
        setLoadingMessage("Connecting to knowledge base...");
        await initializeVectorStore();
        
        // Step 2: Get user answers from localStorage
        setLoadingMessage("Loading your assessment data...");
        const domainAnswers = JSON.parse(localStorage.getItem("domainAnswers") || "{}");
        const domainFlags = JSON.parse(localStorage.getItem("domainFlags") || "{}");
        
        // Step 3: Convert assessment answers to format needed for user context
        const userAnswers: UserAnswer[] = [];
        
        Object.entries(domainAnswers).forEach(([domainId, answers]) => {
          const domainIndex = parseInt(domainId) - 1;
          if (domainIndex >= 0 && domainIndex < domains.length) {
            const domain = domains[domainIndex];
            
            (answers as string[]).forEach((answer, index) => {
              if (answer && domain.questions[index]) {
                const question = domain.questions[index];
                // Check if this answer triggered a flag
                const wasAnswerFlagged = domainFlags[domainId]?.includes(question.flag);
                
                userAnswers.push({
                  domainName: domain.name,
                  questionText: question.text,
                  answer: answer,
                  flag: wasAnswerFlagged ? question.flag : undefined
                });
              }
            });
          }
        });
        
        // If no answers found, show error
        if (userAnswers.length === 0) {
          setError("No assessment data found. Please complete at least one assessment domain before using the chat.");
          setIsInitializing(false);
          return;
        }
        
        // Step 4: Create user context with answers
        setLoadingMessage("Processing your assessment responses...");
        const userContext = createUserContext(userAnswers);
        
        // Step 5: Create RAG service
        setLoadingMessage("Setting up your personal assistant...");
        
        // Create RAG service and store in window for reuse
        window.ragService = createRagService(userContext);
        
        
        // Identify main concerns to personalize welcome message
        const concernCount = userAnswers.filter(a => a.flag).length;
        let welcomeMessage = "Hello! I'm your personal health assistant based on your assessment. ";
        
        if (concernCount > 0) {
          welcomeMessage += `I see you have ${concernCount} identified concerns that we can discuss. `;
        }
        
        welcomeMessage += "You can ask me about pregnancy health information or questions related to your assessment responses. How can I help you today?";
        
        setMessages([{
          role: "assistant",
          content: welcomeMessage
        }]);
        
        // Initialization complete
        setIsInitializing(false);
      } catch (error) {
        console.error("Error initializing chat:", error);
        setError("There was an error setting up the chat. Please try again later.");
        setIsInitializing(false);
      }
    }
    
    initializeChat();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage: Message = { role: "user", content: inputMessage.trim() };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and set processing state
    setInputMessage("");
    setIsProcessing(true);
    
    try {
      // Get stored RAG service
      const ragService = window.ragService;
      
      if (!ragService) {
        throw new Error("RAG service not initialized");
      }
      
      // Get previous messages for context (limit to last 6 for performance)
      const conversationHistory = messages
        .slice(-6)
        .map(msg => ({ role: msg.role, content: msg.content }));
      
      // Generate response
      const response = await ragService.generateConversationalResponse(
        conversationHistory,
        userMessage.content
      );
      
      // Add assistant message to chat
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      console.error("Error generating response:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your question. Please try again."
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading screen
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]"></div>
          <p className="mt-4 text-lg text-gray-800">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center bg-red-100 rounded-full p-2 mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Unable to Start Chat</h2>
            <p className="text-gray-800 mb-6">{error}</p>
            <Link href="/" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Return to Assessment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Health & Social Needs Assistant</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Return to Assessment
          </Link>
        </div>
      </header>
      
      {/* Chat container */}
      <div className="flex-1 overflow-hidden max-w-4xl w-full mx-auto px-4 flex flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-4">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white shadow-md border border-gray-200 text-black'
                }`}
              >
                {message.content.split('\n').map((text, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{text}</p>
                ))}
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isProcessing && (
            <div className="flex justify-start mb-4">
              <div className="bg-white shadow-md border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Reference for scrolling to bottom */}
          <div ref={messagesEndRef}></div>
        </div>
        
        {/* Input area */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex">
            <textarea
              className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              placeholder="Type your question here..."
              rows={2}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isProcessing}
            />
            <button
              className={`px-4 py-2 rounded-r-lg ${
                isProcessing || !inputMessage.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              onClick={handleSendMessage}
              disabled={isProcessing || !inputMessage.trim()}
            >
              Send
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>Press Shift+Enter for a new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add type declaration for window to allow storing ragService
declare global {
  interface Window {
    ragService: ReturnType<typeof createRagService>;
  }
}