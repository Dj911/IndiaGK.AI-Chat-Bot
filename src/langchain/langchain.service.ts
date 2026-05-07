import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HumanMessage } from 'langchain';
import { Model } from 'mongoose';
import { Messages, MessagesDocument } from 'src/basic_setup/schema/messages';
import { Session, SessionDocument } from 'src/basic_setup/schema/sesssion';
import { ChatGateway } from 'src/chat/chat.gateway';
import { createStateGraph } from 'src/config/agent.config';

@Injectable()
export class LangchainService {
  constructor(
    @InjectModel(`${Messages.name}`)
    public messageModel: Model<MessagesDocument>,
    @InjectModel(`${Session.name}`)
    public sessionModel: Model<SessionDocument>,
    private readonly chatGateway: ChatGateway,
  ) {}

  async graphChat(message: string, sessionId: string) {
    try {
      const app = await createStateGraph(this.chatGateway.server);

      const initialState = {
        messages: [new HumanMessage(message)],
        currentQuery: message,
      };

      const result = await app.invoke(initialState, {
        configurable: {
          thread_id: sessionId,
        },
      });

      for (const message of result.messages) {
        console.log(`[${message.type}]: ${message.text}`);
      }

      return result;
    } catch (error) {
      console.log('LOG ~ LangchainService ~ graphChat ~ error:', error);
    }
  }
}
