"use client"
import { useState } from "react";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, it's better to use server-side API calls
});

// Define all domains and their questions
const domains = [
  {
    id: 1,
    name: "Housing & Basic Needs",
    questions: [
      {
        id: 1,
        text: "What is your current housing situation?",
        flag: "Housing instability / temporary housing",
        sampleResponse: "I live with friends, but it's temporary."
      },
      {
        id: 2,
        text: "Are you worried about losing your housing in the near future?",
        flag: "Housing insecurity",
        sampleResponse: "Yes, definitely."
      },
      {
        id: 3,
        text: "Have any utility companies threatened to shut off your services?",
        flag: "Utilities support needed",
        sampleResponse: "Yes, twice last winter."
      },
      {
        id: 4,
        text: "Any trouble getting to medical appointments or work due to transportation?",
        flag: "Transportation barrier",
        sampleResponse: "Yes, I missed two appointments last month."
      },
      {
        id: 5,
        text: "Do you feel safe where you live?",
        flag: "Home safety concern",
        sampleResponse: "Not really, there's been break-ins nearby."
      },
      {
        id: 6,
        text: "Any concerns about your neighborhood's safety?",
        flag: "Neighborhood safety concern",
        sampleResponse: "Yes, it is not well lit and I dont feel comfortable walking at night."
      }
    ]
  },
  {
    id: 2,
    name: "Personal Safety & Demographics",
    questions: [
      {
        id: 1,
        text: "What race or ethnicity do you identify with?",
        flag: "Demographics",
        sampleResponse: "Black and Native American."
      },
      {
        id: 2,
        text: "Are you Hispanic or Latino?",
        flag: "Demographics",
        sampleResponse: "No."
      },
      {
        id: 3,
        text: "Have you been hurt or threatened by someone in the past year?",
        flag: "Interpersonal violence",
        sampleResponse: "Yes, by a former partner."
      },
      {
        id: 4,
        text: "Have you felt afraid of your current or past partner?",
        flag: "Urgent safety referral",
        sampleResponse: "Yes."
      },
      {
        id: 5,
        text: "Has anyone taken money from you or withheld it unfairly?",
        flag: "Financial abuse",
        sampleResponse: "Yes, my brother borrowed money and never paid me back."
      }
    ]
  },
  {
    id: 3,
    name: "Education & Employment",
    questions: [
      {
        id: 1,
        text: "What is the highest level of education you've completed?",
        flag: "Education status",
        sampleResponse: "Some high school."
      },
      {
        id: 2,
        text: "What is your current work status?",
        flag: "Employment support needed",
        sampleResponse: "Unemployed."
      },
      {
        id: 3,
        text: "Is it hard to afford basic needs?",
        flag: "Financial strain",
        sampleResponse: "Yes, very hard."
      },
      {
        id: 4,
        text: "Would you like help finding a job?",
        flag: "Referral to workforce navigator",
        sampleResponse: "Yes."
      },
      {
        id: 5,
        text: "Interested in help with school or job training?",
        flag: "Education support",
        sampleResponse: "Yes, I'd love that."
      },
      {
        id: 6,
        text: "Do you need better daycare?",
        flag: "Childcare need",
        sampleResponse: "Yes, my childcare falls through often."
      }
    ]
  },
  {
    id: 4,
    name: "Food & Physical Activity",
    questions: [
      {
        id: 1,
        text: "Have you worried about running out of food?",
        flag: "Food insecurity",
        sampleResponse: "Yes, often."
      },
      {
        id: 2,
        text: "Did the food you bought ever not last?",
        flag: "Food insecurity",
        sampleResponse: "Yes."
      },
      {
        id: 3,
        text: "Can you get enough healthy food?",
        flag: "Healthy food access",
        sampleResponse: "Not really, healthy food is expensive."
      },
      {
        id: 4,
        text: "How often do you exercise per week?",
        flag: "Physical activity support",
        sampleResponse: "One or two days."
      }
    ]
  },
  {
    id: 5,
    name: "Environmental Factors",
    questions: [
      {
        id: 1,
        text: "Do you have any issues in your home—like mold, pests, or no heat?",
        flag: "Environmental hazard, refer to housing services",
        sampleResponse: "Yes, mold and broken heater."
      }
    ]
  },
  {
    id: 6,
    name: "Language & Communication",
    questions: [
      {
        id: 1,
        text: "What language are you most comfortable speaking?",
        flag: "Language preference",
        sampleResponse: "Spanish."
      },
      {
        id: 2,
        text: "Do you often need help reading medical materials?",
        flag: "Health literacy / translation support",
        sampleResponse: "Sometimes, especially forms."
      }
    ]
  }
];

