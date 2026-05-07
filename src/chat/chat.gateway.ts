import { CallbackHandler } from '@langfuse/langchain';
import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HumanMessage, SystemMessage } from 'langchain';
import { Server, Socket } from 'socket.io';
import { BasicSetupService } from 'src/basic_setup/basic_setup.service';
import { VectorStoreService } from 'src/basic_setup/vector_store.service';
import { createStateGraph } from 'src/config/agent.config';
import { AI_CHAT_SESSION_ID } from 'src/const/state.schema';
import { countTokens } from 'src/utils/token';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private basicSetupService: BasicSetupService,
    private vectorService: VectorStoreService,
  ) {}

  afterInit(server: any) {
    console.log('LOG ~ ChatGateway ~ afterInit ~ server:');
  }
  handleConnection(client: Socket, ...args: any[]) {
    console.log(
      'LOG ~ ChatGateway ~ handleConnection ~ handleConnection: Client ',
      client.id,
      ' Connected!',
    );
  }

  handleDisconnect(client: Socket) {
    console.log(
      'LOG ~ ChatGateway ~ handleDisconnect ~ handleDisconnect: : Client ',
      client.id,
      ' Disconnected!',
    );
  }

  @SubscribeMessage('chat_bot')
  async aiChat(
    @MessageBody()
    payload: {
      user: string;
      sessionId: string;
      content: string;
    },
  ): Promise<boolean> {
    if (payload.sessionId === AI_CHAT_SESSION_ID) {
      const { content, sessionId, user } = payload;
      console.log("LOG ~ ChatGateway ~ handleMessage ~ 'Hello world!':");

      const app = await createStateGraph(this.server);

      const queryEmbedding = await this.vectorService.generateEmbeddings(
        `${user}: ${content}`,
      );

      const conversationHistory =
        await this.basicSetupService.listMessages(sessionId);

      // We calculate this just for the "Before" comparison
      let fullHistoryTokens = 0;
      // Simulate calculating full history tokens without loading all docs into memory if possible,
      // or just map your existing `conversationHistory` if you already fetched it.
      const fullHistoryMessages = conversationHistory.map((element) =>
        element.name !== 'Admin'
          ? new HumanMessage(element.body)
          : new SystemMessage(element.body),
      );
      fullHistoryTokens = countTokens(fullHistoryMessages);

      const smartDocs = await this.basicSetupService.getSmartContext(
        sessionId,
        content,
        queryEmbedding,
      );

      // Map to LangChain Messages
      const smartHistory = smartDocs.map((element) => {
        if (element.name !== 'Admin') {
          return new HumanMessage(element.body);
        } else {
          return new SystemMessage(element.body);
        }
      });

      // Calculate "After" tokens
      const smartHistoryTokens = countTokens(smartHistory);
      console.log(`Token Optimization Report:`);
      console.log(`Before (Full): ${fullHistoryTokens} tokens`);
      console.log(`After (Smart): ${smartHistoryTokens} tokens`);
      console.log(
        `Saved: ${fullHistoryTokens - smartHistoryTokens} tokens (~${(((fullHistoryTokens - smartHistoryTokens) / fullHistoryTokens) * 100).toFixed(1)}%)`,
      );

      const initialState = {
        messages: [...smartHistory, new HumanMessage(content)],
        currentQuery: content,
      };

      const langfuseHandler = new CallbackHandler({
        sessionId: payload.sessionId,
        userId: payload.user,
        tags: ['langchain-test'],
      });

      const result = await app.invoke(initialState, {
        configurable: {
          thread_id: sessionId,
        },
        callbacks: [langfuseHandler],
      });

      await this.vectorService.saveMessage(sessionId, {
        name: 'Admin',
        body: `${result.message}`,
      });

      return true;
    } else {
      return false;
    }
  }

  @SubscribeMessage('create_session')
  async createSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { user: string; session: string },
  ): Promise<{ session: string }> {
    const { session, user } = payload;

    console.log('LOG ~ ChatGateway ~ handleMessage ~ Create Session:');

    const sessionId =
      session !== ''
        ? session
        : await this.basicSetupService.createSession(user);
    console.log(
      'LOG ~ ChatGateway ~ createSession ~ sessionId:',
      sessionId,
      session,
      'ROOOOMMMSSS:',
      JSON.stringify(client.rooms),
    );
    client.join(`session:${sessionId}`);
    this.server.to(`session:${sessionId}`).emit('message', {
      name: 'Admin',
      session: sessionId,
      text: `Welcome! ${user} has entered the conversation.`,
      time: new Date(),
    });
    return { session: `${sessionId}` };
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody()
    payload: {
      user: string;
      sessionId: string;
      content: string;
    },
  ): Promise<{ name: string; session: string; text: string; time: Date }> {
    const { content, sessionId, user } = payload;

    console.log("LOG ~ ChatGateway ~ handleMessage ~ 'Hello world!':");
    const messageSent = await this.vectorService.saveMessage(sessionId, {
      name: user,
      body: content,
    });
    this.server.to(`session:${messageSent.session}`).emit('message', {
      name: user,
      session: sessionId,
      text: content,
      time: new Date(),
    });
    return { name: user, session: sessionId, text: content, time: new Date() };
  }
}
