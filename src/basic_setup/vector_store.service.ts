import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Collection, Connection, Document, Model } from 'mongoose';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Messages, MessagesDocument } from './schema/messages';

@Injectable()
export class VectorStoreService {
  private vectorStore: MongoDBAtlasVectorSearch;
  private embeddingsModel: OpenAIEmbeddings;

  constructor(
    @InjectModel(Messages.name) private messageModel: Model<MessagesDocument>,
    @InjectConnection()
    private connection: Connection,
  ) {
    this.embeddingsModel = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small', // Highly recommended over ada-002
      apiKey: `${process.env.OPENAI_API_KEY}`,
    });
    console.log(
      'LOG ~ VectorStoreService ~ constructor ~ process.env.OPENAI_API_KEY:',
      process.env.OPENAI_API_KEY,
    );

    const client = this.connection.getClient();
    const collection = client.db('test').collection('messages');

    this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddingsModel, {
      collection: collection as any,
      indexName: 'vector_index',
      textKey: 'text',
      embeddingKey: 'embedding',
    });
  }

  /**
   * Save a new message and automatically generate its vector embedding
   */
  async saveMessage(session: string, content: { name: string; body: string }) {
    // 1. Combine content bodies for embedding context
    // (Vectors work best on the actual text chunk you want to search)
    const textToEmbed = `${content.name}: ${content.body}`;

    // 2. Generate Vector
    const vector = await this.embeddingsModel.embedQuery(textToEmbed);

    // 3. Create the BSON document with the vector
    const newMessage = new this.messageModel({
      session,
      name: content.name,
      body: content.body,
      embedding: vector, // Storing vector alongside data
    });

    return await newMessage.save();
  }

  /**
   * Search for similar messages based on a query
   */
  async similaritySearch(
    query: string,
    limit: number = 5,
    filter: QueryFilter<MessagesDocument>,
  ) {
    // This performs a vector search in MongoDB Atlas
    const results = await this.vectorStore.similaritySearch(query, limit, {
      preFilter: filter,
    });

    // Results contain the raw document. mapped to LangChain Documents
    return results;
  }

  /**
   * Advanced: Search using the LangGraph/LangChain retriever interface
   */
  getRetriever() {
    return this.vectorStore.asRetriever();
  }

  generateEmbeddings(content: string): Promise<number[]> {
    return this.vectorStore.embeddings.embedQuery(content);
  }
}
