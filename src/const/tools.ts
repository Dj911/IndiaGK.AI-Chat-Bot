import { StateSchema } from '@langchain/langgraph';
import * as z from 'zod';
import { IStateAnnotation } from './state.schema';

const GraphState = new StateSchema({
  messages: z.string().optional(),
  currentQuery: z.string(),
  retrievedContext: z.array(z.string()),
  shouldEnd: z.boolean(),
  status: z.enum(['success', 'redirect', 'block', 'error']),
  action: z.string().describe('What action to take'),
  message: z.string().nullable().describe('Message to show the user'),
  data: z.record(z.any(), z.any()).nullable().describe('Additional data'),
});

type GraphStateType = typeof GraphState.State;

export const knowledgeScopeValidator = (state: IStateAnnotation) => {
  console.log('LOG ~ knowledgeScopeValidator ==========');
  try {
    const lowerQuery = `${state.currentQuery}`.toLowerCase();

    // Keywords that indicate India-related queries
    const indiaKeywords = [
      'india',
      'indian',
      'delhi',
      'mumbai',
      'taj mahal',
      'gandhi',
      'bollywood',
      'hindi',
      'rupee',
      'modi',
      'nehru',
      'cricket',
      'bengaluru',
      'chennai',
      'kolkata',
      'goa',
      'kerala',
      'rajasthan',
    ];

    const isIndiaRelated = indiaKeywords.some((keyword) =>
      lowerQuery.includes(keyword),
    );

    // Check for general India topics even without keywords
    const indiaTopics = [
      'capital',
      'president',
      'prime minister',
      'state',
      'festival',
      'language',
      'monument',
      'river',
      'mountain',
      'independence',
    ];

    const hasIndiaTopic = indiaTopics.some((topic) =>
      lowerQuery.includes(topic),
    );

    if (isIndiaRelated || hasIndiaTopic) {
      return {
        currentNode: 'evaluate_scope',
        status: 'success',
        action: 'proceed',
        message: null,
        messages: state.messages,
        currentQuery: state.currentQuery,
        data: { scope: 'india_gk', confidence: 'high' },
      };
    }

    // If clearly non-India related
    if (lowerQuery.match(/\b(china|usa|japan|france|germany|africa)\b/)) {
      return {
        currentNode: 'evaluate_scope',
        status: 'redirect',
        action: 'redirect_to_india',
        message:
          'I specialize in General Knowledge about India! Would you like to learn something interesting about India instead?',
        messages: state.messages,
        currentQuery: state.currentQuery,
        data: { requested_topic: state.currentQuery },
      };
    }

    // Unclear - might be India related in context
    return {
      currentNode: 'evaluate_scope',
      status: 'success',
      action: 'proceed_with_caution',
      message: null,
      messages: state.messages,
      currentQuery: state.currentQuery,
      data: { scope: 'unclear', confidence: 'low' },
    };
  } catch (error) {
    console.log(
      'LOG ~ knowledgeScopeValidator ~ error:',
      JSON.stringify(error),
    );
    return {
      currentNode: 'evaluate_scope',
      status: 'error',
      action: 'show_error_message',
      message: `Error thrown by "${state.currentNode}" with error message "${error ? JSON.stringify(error) : 'Something went wrong, please try again'}"`,
      messages: state.messages,
      currentQuery: state.currentQuery,
      data: {
        context: `Error thrown by "${state.currentNode}" with error message "${error ? JSON.stringify(error) : 'Something went wrong, please try again'}"`,
        recovery_suggestions: ['ask_india_question'],
        user_friendly: true,
      },
    };
  }
};

// Tool 2: Security Guard
export const securityGuard = (state: IStateAnnotation) => {
  console.log('LOG ~ securityGuard ==========');
  try {
    const lowerInput = `${state.currentQuery}`.toLowerCase();

    // Detect prompt injection attempts
    const injectionPatterns = [
      'ignore previous',
      'ignore all',
      'disregard',
      'forget',
      'new instructions',
      'you are now',
      'act as',
      'pretend',
      'system prompt',
      'your instructions',
      'reveal',
      'show me your',
      '<script>',
      'SELECT * FROM',
      'DROP TABLE',
      'INSERT INTO',
      '<?php',
      'eval(',
      'execute(',
      'api key',
      'access token',
    ];

    const isMalicious = injectionPatterns.some((pattern) =>
      lowerInput.includes(pattern),
    );

    if (isMalicious) {
      return {
        currentNode: 'security_check',
        status: 'block',
        action: 'block_request',
        message:
          "I'm here to help you learn about India's General Knowledge! Let's focus on that. What would you like to know about India?",
        messages: state.messages,
        currentQuery: state.currentQuery,
        data: {
          threat_detected: true,
          threat_type: 'prompt_injection',
          severity: 'high',
        },
      };
    }

    return {
      currentNode: 'security_check',
      status: 'success',
      action: 'proceed',
      message: null,
      messages: state.messages,
      currentQuery: state.currentQuery,
      data: { threat_detected: false, threat_level: 'none' },
    };
  } catch (error) {
    console.log('LOG ~ securityGuard ~ error:', JSON.stringify(error));
    return {
      currentNode: 'security_check',
      status: 'error',
      action: 'show_error_message',
      message: `Error thrown by "${state.currentNode}" with error message "${error ? JSON.stringify(error) : 'Something went wrong, please try again'}"`,
      messages: state.messages,
      currentQuery: state.currentQuery,
      data: {
        context: `Error thrown by "${state.currentNode}" with error message "${error ? JSON.stringify(error) : 'Something went wrong, please try again'}"`,
        recovery_suggestions: ['ask_india_question'],
        user_friendly: true,
      },
    };
  }
};