export default function Home() {
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [domainAnswers, setDomainAnswers] = useState<Record<number, string[]>>({});
  const [domainFlags, setDomainFlags] = useState<Record<number, string[]>>({});
  const [domainAnalysisResults, setDomainAnalysisResults] = useState<
    Record<number, {flag: string, reasoning: string, confidencePercentage: number}[]>
  >({});
  const [userInput, setUserInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [currentlyViewingDomain, setCurrentlyViewingDomain] = useState<number | null>(null);

  const currentDomain = domains[currentDomainIndex];
  const currentQuestion = currentDomain?.questions[currentQuestionIndex];
  
  const analyzeWithAI = async (question: string, answer: string, possibleFlag: string) => {
    try {
      const prompt = `
      You are an AI assistant helping to analyze responses to a social needs assessment.
      
      QUESTION: "${question}"
      USER RESPONSE: "${answer}"
      POSSIBLE FLAG: "${possibleFlag}"
      
      Based on the response, should this be flagged as "${possibleFlag}"? 
      Consider the context, tone, and content of the response.
      
      Respond in JSON format with three fields:
      - shouldFlag (boolean): Whether this response indicates a concern that should be flagged
      - reasoning (string): A brief explanation of your decision
      - confidencePercentage (number): Your confidence in this assessment as a percentage (0-100)
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant analyzing social needs assessment responses." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        shouldFlag: result.shouldFlag,
        reasoning: result.reasoning,
        confidencePercentage: result.confidencePercentage || 70, // Default if not provided
        flag: possibleFlag
      };
    } catch (error) {
      console.error("Error analyzing with AI:", error);
      // Fallback to simple keyword analysis if OpenAI call fails
      const answer = userInput.toLowerCase();
      const flagWords = ["yes", "not", "trouble", "worried", "temporary", "miss", "concern", "problem", "difficult", "stress"];
      let shouldFlag = false;
      
      for (const word of flagWords) {
        if (answer.includes(word)) {
          shouldFlag = true;
          break;
        }
      }
      
      return {
        shouldFlag,
        reasoning: "Analysis based on keyword detection (OpenAI API unavailable).",
        confidencePercentage: 50, // Lower confidence for fallback method
        flag: possibleFlag
      };
    }
  };

  const handleNextQuestion = async () => {
    if (userInput.trim() === "") return;
    
    // Save user answer for current domain
    const domainId = currentDomain.id;
    const newDomainAnswers = { ...domainAnswers };
    if (!newDomainAnswers[domainId]) {
      newDomainAnswers[domainId] = [];
    }
    newDomainAnswers[domainId][currentQuestionIndex] = userInput;
    setDomainAnswers(newDomainAnswers);
    
    // Show loading state
    setIsAnalyzing(true);
    
    // Analyze with OpenAI
    const analysisResult = await analyzeWithAI(
      currentQuestion.text, 
      userInput, 
      currentQuestion.flag
    );
    
    // Update flags based on AI analysis
    if (analysisResult.shouldFlag) {
      const newDomainFlags = { ...domainFlags };
      if (!newDomainFlags[domainId]) {
        newDomainFlags[domainId] = [];
      }
      newDomainFlags[domainId].push(currentQuestion.flag);
      setDomainFlags(newDomainFlags);
      
      const newDomainAnalysisResults = { ...domainAnalysisResults };
      if (!newDomainAnalysisResults[domainId]) {
        newDomainAnalysisResults[domainId] = [];
      }
      newDomainAnalysisResults[domainId].push({
        flag: currentQuestion.flag,
        reasoning: analysisResult.reasoning,
        confidencePercentage: analysisResult.confidencePercentage
      });
      setDomainAnalysisResults(newDomainAnalysisResults);
    }
    
    // Hide loading state
    setIsAnalyzing(false);
    
    // Move to next question in current domain or next domain
    if (currentQuestionIndex < currentDomain.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserInput("");
    } else {
      // Show domain completion view
      setCurrentlyViewingDomain(domainId);
      setUserInput("");
    }
  };

  const handleNextDomain = () => {
    if (currentDomainIndex < domains.length - 1) {
      setCurrentDomainIndex(currentDomainIndex + 1);
      setCurrentQuestionIndex(0);
      setCurrentlyViewingDomain(null);
    } else {
      setAssessmentCompleted(true);
    }
  };

  const resetAssessment = () => {
    setCurrentDomainIndex(0);
    setCurrentQuestionIndex(0);
    setDomainAnswers({});
    setDomainFlags({});
    setDomainAnalysisResults({});
    setUserInput("");
    setAssessmentCompleted(false);
    setCurrentlyViewingDomain(null);
  };

  // Domain result component to show results for a specific domain
  const DomainResult = ({ domainId }: { domainId: number }) => {
    const domain = domains.find(d => d.id === domainId);
    const flags = domainFlags[domainId] || [];
    const analysisResults = domainAnalysisResults[domainId] || [];
    const answers = domainAnswers[domainId] || [];
    
    if (!domain) return null;
    
    return (
      <div className="bg-red-100 p-4 rounded-lg mt-4">
        <h2 className="text-xl font-bold mb-4 text-blue-600">{domain.name} Results</h2>
        <h3 className="font-semibold mb-2 text-blue-600">Identified Concerns:</h3>
        {flags.length > 0 ? (
          <ul className="list-disc pl-5 mb-4">
            {analysisResults.map((result, index) => (
              <li key={index} className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-blue-600">{result.flag}</div>
                  <div className="ml-2 text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded-full">
                    {result.confidencePercentage}% confidence
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${result.confidencePercentage}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600 mt-2">{result.reasoning}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-black">No immediate concerns identified in this domain.</p>
        )}
        <h3 className="font-semibold text-blue-600 mb-2">Your Responses:</h3>
        <ul className="mb-4">
          {domain.questions.map((question, index) => (
            <li key={index} className="mb-2">
              <span className="font-medium text-blue-600">{question.text}</span>
              <p className="pl-4 border-l-2 text-black border-gray-300 mt-1">
                {answers[index] || "No answer provided"}
              </p>
            </li>
          ))}
        </ul>
        {currentDomainIndex < domains.length - 1 ? (
          <button
            onClick={handleNextDomain}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue to Next Domain
          </button>
        ) : (
          <button
            onClick={() => setAssessmentCompleted(true)}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Complete Assessment
          </button>
        )}
      </div>
    );
  };

  // Final assessment summary component
  const AssessmentSummary = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Complete Assessment Summary</h1>
        {domains.map(domain => {
          const flags = domainFlags[domain.id] || [];
          const analysisResults = domainAnalysisResults[domain.id] || [];
          
          return (
            <div key={domain.id} className="mb-8 bg-red-100 p-4 rounded-lg">
              <h2 className="text-xl font-bold mb-2 text-blue-600">{domain.name}</h2>
              {flags.length > 0 ? (
                <>
                  <h3 className="font-semibold text-blue-600 mb-2">Identified Concerns:</h3>
                  <ul className="list-disc pl-5 mb-4">
                    {analysisResults.map((result, index) => (
                      <li key={index} className="mb-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-blue-600">{result.flag}</div>
                          <div className="ml-2 text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded-full">
                            {result.confidencePercentage}% confidence
                          </div>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${result.confidencePercentage}%` }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-600 mt-2">{result.reasoning}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mb-4 text-black">No concerns identified in this domain.</p>
              )}
            </div>
          );
        })}
        <button
          onClick={resetAssessment}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start New Assessment
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="max-w-md w-full mx-auto">
        {assessmentCompleted ? (
          <AssessmentSummary />
        ) : currentlyViewingDomain !== null ? (
          <DomainResult domainId={currentlyViewingDomain} />
        ) : (
          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="mb-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-blue-600">{currentDomain.name}</h1>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                Domain {currentDomainIndex + 1}/{domains.length}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${(currentQuestionIndex / currentDomain.questions.length) * 100}%` }}
              ></div>
            </div>
            
            <div className="bg-red-100 p-4 rounded-lg mb-4">
              <p className="font-medium text-blue-600">
                Question {currentQuestionIndex + 1}/{currentDomain.questions.length}: {currentQuestion.text}
              </p>
            </div>
            
            <div className="mb-4">
              <textarea
                className="w-full text-black p-3 border rounded-lg"
                rows={3}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your answer here..."
              />
            </div>
            
            <button
              onClick={handleNextQuestion}
              disabled={isAnalyzing}
              className={`w-full bg-blue-600 text-white py-2 rounded-lg transition-colors ${
                isAnalyzing ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              {isAnalyzing 
                ? "Analyzing response..." 
                : "Next Question"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

