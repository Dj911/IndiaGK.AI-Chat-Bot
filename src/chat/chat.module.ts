import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { BasicSetupModule } from 'src/basic_setup/basic_setup.module';

@Module({
  imports: [BasicSetupModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
