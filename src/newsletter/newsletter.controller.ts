import { Controller, Post, Body } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(private newsletterService: NewsletterService) {}

  @Post('subscribe')
  async subscribe(@Body() body: { email: string }) {
    return this.newsletterService.subscribe(body.email);
  }
}
