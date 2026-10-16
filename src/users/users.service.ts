import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export type PublicUser = Omit<User, 'passwordHash' | 'resetToken' | 'resetTokenExpires'>;

export function toPublicUser(user: User | null): PublicUser | null {
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, resetToken, resetTokenExpires, ...rest } = user;
  return rest;
}

function cleanField(value: unknown, max: number): string {
  return String(value ?? '').trim().substring(0, max);
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findPublic(id: string): Promise<PublicUser> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return toPublicUser(user);
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

  async update(id: string, data: Partial<User>): Promise<PublicUser> {
    const res = await this.userRepository.update(id, data);
    if (!res.affected) throw new NotFoundException('Utilisateur introuvable');
    return this.findPublic(id);
  }

  /** Mise à jour par le client lui-même : seuls les champs de profil sont modifiables. */
  async updateProfile(id: string, body: Record<string, unknown>): Promise<PublicUser> {
    const data: Partial<User> = {};
    if (body?.firstName !== undefined) {
      const firstName = cleanField(body.firstName, 100);
      if (!firstName) throw new BadRequestException('Le prénom est obligatoire');
      data.firstName = firstName;
    }
    if (body?.lastName !== undefined) {
      const lastName = cleanField(body.lastName, 100);
      if (!lastName) throw new BadRequestException('Le nom est obligatoire');
      data.lastName = lastName;
    }
    if (body?.phone !== undefined) {
      const phone = cleanField(body.phone, 30);
      if (phone && !/^[+0-9 ().-]{6,30}$/.test(phone)) throw new BadRequestException('Numéro de téléphone invalide');
      data.phone = phone || null;
    }
    if (Object.keys(data).length === 0) return this.findPublic(id);
    return this.update(id, data);
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
  }): Promise<PublicUser> {
    const email = data.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email invalide');
    }
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Un compte existe déjà avec cet email');
    }
    const rawPassword = String(data.password ?? '').trim();
    if (rawPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }
    const passwordHash = await import('bcryptjs').then(m => m.hash(rawPassword, 12));
    const user = this.userRepository.create({
      email,
      firstName: data.firstName?.trim() || '',
      lastName: data.lastName?.trim() || '',
      phone: data.phone?.trim() || null,
      role: data.role === 'admin' ? 'admin' : 'customer',
      isActive: data.isActive !== false,
      passwordHash,
    });
    return toPublicUser(await this.userRepository.save(user));
  }
}
