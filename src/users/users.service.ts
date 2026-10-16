import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Partial<User>[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'isActive', 'createdAt'],
    });
    return users;
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({ where: { email } });
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  async createFromAdmin(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role?: 'customer' | 'admin';
    password: string;
    isActive?: boolean;
  }): Promise<User> {
    const email = data.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email obligatoire');
    }
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Un compte existe déjà avec cet email');
    }
    const rawPassword = String(data.password ?? '').trim();
    if (rawPassword.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères');
    }
    const passwordHash = await import('bcryptjs').then(m => m.hash(rawPassword, 10));
    const user = this.userRepository.create({
      email,
      firstName: data.firstName?.trim() || '',
      lastName: data.lastName?.trim() || '',
      phone: data.phone?.trim() || null,
      role: data.role === 'admin' ? 'admin' : 'customer',
      isActive: data.isActive !== false,
      passwordHash,
    });
    return this.userRepository.save(user);
  }
}
