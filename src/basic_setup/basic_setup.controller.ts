import { Body, Controller, Post } from '@nestjs/common';
import { BasicSetupService } from './basic_setup.service';

@Controller('basic-setup')
export class BasicSetupController {
  constructor(private readonly basicSetupService: BasicSetupService) {}
  @Post()
  async test(@Body() body: { message: string; sessionId: string }) {
    // For vanilla OpenAi calls
    // return await this.basicSetupService.config(body.message,body.sessionId)
  }
}
