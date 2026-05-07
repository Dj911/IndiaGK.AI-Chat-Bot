import { Module } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import { LangchainController } from './langchain.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Messages, MessagesSchema } from 'src/basic_setup/schema/messages';
import { Session, SessionSchema } from 'src/basic_setup/schema/sesssion';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [
    ChatModule,
    MongooseModule.forFeature([
      { name: Messages.name, schema: MessagesSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [LangchainController],
  providers: [LangchainService],
})
export class LangchainModule {}
