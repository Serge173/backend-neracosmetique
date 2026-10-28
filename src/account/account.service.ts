import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { deleteStoredImage, storeImage, UploadedImageFile } from '../common/image-storage';
import { Coupon } from '../coupons/entities/coupon.entity';
import { LOYALTY, LOYALTY_TIERS, pointsForAmount, tierFor } from './loyalty';

const IMAGE_SQL = (col: string) =>
  `(select pi.url from product_images pi where pi.product_id = ${col} order by pi.is_primary desc, pi.sort_order asc, pi.id asc limit 1)`;

const ACTIVE_STATUSES = ['pending', 'paid', 'processing', 'shipped'];
const MAX_ADDRESSES = 10;
const MAX_FAVORITES = 200;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function text(value: unknown, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().substring(0, max);
}

type Executor = Pick<EntityManager, 'query'>;

@Injectable()
export class AccountService implements OnModuleInit {
  private readonly logger = new Logger(AccountService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)`);
    } catch (err: any) {
      this.logger.error('Failed to ensure users.avatar_url', err?.message ?? String(err));
    }
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS user_favorites (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, product_id)
        )`);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS user_addresses (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          label VARCHAR(60),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone VARCHAR(30) NOT NULL,
          address_line1 VARCHAR(255) NOT NULL,
          address_line2 VARCHAR(255),
          city VARCHAR(100) NOT NULL,
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id)`);
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS user_loyalty_redemptions (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          coupon_id INTEGER NOT NULL UNIQUE REFERENCES coupons(id) ON DELETE CASCADE,
          points INTEGER NOT NULL CHECK (points > 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_user ON user_loyalty_redemptions(user_id)`);
    } catch (err: any) {
      this.logger.error('Failed to ensure account tables', err?.message ?? String(err));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tableau de bord                                                     */
  /* ------------------------------------------------------------------ */

  async getOverview(userId: string) {
    const [userRows, statRows, lastRows, activeRows, favorites, favCount, address, addrCount, reviewRows, loyalty] = await Promise.all([
      this.dataSource.query(
        `select first_name, last_name, email, phone, created_at from users where id = $1`,
        [userId],
      ),
      this.dataSource.query(
        `select count(*) as total,
                count(*) filter (where status = any($2)) as in_progress,
                count(*) filter (where status = 'delivered') as delivered,
                count(*) filter (where status = 'cancelled') as cancelled,
                coalesce(sum(total) filter (where status <> 'cancelled'), 0) as spent
           from orders where user_id = $1`,
        [userId, ACTIVE_STATUSES],
      ),
      this.dataSource.query(
        `select o.id, o.order_number, o.created_at, o.status, o.total, o.city,
                (select count(*) from order_items oi where oi.order_id = o.id) as items,
                array(select coalesce(oi.product_image_url, ${IMAGE_SQL('oi.product_id')})
                        from order_items oi where oi.order_id = o.id order by oi.id limit 3) as images
           from orders o where o.user_id = $1 order by o.created_at desc limit 1`,
        [userId],
      ),
      this.dataSource.query(
        `select id, order_number, status, updated_at from orders
          where user_id = $1 and status = any($2) order by updated_at desc limit 5`,
        [userId, ACTIVE_STATUSES],
      ),
      this.favoriteRows(userId, 4),
      this.dataSource.query(`select count(*) as n from user_favorites where user_id = $1`, [userId]),
      this.dataSource.query(
        `select * from user_addresses where user_id = $1 order by is_default desc, updated_at desc limit 1`,
        [userId],
      ),
      this.dataSource.query(`select count(*) as n from user_addresses where user_id = $1`, [userId]),
      this.dataSource.query(`select count(*) as n from reviews where user_id = $1`, [userId]),
      this.computeLoyalty(this.dataSource, userId),
    ]);

    const user = userRows[0];
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const s = statRows[0] ?? {};
    const last = lastRows[0];
    const addr = address[0] ? this.mapAddress(address[0]) : null;

    return {
      user: {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        memberSince: user.created_at,
        city: addr?.city ?? last?.city ?? null,
      },
      orders: {
        total: num(s.total),
        inProgress: num(s.in_progress),
        delivered: num(s.delivered),
        cancelled: num(s.cancelled),
        spent: num(s.spent),
      },
      lastOrder: last
        ? {
            id: last.id,
            orderNumber: last.order_number,
            createdAt: last.created_at,
            status: last.status,
            total: num(last.total),
            items: num(last.items),
            images: (last.images ?? []).filter(Boolean),
          }
        : null,
      activeOrders: activeRows.map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        updatedAt: o.updated_at,
      })),
      favorites: { count: num(favCount[0]?.n), items: favorites },
      address: addr,
      addressesCount: num(addrCount[0]?.n),
      reviewsCount: num(reviewRows[0]?.n),
      loyalty: {
        points: loyalty.available,
        value: loyalty.available * LOYALTY.pointValue,
        lifetime: loyalty.lifetime,
        tier: loyalty.tier,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Favoris                                                             */
  /* ------------------------------------------------------------------ */

  private async favoriteRows(userId: string, limit?: number) {
    const rows = await this.dataSource.query(
      `select p.id, p.name, p.slug, p.price, p.promo_price, p.stock_quantity, b.name as brand_name,
              ${IMAGE_SQL('p.id')} as image, f.created_at
         from user_favorites f
         join products p on p.id = f.product_id and p.is_active = true
         left join brands b on b.id = p.brand_id
        where f.user_id = $1
        order by f.created_at desc
        ${limit ? `limit ${Math.floor(limit)}` : ''}`,
      [userId],
    );
    return rows.map((r: any) => ({
      productId: r.id,
      name: r.name,
      slug: r.slug,
      price: num(r.price),
      promoPrice: r.promo_price != null ? num(r.promo_price) : null,
      stock: num(r.stock_quantity),
      brandName: r.brand_name,
      image: r.image,
      addedAt: r.created_at,
    }));
  }

  getFavorites(userId: string) {
    return this.favoriteRows(userId);
  }

  async getFavoriteIds(userId: string): Promise<number[]> {
    const rows = await this.dataSource.query(`select product_id from user_favorites where user_id = $1`, [userId]);
    return rows.map((r: any) => num(r.product_id));
  }

  async addFavorite(userId: string, productId: number) {
    const [product] = await this.dataSource.query(`select id from products where id = $1 and is_active = true`, [productId]);
    if (!product) throw new NotFoundException('Produit introuvable');
    const [count] = await this.dataSource.query(`select count(*) as n from user_favorites where user_id = $1`, [userId]);
    if (num(count?.n) >= MAX_FAVORITES) throw new BadRequestException(`Vous avez atteint la limite de ${MAX_FAVORITES} favoris.`);
    await this.dataSource.query(
      `insert into user_favorites (user_id, product_id) values ($1, $2) on conflict (user_id, product_id) do nothing`,
      [userId, productId],
    );
    return { productId, favorite: true };
  }

  async removeFavorite(userId: string, productId: number) {
    await this.dataSource.query(`delete from user_favorites where user_id = $1 and product_id = $2`, [userId, productId]);
    return { productId, favorite: false };
  }

  /* ------------------------------------------------------------------ */
  /* Adresses                                                            */
  /* ------------------------------------------------------------------ */

  private mapAddress(r: any) {
    return {
      id: r.id,
      label: r.label,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      addressLine1: r.address_line1,
      addressLine2: r.address_line2,
      city: r.city,
      isDefault: r.is_default,
      updatedAt: r.updated_at,
    };
  }

  private parseAddress(body: any, partial: boolean) {
    const out: Record<string, string | null> = {};
    const required: [string, string, number, string][] = [
      ['firstName', 'first_name', 100, 'Le prénom est obligatoire'],
      ['lastName', 'last_name', 100, 'Le nom est obligatoire'],
      ['phone', 'phone', 30, 'Le téléphone est obligatoire'],
      ['addressLine1', 'address_line1', 255, "L'adresse est obligatoire"],
      ['city', 'city', 100, 'La ville est obligatoire'],
    ];
    for (const [key, col, max, message] of required) {
      if (partial && body?.[key] === undefined) continue;
      const value = text(body?.[key], max);
      if (!value) throw new BadRequestException(message);
      out[col] = value;
    }
    if (out.phone && !/^[+0-9 ().-]{6,30}$/.test(out.phone)) throw new BadRequestException('Numéro de téléphone invalide');
    for (const [key, col, max] of [['label', 'label', 60], ['addressLine2', 'address_line2', 255]] as const) {
      if (partial && body?.[key] === undefined) continue;
      out[col] = text(body?.[key], max) || null;
    }
    return out;
  }

  async getAddresses(userId: string) {
    const rows = await this.dataSource.query(
      `select * from user_addresses where user_id = $1 order by is_default desc, updated_at desc`,
      [userId],
    );
    return rows.map((r: any) => this.mapAddress(r));
  }

  async createAddress(userId: string, body: any) {
    const data = this.parseAddress(body, false);
    return this.dataSource.transaction(async (m) => {
      await this.lockUser(m, userId);
      const [count] = await m.query(`select count(*) as n from user_addresses where user_id = $1`, [userId]);
      const n = num(count?.n);
      if (n >= MAX_ADDRESSES) throw new BadRequestException(`Vous pouvez enregistrer jusqu'à ${MAX_ADDRESSES} adresses.`);
      const makeDefault = n === 0 || body?.isDefault === true;
      if (makeDefault) await m.query(`update user_addresses set is_default = false where user_id = $1`, [userId]);
      const [row] = await m.query(
        `insert into user_addresses (user_id, label, first_name, last_name, phone, address_line1, address_line2, city, is_default)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
        [userId, data.label, data.first_name, data.last_name, data.phone, data.address_line1, data.address_line2, data.city, makeDefault],
      );
      return this.mapAddress(row);
    });
  }

  async updateAddress(userId: string, id: number, body: any) {
    const data = this.parseAddress(body, true);
    return this.dataSource.transaction(async (m) => {
      const [existing] = await m.query(`select id from user_addresses where id = $1 and user_id = $2 for update`, [id, userId]);
      if (!existing) throw new NotFoundException('Adresse introuvable');
      if (body?.isDefault === true) await m.query(`update user_addresses set is_default = false where user_id = $1`, [userId]);
      const cols = Object.keys(data);
      const sets = cols.map((c, i) => `${c} = $${i + 3}`);
      if (body?.isDefault === true) sets.push('is_default = true');
      sets.push('updated_at = now()');
      const [row] = await m.query(
        `update user_addresses set ${sets.join(', ')} where id = $1 and user_id = $2 returning *`,
        [id, userId, ...cols.map((c) => data[c])],
      );
      return this.mapAddress(row);
    });
  }

  async deleteAddress(userId: string, id: number) {
    return this.dataSource.transaction(async (m) => {
      const [row] = await m.query(`delete from user_addresses where id = $1 and user_id = $2 returning is_default`, [id, userId]);
      if (!row) throw new NotFoundException('Adresse introuvable');
      if (row.is_default) {
        await m.query(
          `update user_addresses set is_default = true
            where id = (select id from user_addresses where user_id = $1 order by updated_at desc limit 1)`,
          [userId],
        );
      }
      return { deleted: true };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Avis                                                                */
  /* ------------------------------------------------------------------ */

  async getReviews(userId: string) {
    const [reviews, toReview] = await Promise.all([
      this.dataSource.query(
        `select r.id, r.rating, r.title, r.comment, r.is_approved, r.created_at,
                p.id as product_id, p.name, p.slug, ${IMAGE_SQL('p.id')} as image
           from reviews r join products p on p.id = r.product_id
          where r.user_id = $1 order by r.created_at desc`,
        [userId],
      ),
      this.dataSource.query(
        `select p.id as product_id, p.name, p.slug, ${IMAGE_SQL('p.id')} as image, max(o.updated_at) as delivered_at
           from orders o
           join order_items oi on oi.order_id = o.id
           join products p on p.id = oi.product_id and p.is_active = true
          where o.user_id = $1 and o.status = 'delivered'
            and not exists (select 1 from reviews r where r.user_id = $1 and r.product_id = p.id)
          group by p.id order by delivered_at desc limit 50`,
        [userId],
      ),
    ]);
    return {
      reviews: reviews.map((r: any) => ({
        id: r.id,
        rating: num(r.rating),
        title: r.title,
        comment: r.comment,
        isApproved: r.is_approved,
        createdAt: r.created_at,
        product: { id: r.product_id, name: r.name, slug: r.slug, image: r.image },
      })),
      toReview: toReview.map((r: any) => ({
        productId: r.product_id,
        name: r.name,
        slug: r.slug,
        image: r.image,
        deliveredAt: r.delivered_at,
      })),
    };
  }

  async createReview(userId: string, body: any) {
    const productId = Number(body?.productId);
    const rating = Number(body?.rating);
    if (!Number.isInteger(productId) || productId <= 0) throw new BadRequestException('Produit invalide');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('La note doit être comprise entre 1 et 5');
    const title = text(body?.title, 150) || null;
    const comment = String(body?.comment ?? '').trim().substring(0, 2000) || null;
    if (!comment || comment.length < 10) throw new BadRequestException('Votre avis doit contenir au moins 10 caractères');

    return this.dataSource.transaction(async (m) => {
      await this.lockUser(m, userId);
      const [order] = await m.query(
        `select o.id from orders o join order_items oi on oi.order_id = o.id
          where o.user_id = $1 and o.status = 'delivered' and oi.product_id = $2
          order by o.updated_at desc limit 1`,
        [userId, productId],
      );
      if (!order) throw new BadRequestException('Vous pouvez donner votre avis uniquement sur un produit acheté et livré.');
      const [exists] = await m.query(`select id from reviews where user_id = $1 and product_id = $2`, [userId, productId]);
      if (exists) throw new ConflictException('Vous avez déjà donné votre avis sur ce produit.');
      const [row] = await m.query(
        `insert into reviews (product_id, user_id, order_id, rating, title, comment, is_approved, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, false, now(), now()) returning id, created_at`,
        [productId, userId, order.id, rating, title, comment],
      );
      return { id: row.id, createdAt: row.created_at, isApproved: false };
    });
  }

  async deleteReview(userId: string, id: number) {
    const rows = await this.dataSource.query(`delete from reviews where id = $1 and user_id = $2 returning id`, [id, userId]);
    if (!rows.length) throw new NotFoundException('Avis introuvable');
    return { deleted: true };
  }

  /* ------------------------------------------------------------------ */
  /* Fidélité                                                            */
  /* ------------------------------------------------------------------ */

  private async computeLoyalty(db: Executor, userId: string) {
    const [userRows, earnedRows, spentRows] = await Promise.all([
      db.query(`select role, created_at from users where id = $1`, [userId]),
      db.query(
        `select id, order_number, updated_at, greatest(subtotal - discount_amount, 0) as amount
           from orders where user_id = $1 and status = 'delivered' order by updated_at desc`,
        [userId],
      ),
      db.query(
        `select coalesce(sum(r.points), 0) as points
           from user_loyalty_redemptions r join coupons c on c.id = r.coupon_id
          where r.user_id = $1
            and (c.used_count > 0 or (c.is_active and (c.valid_to is null or c.valid_to > now())))`,
        [userId],
      ),
    ]);
    const history: { type: 'order' | 'welcome'; orderId: string | null; orderNumber: string | null; date: string; amount: number; points: number }[] =
      earnedRows.map((o: any) => ({
        type: 'order' as const,
        orderId: o.id,
        orderNumber: o.order_number,
        date: o.updated_at,
        amount: num(o.amount),
        points: pointsForAmount(num(o.amount)),
      }));
    const user = userRows[0];
    if (user && user.role === 'customer' && LOYALTY.welcomeBonus > 0) {
      history.push({ type: 'welcome', orderId: null, orderNumber: null, date: user.created_at, amount: 0, points: LOYALTY.welcomeBonus });
    }
    const lifetime = history.reduce((sum: number, h: any) => sum + h.points, 0);
    const spent = num(spentRows[0]?.points);
    return { lifetime, available: Math.max(0, lifetime - spent), spent, history, tier: tierFor(lifetime) };
  }

  async getLoyalty(userId: string) {
    const [loyalty, vouchers] = await Promise.all([
      this.computeLoyalty(this.dataSource, userId),
      this.dataSource.query(
        `select c.code, c.value, c.used_count, c.valid_to, c.is_active, r.points, r.created_at
           from user_loyalty_redemptions r join coupons c on c.id = r.coupon_id
          where r.user_id = $1 order by r.created_at desc limit 50`,
        [userId],
      ),
    ]);
    const now = Date.now();
    return {
      points: loyalty.available,
      value: loyalty.available * LOYALTY.pointValue,
      lifetime: loyalty.lifetime,
      tier: loyalty.tier,
      tiers: LOYALTY_TIERS,
      rules: LOYALTY,
      history: loyalty.history.filter((h: any) => h.points > 0).slice(0, 50),
      vouchers: vouchers.map((v: any) => {
        const expired = v.valid_to && new Date(v.valid_to).getTime() <= now;
        const state = num(v.used_count) > 0 ? 'used' : !v.is_active ? 'disabled' : expired ? 'expired' : 'active';
        return {
          code: v.code,
          value: num(v.value),
          points: num(v.points),
          validTo: v.valid_to,
          createdAt: v.created_at,
          state,
        };
      }),
    };
  }

  async redeemPoints(userId: string, body: any) {
    const points = Number(body?.points);
    if (!Number.isInteger(points) || points < LOYALTY.minRedeem || points % LOYALTY.redeemStep !== 0) {
      throw new BadRequestException(
        LOYALTY.redeemStep > 1
          ? `Choisissez un nombre de points multiple de ${LOYALTY.redeemStep} (minimum ${LOYALTY.minRedeem}).`
          : `Choisissez un nombre entier de points (minimum ${LOYALTY.minRedeem}).`,
      );
    }
    return this.dataSource.transaction(async (m) => {
      await this.lockUser(m, userId);
      const loyalty = await this.computeLoyalty(m, userId);
      if (points > loyalty.available) throw new BadRequestException("Vous n'avez pas assez de points.");

      const validTo = new Date(Date.now() + LOYALTY.voucherValidityDays * 86400000);
      let coupon: Coupon | null = null;
      for (let attempt = 0; attempt < 5 && !coupon; attempt++) {
        const code = 'NERA-' + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
        const [taken] = await m.query(`select 1 from coupons where code = $1`, [code]);
        if (taken) continue;
        coupon = await m.save(
          m.create(Coupon, {
            code,
            type: 'fixed',
            value: points * LOYALTY.pointValue,
            minOrderAmount: null,
            maxUses: 1,
            usedCount: 0,
            validFrom: new Date(),
            validTo,
            isActive: true,
          }),
        );
      }
      if (!coupon) throw new ConflictException('Impossible de générer un bon, réessayez.');
      await m.query(`insert into user_loyalty_redemptions (user_id, coupon_id, points) values ($1, $2, $3)`, [
        userId,
        coupon.id,
        points,
      ]);
      return {
        code: coupon.code,
        value: num(coupon.value),
        points,
        validTo,
        remaining: loyalty.available - points,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Photo de profil                                                     */
  /* ------------------------------------------------------------------ */

  async setAvatar(userId: string, file: UploadedImageFile | undefined, localBaseUrl: string) {
    const [user] = await this.dataSource.query(`select avatar_url from users where id = $1`, [userId]);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const avatarUrl = await storeImage(file, 'avatars', localBaseUrl, '2 Mo');
    await this.dataSource.query(`update users set avatar_url = $2, updated_at = now() where id = $1`, [userId, avatarUrl]);
    await deleteStoredImage(user.avatar_url, 'avatars');
    return { avatarUrl };
  }

  async removeAvatar(userId: string) {
    const [user] = await this.dataSource.query(`select avatar_url from users where id = $1`, [userId]);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.avatar_url) {
      await this.dataSource.query(`update users set avatar_url = null, updated_at = now() where id = $1`, [userId]);
      await deleteStoredImage(user.avatar_url, 'avatars');
    }
    return { avatarUrl: null };
  }

  private async lockUser(m: EntityManager, userId: string) {
    const [row] = await m.query(`select id from users where id = $1 for update`, [userId]);
    if (!row) throw new NotFoundException('Utilisateur introuvable');
  }
}
