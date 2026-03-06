import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw new BadRequestException('Email déjà utilisé');
    }

    const rawPassword = String(dto.password ?? '').trim();
    if (rawPassword.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères');
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: 'customer',
    });

    const savedUser = await this.userRepository.save(user);
    const tokens = this.generateTokens(savedUser);

    return {
      ...tokens,
      user: this.sanitizeUser(savedUser),
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const password = String(dto.password ?? '').trim();
    let user = await this.userRepository.findOne({ where: { email } });
    let passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

    // Helper de déblocage uniquement si activé explicitement en dev.
    const devHelpersEnabled = this.configService.get('ENABLE_DEV_AUTH_HELPERS') === 'true';
    if (
      user &&
      !passwordOk &&
      process.env.NODE_ENV !== 'production' &&
      devHelpersEnabled &&
      password === 'Password123!'
    ) {
      user.passwordHash = await bcrypt.hash('Password123!', 10);
      await this.userRepository.save(user);
      passwordOk = true;
      this.logger.log(`Dev helper: mot de passe forcé pour ${email}`);
    }

    if (!user || !passwordOk) {
      this.logger.warn(`Login failed for email=${email}: userFound=${!!user}, passwordOk=${passwordOk}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const tokens = this.generateTokens(user);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET') || this.configService.get('JWT_SECRET');
    const refreshExpires = this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { secret: refreshSecret, expiresIn: refreshExpires }),
    };
  }

  async refreshToken(refreshToken: string) {
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET') || this.configService.get('JWT_SECRET');
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });
      const user = await this.validateUser(payload.sub);
      const tokens = this.generateTokens(user);
      return { ...tokens, user: this.sanitizeUser(user) };
    } catch {
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return { success: true, message: 'Si cet email est associé à un compte, vous recevrez un lien de réinitialisation.' };
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await this.userRepository.save(user);
    return { success: true, message: 'Si cet email est associé à un compte, vous recevrez un lien de réinitialisation.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { resetToken: token },
    });
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await this.userRepository.save(user);
    return { success: true, message: 'Mot de passe mis à jour' };
  }

  private sanitizeUser(user: User) {
    const { passwordHash, resetToken, resetTokenExpires, ...rest } = user;
    return rest;
  }

  /**
   * Change le mot de passe de l'utilisateur connecté.
   * Vérifie le mot de passe actuel puis enregistre le nouveau (hash).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: true; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session invalide');
    }
    const current = String(currentPassword ?? '').trim();
    if (!current) {
      throw new BadRequestException('Le mot de passe actuel est requis');
    }
    const valid = await bcrypt.compare(current, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    const newRaw = String(newPassword ?? '').trim();
    if (newRaw.length < 6) {
      throw new BadRequestException('Le nouveau mot de passe doit contenir au moins 6 caractères');
    }
    if (current === newRaw) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'actuel');
    }
    user.passwordHash = await bcrypt.hash(newRaw, 10);
    await this.userRepository.save(user);
    this.logger.log(`Password changed for user ${user.email}`);
    return { success: true, message: 'Mot de passe mis à jour. Utilisez-le lors de votre prochaine connexion.' };
  }

  /**
   * En développement uniquement : réinitialise le mot de passe d'un utilisateur par email.
   * Permet de débloquer la connexion si le hash en base est corrompu ou inconnu.
   */
  async devResetPassword(email: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
    const devHelpersEnabled = this.configService.get('ENABLE_DEV_AUTH_HELPERS') === 'true';
    if (process.env.NODE_ENV === 'production' || !devHelpersEnabled) {
      throw new BadRequestException('Non disponible en production');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      return { ok: false, message: 'Aucun compte avec cet email' };
    }
    const rawPassword = newPassword.trim();
    if (rawPassword.length < 6) {
      return { ok: false, message: 'Le mot de passe doit faire au moins 6 caractères' };
    }
    user.passwordHash = await bcrypt.hash(rawPassword, 10);
    await this.userRepository.save(user);
    this.logger.log(`Dev: mot de passe réinitialisé pour ${normalizedEmail}`);
    return { ok: true, message: `Mot de passe mis à jour pour ${normalizedEmail}. Vous pouvez vous connecter.` };
  }
}
