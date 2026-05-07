import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage, Messages, MessagesDocument } from './schema/messages';
import { Session, SessionDocument } from './schema/sesssion';
import { randomUUID } from 'crypto';
import { VectorStoreService } from './vector_store.service';

@Injectable()
export class BasicSetupService {
  constructor(
    @InjectModel(`${Messages.name}`)
    public messageModel: Model<MessagesDocument>,
    @InjectModel(`${Session.name}`)
    public sessionModel: Model<SessionDocument>,
    private vectorService: VectorStoreService,
  ) {}

  async createSession(user: string): Promise<string> {
    const uuid = randomUUID();
    await this.sessionModel.create({
      _id: uuid,
    });

    await this.vectorService.saveMessage(uuid, {
      name: user,
      body: `Welcome! ${user} has entered the conversation.`,
    });

    return uuid;
  }

  async listMessages(id: string): Promise<IMessage[]> {
    return await this.messageModel
      .find({
        session: id,
      })
      .lean();
  }

  /**
   * Without Langchain package, only using OpenAi package
   */
  /* async config(message: string, sessionId: string) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.messageModel

    const encoder = encoding_for_model('chatgpt-4o')

    const contextMessage = await this.creteContextMessage(sessionId)
    const response = await openai.chat.completions.create({
      model: 'chatgpt-4o',
      messages: [
        ...contextMessage,
        {
          role: 'user',
          content: message,
        },
      ],
    });

    if(response!.usage!.total_tokens > MAX_TOKEN){

    }

    return response.choices[0].message.content
  } 

  private transformToOpenAIFormat(mongoContent: IMessageContent[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return mongoContent.map(msg => {
    if(msg.name !== 'bot'){
      return {
        role: "user" as const, // or determine based on msg.name
        content: `${msg.name}: ${msg.body}`
      }
    }
  }) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

  private async creteContextMessage(sessionId: string): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]>{
    const messages = (await this.messageModel.find({
      session: sessionId
    }).lean())[0]

    const messageHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = 
    this.transformToOpenAIFormat(messages!.content!)

    return [
      {
        role: 'system',
        content: `You are a friendly and knowledgeable AI assistant specializing in General Knowledge about India. Your purpose is to help users learn about India's history, culture, geography, politics, economy, sports, and current affairs in an encouraging and supportive manner.`
      },
      ...messageHistory
    ]

  }
    */

  normalizeDoc(doc: any) {
    if (doc.pageContent) {
      return {
        _id: doc.metadata._id,
        createdAt: doc.metadata.createdAt,
        name: doc.metadata.name,
        body: doc.pageContent,
      };
    }
    return doc;
  }

  async getSmartContext(
    sessionId: string,
    currentQuery: string,
    queryEmbedding: number[],
  ) {
    // 1. Get Recent Messages (Immediate Context) - e.g., last 4
    const recentDocs = await this.messageModel
      .find({ session: sessionId })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // 2. Get Relevant Messages (Vector Search)
    const relevantDocs = await this.vectorService.similaritySearch(
      currentQuery,
      5,
      { session: { $eq: sessionId } },
    );

    // 3. Merge, Deduplicate, and Sort
    const allDocsMap = new Map();

    // Process Recent (High Priority)
    recentDocs.forEach((doc) =>
      allDocsMap.set(doc._id.toString(), this.normalizeDoc(doc)),
    );

    // Process Relevant (Fill gaps)
    relevantDocs.forEach((doc) => {
      // Assuming metadata contains _id or a unique field to detect duplicates
      // If _id isn't in metadata, you might dedup by 'body' content
      const normalized = this.normalizeDoc(doc);
      const key = normalized._id ? normalized._id.toString() : normalized.body;

      if (!allDocsMap.has(key)) {
        allDocsMap.set(key, normalized);
      }
    });

    const uniqueDocs = Array.from(allDocsMap.values())
      // Sort Oldest -> Newest for proper chat flow
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

    return uniqueDocs;
  }
}
