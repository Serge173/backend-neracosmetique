import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
  ) {}

  async validate(code: string, orderAmount?: number) {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) {
      return { valid: false, message: 'Code invalide' };
    }

    const coupon = await this.couponRepository.findOne({
      where: { code: normalized, isActive: true },
    });
    if (!coupon) {
      return { valid: false, message: 'Code invalide' };
    }

    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return { valid: false, message: 'Ce code n\'est pas encore valide' };
    }
    if (coupon.validTo && new Date(coupon.validTo) < now) {
      return { valid: false, message: 'Ce code a expiré' };
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, message: 'Ce code n\'est plus disponible' };
    }
    if (orderAmount != null && coupon.minOrderAmount != null && Number(coupon.minOrderAmount) > orderAmount) {
      return {
        valid: false,
        message: `Montant minimum de commande: ${Number(coupon.minOrderAmount).toFixed(2)} €`,
      };
    }

    const value = Number(coupon.value);
    const discount = coupon.type === 'percent'
      ? Math.min((orderAmount ?? 0) * (value / 100), orderAmount ?? 0)
      : Math.min(value, orderAmount ?? value);

    return {
      valid: true,
      message: 'Code appliqué',
      discount: Math.round(discount * 100) / 100,
      type: coupon.type,
      value: value,
    };
  }

  async incrementUsage(code: string): Promise<void> {
    const coupon = await this.couponRepository.findOne({ where: { code: code.trim().toUpperCase() } });
    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await this.couponRepository.save(coupon);
    }
  }
}
