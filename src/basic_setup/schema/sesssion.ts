import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

@Schema({
  timestamps: true,
})
export class Session {
  @Prop()
  _id: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
