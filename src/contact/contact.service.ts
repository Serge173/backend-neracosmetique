import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from './entities/contact-message.entity';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private contactRepository: Repository<ContactMessage>,
  ) {}

  async sendMessage(data: { name: string; email: string; phone?: string; message: string }) {
    const msg = this.contactRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
    });
    await this.contactRepository.save(msg);
    return { success: true };
  }
}
