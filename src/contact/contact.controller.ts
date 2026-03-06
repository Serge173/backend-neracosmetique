import { Controller, Post, Body } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Post()
  async sendMessage(@Body() data: any) {
    return this.contactService.sendMessage(data);
  }
}
