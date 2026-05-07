import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
dotenv.config(); // Load .env first!

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`Server started on ${process.env.PORT ?? 3000}`);
  });
}
bootstrap();
