import { Module } from '@nestjs/common';
import { BasicSetupService } from './basic_setup.service';
import { BasicSetupController } from './basic_setup.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Messages, MessagesSchema } from './schema/messages';
import { Session, SessionSchema } from './schema/sesssion';
import { VectorStoreService } from './vector_store.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Messages.name, schema: MessagesSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [BasicSetupController],
  providers: [BasicSetupService, VectorStoreService],
  exports: [BasicSetupService, VectorStoreService],
})
export class BasicSetupModule {}
