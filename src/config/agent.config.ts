import { ChatOpenAI } from '@langchain/openai';
import { END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from 'langchain';
import {
  format_response_prompt,
  request_process_prompt,
} from '../const/prompts';
import { errorHandler, securityGuard } from 'src/const/tools';
import { AI_CHAT_SESSION_ID, StateAnnotation } from 'src/const/state.schema';
import { Server } from 'socket.io';

const llm = new ChatOpenAI({
  model: process.env.LLM_MODEL,
  maxTokens: 700,
  temperature: 0.8,
});

export async function createStateGraph(gateway: Server) {
  const workflow = new StateGraph(StateAnnotation)
    .addNode('security_check', securityGuard)
    .addNode('supervisor', async (state) => {
      // Supervisor decides which expert to route to
      const routingPrompt = `Analyze this question and determine which expert should handle it:
            
            Question: ${state.currentQuery}

            Experts:
            - history: Indian independence, rulers, historical events
            - geography: States, capitals, rivers, mountains
            - culture: Festivals, food, traditions, languages
            - current_affairs: Recent events, current leaders, latest news
            - general: Anything else

            Respond with just the expert name.`;

      const response = await llm.invoke([new HumanMessage(routingPrompt)]);
      const expert = `${response.content}`.toLowerCase().trim();

      return {
        currentNode: 'supervisor',
        status: 'success',
        action: 'proceed',
        message: null,
        messages: state.messages,
        currentQuery: state.currentQuery,
        data: {
          assigned_expert: expert,
          threat_detected: false,
          threat_level: 'none',
        },
      };
    })
    // .addNode('critic', async (state) => {
    //     // Agent critiques its own response
    //     const lastResponse = state.messages[state.messages.length - 1];

    //     const criticPrompt = `Evaluate this response to the question: "${state.currentQuery}"
    //     Response: ${lastResponse.content}

    //     Check for:
    //     1. Factual accuracy
    //     2. Completeness
    //     3. Clarity
    //     4. Helpfulness

    //     Score from 1-10:
    //     If score < 7, explain what needs improvement.
    //     If score >= 7, say "APPROVED"

    //     Format: SCORE: X
    //     FEEDBACK: ...`;

    //     const critique = await llm.invoke([new HumanMessage(criticPrompt)]);
    //     const score = parseInt(`${critique.content}`.match(/SCORE:\s*(\d+)/)?.[1] || '10');

    //     return {
    //         currentNode: 'critic',
    //         status: "success",
    //         action: "proceed",
    //         messages: state.messages,
    //         currentQuery: state.currentQuery,
    //         data: {
    //             threat_detected: false,
    //             threat_level: "none",
    //             quality_score: score,
    //             critique: critique.content
    //         }
    //     };
    // })
    // .addNode('improve', async (state) => {
    //     // Improve response based on critique
    //     const improvePrompt = `Improve this response based on the critique:

    //         Original Question: ${state.currentQuery}
    //         Original Response: ${state.messages[state.messages.length - 1].content}
    //         Critique: ${state.data!['critique']}

    //         Provide an improved response:`;

    //     const improved = await llm.invoke([new HumanMessage(improvePrompt)]);
    //     return {
    //         currentNode: 'improve',
    //         status: "success",
    //         action: "proceed",
    //         message: improved,
    //         messages: [...state.messages, improved],
    //         currentQuery: state.currentQuery,
    //         data: { threat_detected: false, threat_level: "none" }
    //     };
    // })
    .addNode('request_process', async (state) => {
      console.log('LOG ~ createStateGraph ~ request_process:');

      // Build messages with system prompt
      const messages = [
        ...state.messages,
        new SystemMessage(request_process_prompt),
      ];

      const response = await llm.invoke(messages);

      return {
        currentNode: 'request_process',
        status: 'success',
        action: 'end',
        message: null,
        messages: [...state.messages, response.content],
        currentQuery: state.currentQuery,
        data: { threat_detected: false, threat_level: 'none' },
      };
    })
    .addNode('format_response', async (state) => {
      console.log('LOG ~ createStateGraph ~ format_response==============');
      // THIS WILL BE USED TO FORMAT THE RESPONSE CAME FROM "request_process" or "handle_error" NODES
      if (['block', 'error'].includes(`${state.status}`)) {
        // request is either blocked by securityGuard Node or got error from errorHandler Node
        return {
          currentNode: 'format_response',
          status: `${state.status}`,
          action: 'proceed',
          message: state.message,
          messages: state.messages,
          currentQuery: state.currentQuery,
          data: {
            context: state.data!['context'],
            threat_detected: true,
            threat_level: 'none',
          },
        };
      }

      const messages = [
        ...state.messages,
        new SystemMessage(`${format_response_prompt}

                    User's Original Question: ${state.currentQuery}

                    Response Type: ${state.status}

                    Factual Content to Format:
                    ${state.messages}

                    Now format this content with warm, encouraging, friendly tone suitable for our India GK chatbot based on the response type. Return the final formatted response that will be sent directly to the user.`),
      ];

      const response = await llm.invoke(messages);

      gateway.to(`session:${AI_CHAT_SESSION_ID}}`).emit('message', {
        name: 'Admin',
        session: AI_CHAT_SESSION_ID,
        text: `${response.content}`,
      });

      return {
        currentNode: 'format_response',
        status: 'success',
        action: 'proceed',
        message: response.content,
        messages: [...state.messages, response.content],
        currentQuery: state.currentQuery,
        data: { threat_detected: false, threat_level: 'none' },
      };
    })
    .addNode('history_expert', async (state) => {
      const expertPrompt = `You are a history expert Named Ravi. 
            Always add your name in the answer to identify you are the one responding.
            Answer this question with deep historical context:

            ${state.currentQuery}

            Focus on historical accuracy, dates, and key figures. Don't forget to add your signature in the response`;

      const response = await llm.invoke([new HumanMessage(expertPrompt)]);
      return {
        currentNode: 'history_expert',
        status: 'success',
        action: 'end',
        message: null,
        messages: [...state.messages, response.content],
        currentQuery: state.currentQuery,
        data: { threat_detected: false, threat_level: 'none' },
      };
    })
    .addNode('geography_expert', async (state) => {
      const expertPrompt = `You are a geography expert Named Kailash. Always add your name in the answer to identify you are the one responding. Answer with geographical details:${state.currentQuery}. Don't forget to add your signature in the response`;

      const response = await llm.invoke([new HumanMessage(expertPrompt)]);
      return {
        currentNode: 'geography_expert',
        status: 'success',
        action: 'end',
        message: response,
        messages: [...state.messages, response.content],
        currentQuery: state.currentQuery,
        data: { threat_detected: false, threat_level: 'none' },
      };
    })
    .addNode('culture_expert', async (state) => {
      const expertPrompt = `You are a culture expert Named Ram. Always add your name in the answer to identify you are the one responding. Answer with cultural insights: ${state.currentQuery}. Don't forget to add your signature in the response`;

      const response = await llm.invoke([new HumanMessage(expertPrompt)]);
      return {
        currentNode: 'culture_expert',
        status: 'success',
        action: 'end',
        message: response.content,
        messages: [...state.messages, response.content],
        currentQuery: state.currentQuery,
        data: { threat_detected: false, threat_level: 'none' },
      };
    })
    .addNode('current_affairs_expert', async (state) => {
      const expertPrompt = `You are a Current Affairs expert Named Subham. Always add your name in the answer to identify you are the one responding. Answer this question with deep historical context:

            ${state.currentQuery}

            Focus on historical accuracy, dates, and key figures. Don't forget to add your signature in the response`;

      const response = await llm.invoke([new HumanMessage(expertPrompt)]);
      return {
        currentNode: 'current_affairs_expert',
        status: 'success',
        action: 'end',
        message: response.content,
        messages: [...state.messages, response.content],
        currentQuery: state.currentQuery,
        data: { threat_detected: false, threat_level: 'none' },
      };
    })
    .addNode('handle_error', errorHandler)

    /* START OF NODE TREE LIST */
    .addEdge(START, 'security_check')
    .addEdge('history_expert', 'format_response')
    .addEdge('geography_expert', 'format_response')
    .addEdge('culture_expert', 'format_response')
    .addEdge('current_affairs_expert', 'format_response')
    .addEdge('request_process', 'format_response')
    .addEdge('handle_error', 'format_response')
    // .addEdge("request_process","critic")
    .addEdge('format_response', END)
    /* END OF NODE TREE LIST*/

    .addConditionalEdges('security_check', (state) => {
      console.log(
        'LOG ~ createStateGraph ~ security_check======================',
      );
      if (state.status === 'error') {
        return 'handle_error';
      } else {
        return 'supervisor';
      }
    })
    .addConditionalEdges('supervisor', (state) => {
      const expert = state.data!['assigned_expert'] || 'general';
      if (expert.includes('history')) return 'history_expert';
      if (expert.includes('geography')) return 'geography_expert';
      if (expert.includes('culture')) return 'culture_expert';
      if (expert.includes('current_affairs')) return 'current_affairs_expert';
      return 'request_process'; // default
    });
  // .addConditionalEdges("evaluate_scope", (state) => {
  //     console.log("LOG ~ createStateGraph ~ evaluate_scope=======================")
  //     if (state.status === "error") {
  //         return "handle_error"
  //     } else {
  //         return "request_process"
  //     }
  // })
  // .addEdge("improve","critic")
  // .addConditionalEdges('critic', (state) => {
  //     const score = state.data!['quality_score'] || 10;
  //     return score >= 7 ? 'format_response' : 'improve';
  // })
  /* security_check -> handle_error */
  /* evaluate_scope -> handle_error */
  /* evaluate_scope -> handle_error */

  return workflow.compile();
}
