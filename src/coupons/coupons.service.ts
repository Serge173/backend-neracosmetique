import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { computeCouponDiscount } from './coupon-discount';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
  ) {}

  async validate(code: string, orderAmount?: number, userId: string | null = null) {
    const normalized = typeof code === 'string' ? code.trim().toUpperCase().substring(0, 40) : '';
    orderAmount = orderAmount != null && Number.isFinite(Number(orderAmount)) ? Math.max(0, Number(orderAmount)) : undefined;
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
        message: `Montant minimum de commande : ${Number(coupon.minOrderAmount).toLocaleString('fr-FR')} F CFA`,
      };
    }
    const [owner] = await this.couponRepository.query(
      `select user_id from user_loyalty_redemptions where coupon_id = $1`,
      [coupon.id],
    );
    if (owner && owner.user_id !== userId) {
      return { valid: false, message: 'Ce bon fidélité est personnel : connectez-vous avec le compte qui l’a obtenu.' };
    }

    const value = Number(coupon.value);
    const discount = orderAmount != null
      ? computeCouponDiscount(coupon.type, value, orderAmount)
      : coupon.type === 'percent' ? 0 : Math.round(value);

    return {
      valid: true,
      message: 'Code appliqué',
      discount,
      type: coupon.type,
      value: value,
    };
  }
}
