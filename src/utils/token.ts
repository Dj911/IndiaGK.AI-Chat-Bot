import { encoding_for_model } from 'tiktoken';
import { BaseMessage } from '@langchain/core/messages';

// Initialize encoder (uses gpt-4 encoding by default, adjusts to your model)
const enc = encoding_for_model('gpt-4o');

export const countTokens = (messages: BaseMessage[] | string): number => {
  if (typeof messages === 'string') {
    return enc.encode(messages).length;
  }

  // Rough estimation for Chat Messages (content + role overhead)
  return messages.reduce((acc, msg) => {
    return acc + enc.encode(msg.content as string).length + 4; // +4 for role tokens
  }, 0);
};
