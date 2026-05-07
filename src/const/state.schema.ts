import { MessagesValue, StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';

export const StateAnnotation = new StateSchema({
  messages: MessagesValue,
  currentNode: z.any(),
  currentQuery: z.string(),
  retrievedContext: z.array(z.string()),
  shouldEnd: z.boolean(),
  status: z.enum(['success', 'redirect', 'block', 'error']),
  action: z.string().describe('What action to take'),
  message: z.string().nullable().describe('Message to show the user'),
  data: z.record(z.any(), z.any()).nullable().describe('Additional data'),
});

export type IStateAnnotation = typeof StateAnnotation.State;

export const AI_CHAT_SESSION_ID = 'a3758290-7131-4eed-a2ed-d976b5c83911';
