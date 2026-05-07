import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export interface IMessage {
  session: string;
  name: string;
  body: string;
  embedding: Number[];
}

export type MessagesDocument = HydratedDocument<IMessage>;

@Schema({
  timestamps: true,
})
export class Messages {
  @Prop()
  session: Types.ObjectId;

  @Prop()
  name: string;

  @Prop()
  body: string;

  @Prop({ type: [Number], index: true })
  embedding: number[];
}

export const MessagesSchema = SchemaFactory.createForClass(Messages);
