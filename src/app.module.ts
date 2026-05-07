import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BasicSetupModule } from './basic_setup/basic_setup.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import { LangchainModule } from './langchain/langchain.module';
import { ConfigModule } from '@nestjs/config';
import { langfuseProcessor } from './config/langfuse.config';
import { NodeSDK } from '@opentelemetry/sdk-node';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(`${process.env.DB_URI}`),
    BasicSetupModule,
    ChatModule,
    LangchainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor() {}

  async onModuleInit() {
    // Initialize the OpenTelemetry SDK with our Langfuse processor
    const sdk = new NodeSDK({
      spanProcessors: [langfuseProcessor],
    });

    // Start the SDK to begin collecting telemetry
    // The warning about crypto module is expected in Deno and doesn't affect basic tracing functionality. Media upload features will be disabled, but all core tracing works normally
    sdk.start();
  }
}
