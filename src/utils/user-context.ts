/**
 * Interface for a single user answer with metadata
 */
export interface UserAnswer {
  domainName: string;
  questionText: string;
  answer: string;
  flag?: string;
}

/**
 * Stores a collection of user answers from the assessment
 * @param answers Array of user answers
 * @returns Object with methods to access and query user context
 */
export function createUserContext(initialAnswers: UserAnswer[] = []) {
  // Internal storage for answers
  const answers: UserAnswer[] = [...initialAnswers];
  
  // Add a single answer to the context
  function addAnswer(domainName: string, questionText: string, answer: string, flag?: string): void {
    answers.push({
      domainName,
      questionText,
      answer,
      flag
    });
    console.log(`Added answer about "${questionText.substring(0, 30)}..." to context`);
  }
  
  // Add multiple answers from the domain structure
  function addBulkAnswers(domainAnswers: Record<number, string[]>, domains: {name: string, questions: {text: string, flag: string}[]}[]): void {
    console.log("Adding bulk answers to context...");
    
    Object.entries(domainAnswers).forEach(([domainId, answerArray]) => {
      const domainIndex = parseInt(domainId) - 1; // Convert to zero-based index
      
      if (domainIndex >= 0 && domainIndex < domains.length) {
        const domain = domains[domainIndex];
        
        answerArray.forEach((answer, index) => {
          if (answer && domain.questions[index]) {
            addAnswer(
              domain.name,
              domain.questions[index].text,
              answer,
              domain.questions[index].flag
            );
          }
        });
      }
    });
    
    console.log(`Added ${answers.length} total answers to context`);
  }
  
  // Get a comprehensive user profile from all answers
  function getUserProfile(): string {
    console.log("Generating complete user profile...");
    
    if (answers.length === 0) {
      return "No user information available.";
    }
    
    // Group answers by domain
    const domainGroups: Record<string, UserAnswer[]> = {};
    
    answers.forEach(answer => {
      if (!domainGroups[answer.domainName]) {
        domainGroups[answer.domainName] = [];
      }
      domainGroups[answer.domainName].push(answer);
    });
    
    // Extract demographic information
    const demographicAnswers = answers.filter(answer => 
      answer.domainName.includes("Demographics") || 
      answer.questionText.includes("identify with") || 
      answer.questionText.includes("ethnicity") ||
      answer.questionText.includes("language")
    );
    
    // Extract flagged concerns
    const concerns = answers.filter(answer => answer.flag);
    
    // Create formatted profile
    let profile = "USER ASSESSMENT SUMMARY:\n\n";
    
    // Add demographic info if available
    if (demographicAnswers.length > 0) {
      profile += "Demographics:\n";
      demographicAnswers.forEach(answer => {
        profile += `- ${answer.questionText}: ${answer.answer}\n`;
      });
      profile += "\n";
    }
    
    // Add identified concerns
    if (concerns.length > 0) {
      profile += "Identified Concerns:\n";
      concerns.forEach(concern => {
        profile += `- ${concern.flag}: Based on response "${concern.answer}" to question "${concern.questionText}"\n`;
      });
      profile += "\n";
    }
    
    // Add domain-specific information
    profile += "Assessment Details by Domain:\n";
    Object.entries(domainGroups).forEach(([domain, domainAnswers]) => {
      profile += `\n${domain}:\n`;
      domainAnswers.forEach(answer => {
        profile += `- Question: ${answer.questionText}\n  Answer: ${answer.answer}\n`;
      });
    });
    
    return profile;
  }
  
  // Find answers relevant to a specific query
  function getRelevantContext(query: string): string {
    console.log(`Finding context relevant to: "${query.substring(0, 30)}..."`);
    
    if (answers.length === 0) {
      return "";
    }
    
    // Simple relevance scoring based on keyword matching
    // Extract meaningful terms from the query (remove common words)
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", 
      "about", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
      "do", "does", "did", "can", "could", "will", "would", "should", "may", "might",
      "must", "of", "by", "this", "that", "these", "those", "it", "its", "i", "my", "me",
      "you", "your", "we", "our", "us", "they", "their", "them"
    ]);
    
    const queryTerms = query.toLowerCase()
      .replace(/[.,?!;:()]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 3 && !stopWords.has(term));
    
    // Add health-specific terms that might be abbreviated in the query
    const healthTerms = new Set(queryTerms);
    
    // Map of common health concerns to related keywords
    const healthKeywords: Record<string, string[]> = {
      "pregnancy": ["pregnant", "baby", "birth", "trimester", "natal", "prenatal", "postnatal"],
      "housing": ["home", "apartment", "rent", "lease", "shelter", "homeless", "living"],
      "food": ["eat", "nutrition", "hungry", "meal", "diet", "grocery"],
      "transportation": ["car", "bus", "transit", "ride", "vehicle", "commute"],
      "safety": ["safe", "danger", "threat", "violence", "abuse", "harm"],
      "health": ["healthy", "medical", "doctor", "hospital", "clinic", "symptom", "condition"],
      "mental": ["anxiety", "depression", "stress", "emotional", "therapy", "counseling"],
      "education": ["school", "college", "university", "degree", "class", "course"],
      "employment": ["job", "work", "career", "salary", "wage", "income", "unemployment"],
      "childcare": ["child", "daycare", "babysit", "parent", "kid"]
    };
    
    // Expand query terms with related health keywords
    queryTerms.forEach(term => {
      Object.entries(healthKeywords).forEach(([category, keywords]) => {
        // If query contains a health category or any of its keywords, add all related terms
        if (term === category || keywords.includes(term)) {
          keywords.forEach(keyword => healthTerms.add(keyword));
          healthTerms.add(category);
        }
      });
    });
    
    // Score each answer for relevance
    const scoredAnswers = answers.map(answer => {
      const text = `${answer.questionText} ${answer.answer} ${answer.flag || ""}`.toLowerCase();
      let score = 0;
      
      // Count matching terms
      healthTerms.forEach(term => {
        if (text.includes(term)) {
          score++;
          
          // Bonus points for matches in flags (they're more important)
          if (answer.flag?.toLowerCase().includes(term)) {
            score += 2;
          }
        }
      });
      
      return { answer, score };
    });
    
    // Filter and sort by relevance
    const relevantAnswers = scoredAnswers
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Top 5 most relevant answers
      .map(item => item.answer);
    
    if (relevantAnswers.length === 0) {
      return "No directly relevant information found in your assessment.";
    }
    
    // Format the relevant context
    let context = "Based on your assessment, I know that:\n\n";
    
    relevantAnswers.forEach(answer => {
      context += `- When asked about ${answer.questionText}, you said: "${answer.answer}"\n`;
      if (answer.flag) {
        context += `  (This indicated: ${answer.flag})\n`;
      }
      context += "\n";
    });
    
    return context;
  }
  
  // Return the public interface
  return {
    addAnswer,
    addBulkAnswers,
    getUserProfile,
    getRelevantContext,
    // Allow direct access to answers for debugging
    getAllAnswers: () => [...answers]
  };
}

// Type for the object returned by createUserContext
export type UserContext = ReturnType<typeof createUserContext>;