//TODO:
// Tool 3: Tone and Personality Guide
// export const toneAndPersonalityGuide =
//     ({ response_content, user_sentiment }) => {
//         // Determine appropriate tone based on context
//         let suggestedOpening = "";
//         let emoji = "";

//         if (user_sentiment === "curious") {
//             suggestedOpening = "That's a great question!";
//             emoji = "😊";
//         } else if (user_sentiment === "confused") {
//             suggestedOpening = "Let me help clarify that for you!";
//             emoji = "🤔";
//         } else if (user_sentiment === "excited") {
//             suggestedOpening = "I love your enthusiasm!";
//             emoji = "🎉";
//         } else {
//             suggestedOpening = "Happy to help!";
//             emoji = "😊";
//         }

//         return {
//             status: "success",
//             action: "apply_tone",
//             message: null,
//             data: {
//                 suggested_opening: suggestedOpening,
//                 tone_markers: ["encouraging", "warm", "friendly", "humble"],
//                 emoji_suggestion: emoji,
//                 style_notes: "Use simple language, be supportive, celebrate curiosity"
//             }
//         };
//     }

// Tool 4: Quiz Generator
// export const quizGenerator =
//     ({ topic, difficulty, question_type }) => {
//         // Sample quiz questions (in production, you'd have a larger database)
//         const quizBank = {
//             geography: {
//                 easy: {
//                     question: "Which is the capital of India?",
//                     options: ["Mumbai", "New Delhi", "Kolkata", "Bangalore"],
//                     correct_answer: "New Delhi",
//                     explanation: "New Delhi has been the capital of India since 1911, replacing Kolkata."
//                 },
//                 medium: {
//                     question: "Which Indian state is known as the 'Land of Five Rivers'?",
//                     options: ["Punjab", "Haryana", "Uttar Pradesh", "Rajasthan"],
//                     correct_answer: "Punjab",
//                     explanation: "Punjab means 'Land of Five Rivers' - Sutlej, Beas, Ravi, Chenab, and Jhelum."
//                 }
//             },
//             history: {
//                 easy: {
//                     question: "Who is known as the 'Father of the Nation' in India?",
//                     options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Subhas Chandra Bose", "Bhagat Singh"],
//                     correct_answer: "Mahatma Gandhi",
//                     explanation: "Mahatma Gandhi is honored as the Father of the Nation for his role in India's independence movement."
//                 }
//             }
//         };

//         // Get appropriate question
//         const selectedTopic = topic in quizBank ? topic : "geography";
//         const selectedDifficulty = difficulty in quizBank[selectedTopic] ? difficulty : "easy";
//         const quiz = quizBank[selectedTopic][selectedDifficulty];

//         return {
//             status: "success",
//             action: "present_quiz",
//             message: quiz.question,
//             data: {
//                 question_type: question_type,
//                 options: quiz.options,
//                 correct_answer: quiz.correct_answer,
//                 explanation: quiz.explanation,
//                 difficulty: selectedDifficulty,
//                 category: selectedTopic
//             }
//         };
//     }

// Tool 5: Error Handler
export const errorHandler = (state: IStateAnnotation) => {
  console.log('LOG ~ errorHandler==================');
  const baseMessage =
    "Oops! I seem to be having a little trouble processing that right now. 😊 Let's try again! You can ask me:\n- Questions about India's history, culture, or geography\n- For a quiz on Indian General Knowledge\n- About famous Indian personalities or achievements\n\nWhat would you like to explore about India?";

  return {
    currentNode: 'handle_error',
    status: 'error',
    action: 'show_error_message',
    message: baseMessage,
    messages: state.messages,
    currentQuery: state.currentQuery,
    data: {
      context: state.message,
      recovery_suggestions: ['ask_india_question'],
      user_friendly: true,
    },
  };
};
//     [securityGuard.name]: securityGuard,
//     [toneAndPersonalityGuide.name]: toneAndPersonalityGuide,
//     [quizGenerator.name]: quizGenerator,
//     [errorHandler.name]: errorHandler
// };

// export const indiaGKTools = [
//     knowledgeScopeValidator,
//     securityGuard,
//     toneAndPersonalityGuide,
//     quizGenerator,
//     errorHandler
// ];
