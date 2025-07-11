// src/app/chat/page.tsx
"use client"
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createUserContext, UserAnswer } from "@/utils/user-context";
import { createRagService } from "@/utils/rag-service";
import { forceReindexVectorStore, initializeVectorStore } from "@/utils/vector-store";
import { domains } from "@/app/constants/domain"; // Create this file or import from wherever your domains are defined

// Define message interface
interface Message {
  role: "user" | "assistant";
  content: string;
}

// Define quick action buttons
const quickActions = [
  { label: "Nutrition Advice", query: "What nutrition advice do you have for pregnancy?" },
  { label: "Preparing for Labor", query: "How should I prepare for labor?" },
  { label: "Sleep Tips", query: "What are some sleep tips during pregnancy?" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Preparing your personal assistant...");
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Name");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
        const storedUserName = localStorage.getItem("userName") || "Name";
        setUserName(storedUserName);
        
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
        
        // Skip initial welcome message to match the reference design
        // The welcome message will be shown in the UI directly
        
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

  // Handle reindexing the vector store
  useEffect(() => {
    async function updateVectorStore() {
      await forceReindexVectorStore();
      console.log("Vector store updated with scraped content!");
    }
    
    // Uncomment the line below when you want to update the vector store
     updateVectorStore();
  }, []);

  // Handle sending a message
  const handleSendMessage = async (message = inputMessage) => {
    if (!message.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage: Message = { role: "user", content: message.trim() };
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

  // Handle quick action button click
  const handleQuickAction = (query: string) => {
    setInputMessage(query);
    handleSendMessage(query);
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-pink-400 border-r-transparent align-[-0.125em]"></div>
          <p className="mt-4 text-lg text-gray-800">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center bg-red-100 rounded-full p-2 mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Unable to Start Chat</h2>
            <p className="text-gray-800 mb-6">{error}</p>
            <Link href="/" className="inline-block bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors">
              Return to Assessment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header - styled like the image */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center">
          <Link href="/" className="text-gray-700 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800 mx-auto">Ask Your Doula</h1>
          <div className="w-6">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
            </svg>
          </div>
        </div>
      </header>
      
      {/* Chat container - redesigned to match the image */}
      <div className="flex-1 overflow-hidden max-w-md mx-auto w-full flex flex-col bg-white">
        {/* If no messages yet, show welcome screen with avatar */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-24 h-24 rounded-full bg-pink-200 overflow-hidden mb-6">
              {/* Replace with your actual doula avatar image */}
              <div className="w-full h-full rounded-full bg-pink-300 flex items-center justify-center">
                {/* If you have an avatar image, use this instead */}
                {/* <Image 
                  src="/doula-avatar.jpg" 
                  alt="Digital Doula" 
                  width={96} 
                  height={96} 
                  className="object-cover"
                /> */}
                <span className="text-white text-xl">👩🏽</span>
              </div>
            </div>
            <div className="text-center">
              <p className="mb-2">
                <span className="text-lg">👋 Hi </span>
                <span className="text-pink-500 text-lg">{userName}!</span>
              </p>
              <h2 className="text-xl mb-2">I'm your Digital <span className="text-pink-500">Doula</span></h2>
              <p className="text-gray-600 mb-12">How can I assist you today?</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user' 
                      ? 'bg-pink-500 text-white' 
                      : 'bg-gray-100 text-black'
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
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-pink-500 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-pink-500 rounded-full animate-bounce delay-100"></div>
                    <div className="h-2 w-2 bg-pink-500 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Reference for scrolling to bottom */}
            <div ref={messagesEndRef}></div>
          </div>
        )}
        
        {/* Quick action buttons - added based on the image */}
        <div className="px-4 py-2 flex space-x-2 overflow-x-auto">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="px-4 py-2 bg-white text-pink-500 border border-pink-300 rounded-full whitespace-nowrap text-sm hover:bg-pink-50"
              onClick={() => handleQuickAction(action.query)}
            >
              {action.label}
            </button>
          ))}
        </div>
        
        {/* Input area - redesigned to match the image */}
        <div className="p-4">
          <div className="flex items-center bg-gray-100 rounded-full px-4 py-1">
            <textarea
              className="flex-1 bg-transparent border-none px-2 py-2 focus:outline-none resize-none text-gray-800 placeholder-gray-500"
              placeholder="Ask me anything..."
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isProcessing}
            />
            {inputMessage.trim() && (
              <button
                className={`ml-2 w-12 h-12 rounded-full ${
                  isProcessing
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-pink-500 hover:bg-pink-600'
                } flex items-center justify-center text-white`}
                onClick={() => handleSendMessage()}
                disabled={isProcessing}
              >
                <svg className="w-6 h-6 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
              </button>
            )}
            {!inputMessage.trim() && (
              <button
                className="ml-2 text-gray-500"
                disabled={isProcessing}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
              </button>
            )}
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