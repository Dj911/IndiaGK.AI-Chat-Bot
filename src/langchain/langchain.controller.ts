import { Body, Controller, Get, Post } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import {
  StateGraph,
  StateSchema,
  GraphNode,
  ConditionalEdgeRouter,
} from '@langchain/langgraph';
import { z } from 'zod/v4';
import { ChatOpenAI } from '@langchain/openai';

@Controller('langchain')
export class LangchainController {
  constructor(private readonly langchainService: LangchainService) {}

  @Post()
  async test(@Body() body) {
    return this.langchainService.graphChat(body.message, body.sessionId);
  }

  @Get()
  async testing() {
    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL,
      maxTokens: 700,
      temperature: 0.8,
    });

    // Graph state
    const State = new StateSchema({
      topic: z.string(),
      joke: z.string(),
      improvedJoke: z.string(),
      finalJoke: z.string(),
    });

    // Define node functions

    // First LLM call to generate initial joke
    const generateJoke: GraphNode<typeof State> = async (state) => {
      console.log('LOG ~ LangchainController ~ generateJoke ~ generateJoke:');
      const msg = await llm.invoke(`Write a short joke about ${state.topic}`);
      return { joke: msg.content };
    };

    // Gate function to check if the joke has a punchline
    const checkPunchline: ConditionalEdgeRouter<typeof State> = (state) => {
      console.log(
        'LOG ~ LangchainController ~ checkPunchline ~ checkPunchline:',
      );
      // Simple check - does the joke contain "?" or "!"
      if (`${state.joke}`?.includes('?') || `${state.joke}`?.includes('!')) {
        return 'Pass';
      }
      return 'Fail';
    };

    // Second LLM call to improve the joke
    const improveJoke: GraphNode<typeof State> = async (state) => {
      console.log('LOG ~ LangchainController ~ improveJoke ~ improveJoke:');
      const msg = await llm.invoke(
        `Make this joke funnier by adding wordplay: ${state.joke}`,
      );
      return { improvedJoke: msg.content };
    };

    // Third LLM call for final polish
    const polishJoke: GraphNode<typeof State> = async (state) => {
      console.log('LOG ~ LangchainController ~ polishJoke ~ polishJoke:');
      const msg = await llm.invoke(
        `Add a surprising twist to this joke: ${state.improvedJoke}`,
      );
      return { finalJoke: msg.content };
    };

    // Build workflow
    const chain = new StateGraph(State)
      .addNode('generateJoke', generateJoke)
      .addNode('improveJoke', improveJoke)
      .addNode('polishJoke', polishJoke)
      .addEdge('__start__', 'generateJoke')
      .addConditionalEdges('generateJoke', checkPunchline, {
        Pass: 'improveJoke',
        Fail: '__end__',
      })
      .addEdge('improveJoke', 'polishJoke')
      .addEdge('polishJoke', '__end__')
      .compile();

    // Invoke
    const state = await chain.invoke({ topic: 'cats' });
    console.log('Initial joke:');
    console.log(state.joke);
    console.log('\n--- --- ---\n');
    if (state.improvedJoke !== undefined) {
      console.log('Improved joke:');
      console.log(state.improvedJoke);
      console.log('\n--- --- ---\n');

      console.log('Final joke:');
      console.log(state.finalJoke);
    } else {
      console.log('Joke failed quality gate - no punchline detected!');
    }
    console.log('============END OF JOKE============');
    return true;
  }
}
