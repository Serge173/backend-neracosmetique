import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber)
    private subscriberRepository: Repository<NewsletterSubscriber>,
  ) {}

  async subscribe(email: string) {
    const normalized = email.trim().toLowerCase();
    let subscriber = await this.subscriberRepository.findOne({ where: { email: normalized } });
    if (subscriber) {
      if (subscriber.isActive) {
        throw new ConflictException('Cet email est déjà inscrit à la newsletter');
      }
      subscriber.isActive = true;
      await this.subscriberRepository.save(subscriber);
    } else {
      subscriber = this.subscriberRepository.create({ email: normalized });
      await this.subscriberRepository.save(subscriber);
    }
    return { success: true, message: 'Inscription à la newsletter réussie' };
  }
}
