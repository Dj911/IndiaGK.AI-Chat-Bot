import {
  StateGraph,
  StateSchema,
  GraphNode,
  START,
  END,
  ConditionalEdgeRouter,
} from '@langchain/langgraph';
import { z } from 'zod/v4';
import { ChatOpenAI } from '@langchain/openai';

async function testing() {
  // LLM config
  const llm = new ChatOpenAI({
    model: process.env.LLM_MODEL,
    maxTokens: 700,
    temperature: 0.8,
  });

  // Graph state
  const State = new StateSchema({
    content: z.string(),
    urgency: z.string().optional(),
    reply: z.string().optional(),
    // finalJoke: z.string(),
  });

  // Define node functions

  // First LLM call to read the email
  const readEmail: GraphNode<typeof State> = async (state) => {
    console.log('LOG ~ LangchainController ~ readEmail ~ readEmail:');
    return { content: state.content };
  };

  // Gate function to the urgency of the email
  const classifyEmail: GraphNode<typeof State> = async (state) => {
    console.log('LOG ~ LangchainController ~ classifyEmail ~ classifyEmail:');
    const msg = await llm.invoke(
      `Analyze the email and determine if it's an urgent email that needs to be replied ASAP or not: ${state.content}
            Return true if the email needs urgent reply else return false`,
    );
    console.log('LOG ~ classifyEmail ~ msg:', msg.content);
    // Simple check - does the joke contain "?" or "!"
    if (`${msg.content}`.toLowerCase().includes('true')) {
      return { content: state.content, urgency: 'high' };
    }
    return { content: state.content, urgency: 'low' };
  };

  const checkUrgency: ConditionalEdgeRouter<typeof State> = (state) => {
    console.log('LOG ~ LangchainController ~ checkPunchline ~ checkPunchline:');
    // Simple check - does the joke contain "?" or "!"
    if (`${state.urgency}`?.toLowerCase().includes('low')) {
      return 'Pass';
    }
    return 'Fail';
  };

  // Second LLM call to reply to email
  const replyEmail: GraphNode<typeof State> = async (state) => {
    console.log('LOG ~ LangchainController ~ replyEmail ~ replyEmail:');
    const msg = await llm.invoke(
      `Draft a reply for the email: ${state.content}`,
    );
    console.log('LOG ~ replyEmail ~ msg:', msg.content);

    /*
        ..... LOGIC TO SEND EMAIL 
         */
    return {
      content: state.content,
      urgency: state.urgency,
      reply: msg.content,
    };
  };

  // Third LLM call for final polish
  const humanReview: GraphNode<typeof State> = async (state) => {
    console.log('LOG ~ LangchainController ~ humanReview ~ humanReview:');
    /*
        ..... LOGIC TO SEND EMAIL FOR REVIEW
         */
    return { content: state.content, urgency: state.urgency };
  };

  // Build workflow
  const workflow = new StateGraph(State)
    .addNode('read-email', readEmail)
    .addNode('reply-email', replyEmail)
    .addNode('human-review', humanReview)
    .addNode('classify-email', classifyEmail)
    .addEdge(START, 'read-email')
    .addEdge('read-email', 'classify-email')
    .addConditionalEdges('classify-email', checkUrgency, {
      Pass: 'reply-email',
      Fail: 'human-review',
    })
    .addEdge('human-review', END)
    .addEdge('reply-email', END)
    .compile();

  // Invoke
  const state = await workflow.invoke({
    content: `URGENT: I need the PPT by EOD without fail. Please reply me ASAP`,
  });
  // console.log("Initial joke:");
  // console.log(state.joke);
  // console.log("\n--- --- ---\n");
  // if (!state?.improvedJoke) {
  //     console.log("Improved joke:");
  //     console.log(state.improvedJoke);
  //     console.log("\n--- --- ---\n");

  //     console.log("Final joke:");
  //     console.log(state.finalJoke);
  // } else {
  //     console.log("Joke failed quality gate - no punchline detected!");
  // }
  // console.log("============END OF JOKE============")
  return state?.reply ?? 'Please review the email';
}

testing();
