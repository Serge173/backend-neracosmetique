import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Coupon } from '../coupons/entities/coupon.entity';
import { Review } from '../reviews/entities/review.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { DeliveryZone } from '../orders/entities/delivery-zone.entity';

const DAY_MS = 86_400_000;
const ALLOWED_PERIODS = [7, 30, 90, 365];
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const PRODUCT_IMAGE_SQL = `(select pi.url from product_images pi where pi.product_id = %s order by pi.is_primary desc, pi.sort_order asc, pi.id asc limit 1)`;

function productImage(column: string): string {
  return PRODUCT_IMAGE_SQL.replace('%s', column);
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function cleanText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.substring(0, max) : null;
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Date invalide : ${field}`);
  return d;
}

function parseOptionalNumber(value: unknown, field: string, { min = 0, integer = false } = {}): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) {
    throw new BadRequestException(`Valeur invalide : ${field}`);
  }
  return n;
}

@Injectable()
export class AdminInsightsService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(Coupon) private couponRepository: Repository<Coupon>,
    @InjectRepository(Review) private reviewRepository: Repository<Review>,
    @InjectRepository(NewsletterSubscriber) private newsletterRepository: Repository<NewsletterSubscriber>,
    @InjectRepository(DeliveryZone) private deliveryZoneRepository: Repository<DeliveryZone>,
  ) {}

  private query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.dataSource.query(sql, params);
  }

  // ---------- Tableau de bord & rapports ----------

  async getDashboard(daysParam?: string, topLimitParam?: string) {
    const requested = Number(daysParam);
    const days = ALLOWED_PERIODS.includes(requested) ? requested : 7;
    const topLimit = Math.min(Math.max(Number(topLimitParam) || 5, 1), 20);
    const monthly = days > 90;

    const today = new Date();
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const start = new Date(todayStart - (days - 1) * DAY_MS);
    const prevStart = new Date(start.getTime() - days * DAY_MS);
    const bucket = monthly ? 'month' : 'day';
    const bucketFormat = monthly ? 'YYYY-MM' : 'YYYY-MM-DD';

    const [
      series,
      previous,
      customersSeries,
      customersPrev,
      customersTotal,
      unitsSeries,
      stock,
      categories,
      recentOrders,
      topProducts,
      byStatus,
      byPayment,
      hero,
    ] = await Promise.all([
      this.query(
        `select to_char(date_trunc('${bucket}', created_at), '${bucketFormat}') as k,
                coalesce(sum(total), 0) as total, count(*) as orders
           from orders where status <> 'cancelled' and created_at >= $1
          group by 1`,
        [start],
      ),
      this.query(
        `select coalesce(sum(total), 0) as total, count(*) as orders
           from orders where status <> 'cancelled' and created_at >= $1 and created_at < $2`,
        [prevStart, start],
      ),
      this.query(
        `select to_char(date_trunc('${bucket}', created_at), '${bucketFormat}') as k, count(*) as n
           from users where role = 'customer' and created_at >= $1 group by 1`,
        [start],
      ),
      this.query(
        `select count(*) as n from users where role = 'customer' and created_at >= $1 and created_at < $2`,
        [prevStart, start],
      ),
      this.query(`select count(*) as n from users where role = 'customer'`),
      this.query(
        `select to_char(date_trunc('${bucket}', o.created_at), '${bucketFormat}') as k, coalesce(sum(oi.quantity), 0) as n
           from order_items oi join orders o on o.id = oi.order_id
          where o.status <> 'cancelled' and o.created_at >= $1 group by 1`,
        [start],
      ),
      this.query(
        `select count(*) filter (where stock_quantity > 0) as in_stock,
                count(*) filter (where stock_quantity <= 0) as out_of_stock,
                count(*) filter (where stock_quantity > 0 and stock_quantity < 5) as low_stock,
                coalesce(sum(greatest(stock_quantity, 0)), 0) as units
           from products where is_active = true`,
      ),
      this.query(
        `select c.id, c.name, coalesce(sum(oi.total_price), 0) as total
           from order_items oi
           join orders o on o.id = oi.order_id
           join products p on p.id = oi.product_id
           join categories c on c.id = p.category_id
          where o.status <> 'cancelled' and o.created_at >= $1
          group by c.id, c.name order by total desc`,
        [start],
      ),
      this.query(
        `select o.id, o.order_number, o.created_at, o.total, o.status, o.first_name, o.last_name,
                (select coalesce(oi.product_image_url, ${productImage('oi.product_id')})
                   from order_items oi where oi.order_id = o.id order by oi.id limit 1) as image,
                (select count(*) from order_items oi where oi.order_id = o.id) as items
           from orders o order by o.created_at desc limit 8`,
      ),
      this.query(
        `select oi.product_id, max(oi.product_name) as name, sum(oi.quantity) as quantity,
                coalesce(sum(oi.total_price), 0) as revenue,
                coalesce(${productImage('oi.product_id')}, max(oi.product_image_url)) as image
           from order_items oi join orders o on o.id = oi.order_id
          where o.status <> 'cancelled' and o.created_at >= $1
          group by oi.product_id order by quantity desc, revenue desc limit ${topLimit}`,
        [topLimitParam ? start : new Date(0)],
      ),
      this.query(
        `select status, count(*) as n, coalesce(sum(total), 0) as total
           from orders where created_at >= $1 group by status`,
        [start],
      ),
      this.query(
        `select payment_method as method, count(*) as n, coalesce(sum(total), 0) as total
           from orders where status <> 'cancelled' and created_at >= $1 group by payment_method order by total desc`,
        [start],
      ),
      this.query(
        `select p.name, ${productImage('p.id')} as image
           from products p where p.is_active = true and ${productImage('p.id')} is not null
          order by p.is_featured desc, p.updated_at desc limit 1`,
      ),
    ]);

    const keys: string[] = [];
    const labels: string[] = [];
    if (monthly) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
        keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
        labels.push(`${MONTHS_FR[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`);
      }
    } else {
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * DAY_MS);
        keys.push(d.toISOString().slice(0, 10));
        labels.push(`${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]}`);
      }
    }
    const indexBy = (rows: any[], field: string) =>
      new Map(rows.map((r) => [r.k, toNumber(r[field])]));
    const salesMap = indexBy(series, 'total');
    const ordersMap = indexBy(series, 'orders');
    const customersMap = indexBy(customersSeries, 'n');
    const unitsMap = indexBy(unitsSeries, 'n');

    const salesSeries = keys.map((k, i) => ({
      key: k,
      label: labels[i],
      total: salesMap.get(k) ?? 0,
      orders: ordersMap.get(k) ?? 0,
    }));

    const salesTotal = salesSeries.reduce((s, p) => s + p.total, 0);
    const ordersTotal = salesSeries.reduce((s, p) => s + p.orders, 0);
    const newCustomers = keys.reduce((s, k) => s + (customersMap.get(k) ?? 0), 0);
    const prevSales = toNumber(previous[0]?.total);
    const prevOrders = toNumber(previous[0]?.orders);
    const prevCustomers = toNumber(customersPrev[0]?.n);

    const sparkKeys = keys.slice(-Math.min(keys.length, 12));
    const spark = (map: Map<string, number>) => sparkKeys.map((k) => map.get(k) ?? 0);

    const categoriesTotal = categories.reduce((s: number, c: any) => s + toNumber(c.total), 0);

    return {
      period: { days, from: start.toISOString(), monthly },
      kpis: {
        sales: { value: salesTotal, change: percentChange(salesTotal, prevSales), spark: spark(salesMap) },
        orders: { value: ordersTotal, change: percentChange(ordersTotal, prevOrders), spark: spark(ordersMap) },
        customers: {
          value: toNumber(customersTotal[0]?.n),
          newInPeriod: newCustomers,
          change: percentChange(newCustomers, prevCustomers),
          spark: spark(customersMap),
        },
        stock: {
          value: toNumber(stock[0]?.in_stock),
          units: toNumber(stock[0]?.units),
          outOfStock: toNumber(stock[0]?.out_of_stock),
          lowStock: toNumber(stock[0]?.low_stock),
          spark: spark(unitsMap),
        },
        averageOrder: ordersTotal > 0 ? salesTotal / ordersTotal : 0,
      },
      salesSeries,
      categories: categories.map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        total: toNumber(c.total),
        percent: categoriesTotal > 0 ? Math.round((toNumber(c.total) / categoriesTotal) * 1000) / 10 : 0,
      })),
      recentOrders: recentOrders.map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        createdAt: o.created_at,
        total: toNumber(o.total),
        status: o.status,
        customer: `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim(),
        image: o.image,
        items: toNumber(o.items),
      })),
      topProducts: topProducts.map((p: any) => ({
        productId: Number(p.product_id),
        name: p.name,
        quantity: toNumber(p.quantity),
        revenue: toNumber(p.revenue),
        image: p.image,
      })),
      byStatus: byStatus.map((s: any) => ({ status: s.status, count: toNumber(s.n), total: toNumber(s.total) })),
      byPayment: byPayment.map((p: any) => ({ method: p.method, count: toNumber(p.n), total: toNumber(p.total) })),
      hero: hero[0] ? { name: hero[0].name, image: hero[0].image } : null,
    };
  }

  async getSummary() {
    const [row] = await this.query(
      `select (select count(*) from orders where status = 'pending') as pending_orders,
              (select count(*) from contact_messages where read = false) as unread_messages,
              (select count(*) from reviews where is_approved = false) as pending_reviews,
              (select count(*) from products where is_active = true and stock_quantity < 5) as low_stock`,
    );
    return {
      pendingOrders: toNumber(row?.pending_orders),
      unreadMessages: toNumber(row?.unread_messages),
      pendingReviews: toNumber(row?.pending_reviews),
      lowStock: toNumber(row?.low_stock),
    };
  }

  async search(qParam?: string) {
    const q = String(qParam ?? '').trim().substring(0, 80);
    if (q.length < 2) return { products: [], orders: [], customers: [] };
    const like = likePattern(q);
    const [products, orders, customers] = await Promise.all([
      this.query(
        `select p.id, p.name, p.price, p.stock_quantity as stock, ${productImage('p.id')} as image
           from products p where p.name ilike $1 or p.slug ilike $1 order by p.name limit 5`,
        [like],
      ),
      this.query(
        `select id, order_number, total, status, first_name, last_name, created_at
           from orders
          where order_number ilike $1 or email ilike $1 or first_name ilike $1 or last_name ilike $1
             or (first_name || ' ' || last_name) ilike $1 or phone ilike $1
          order by created_at desc limit 5`,
        [like],
      ),
      this.query(
        `select id, email, first_name, last_name, phone from users
          where role = 'customer' and (email ilike $1 or first_name ilike $1 or last_name ilike $1
             or (first_name || ' ' || last_name) ilike $1 or phone ilike $1)
          order by created_at desc limit 5`,
        [like],
      ),
    ]);
    return {
      products: products.map((p: any) => ({ id: Number(p.id), name: p.name, price: toNumber(p.price), stock: toNumber(p.stock), image: p.image })),
      orders: orders.map((o: any) => ({
        id: o.id, orderNumber: o.order_number, total: toNumber(o.total), status: o.status,
        customer: `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim(), createdAt: o.created_at,
      })),
      customers: customers.map((c: any) => ({
        id: c.id, email: c.email, name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(), phone: c.phone,
      })),
    };
  }

  // ---------- Clients ----------

  async getCustomers(searchParam?: string) {
    const q = String(searchParam ?? '').trim().substring(0, 80);
    const params: unknown[] = [];
    let filter = '';
    if (q) {
      params.push(likePattern(q));
      filter = `and (u.email ilike $1 or u.first_name ilike $1 or u.last_name ilike $1
                 or (u.first_name || ' ' || u.last_name) ilike $1 or u.phone ilike $1)`;
    }
    const rows = await this.query(
      `select u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.created_at,
              count(o.id) as orders_count,
              coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) as total_spent,
              max(o.created_at) as last_order_at
         from users u
         left join orders o on o.user_id = u.id or lower(o.email) = lower(u.email)
        where u.role = 'customer' ${filter}
        group by u.id
        order by u.created_at desc
        limit 500`,
      params,
    );
    return rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      isActive: r.is_active,
      createdAt: r.created_at,
      ordersCount: toNumber(r.orders_count),
      totalSpent: toNumber(r.total_spent),
      lastOrderAt: r.last_order_at,
    }));
  }

  async getCustomer(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Client introuvable');
    const [user] = await this.query(
      `select id, email, first_name, last_name, phone, is_active, role, created_at from users where id = $1`,
      [id],
    );
    if (!user) throw new NotFoundException('Client introuvable');
    const orders = await this.query(
      `select id, order_number, created_at, total, status, payment_method, city, address_line1,
              (select count(*) from order_items oi where oi.order_id = o.id) as items
         from orders o where o.user_id = $1 or lower(o.email) = lower($2)
        order by created_at desc limit 50`,
      [id, user.email],
    );
    const valid = orders.filter((o: any) => o.status !== 'cancelled');
    const totalSpent = valid.reduce((s: number, o: any) => s + toNumber(o.total), 0);
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      isActive: user.is_active,
      createdAt: user.created_at,
      stats: {
        ordersCount: orders.length,
        totalSpent,
        averageOrder: valid.length ? totalSpent / valid.length : 0,
        lastAddress: orders[0] ? `${orders[0].address_line1 ?? ''}, ${orders[0].city ?? ''}`.replace(/^, |, $/g, '') : null,
      },
      orders: orders.map((o: any) => ({
        id: o.id, orderNumber: o.order_number, createdAt: o.created_at, total: toNumber(o.total),
        status: o.status, paymentMethod: o.payment_method, items: toNumber(o.items),
      })),
    };
  }

  // ---------- Codes promo ----------

  getCoupons() {
    return this.couponRepository.find({ order: { createdAt: 'DESC' } });
  }

  private buildCoupon(body: any, partial: boolean): Partial<Coupon> {
    const data: Partial<Coupon> = {};
    if (!partial || body.code !== undefined) {
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
        throw new BadRequestException('Code invalide : 3 à 30 caractères (lettres, chiffres, - ou _)');
      }
      data.code = code;
    }
    if (!partial || body.type !== undefined) {
      if (body.type !== 'percent' && body.type !== 'fixed') throw new BadRequestException('Type de réduction invalide');
      data.type = body.type;
    }
    if (!partial || body.value !== undefined) {
      const value = parseOptionalNumber(body.value, 'valeur');
      if (value === null || value <= 0) throw new BadRequestException('La valeur de la réduction doit être positive');
      data.value = value;
    }
    if (body.minOrderAmount !== undefined) data.minOrderAmount = parseOptionalNumber(body.minOrderAmount, 'montant minimum');
    if (body.maxUses !== undefined) data.maxUses = parseOptionalNumber(body.maxUses, 'utilisations max', { min: 1, integer: true });
    if (body.validFrom !== undefined) data.validFrom = parseOptionalDate(body.validFrom, 'début');
    if (body.validTo !== undefined) data.validTo = parseOptionalDate(body.validTo, 'fin');
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    return data;
  }

  private assertCouponCoherent(c: Partial<Coupon>) {
    if (c.type === 'percent' && Number(c.value) > 100) throw new BadRequestException('Un pourcentage ne peut pas dépasser 100 %');
    if (c.validFrom && c.validTo && new Date(c.validFrom) > new Date(c.validTo)) {
      throw new BadRequestException('La date de fin doit être après la date de début');
    }
  }

  async createCoupon(body: any) {
    const data = this.buildCoupon(body, false);
    this.assertCouponCoherent(data);
    if (await this.couponRepository.findOne({ where: { code: data.code } })) {
      throw new BadRequestException('Ce code existe déjà');
    }
    return this.couponRepository.save(this.couponRepository.create(data));
  }

  async updateCoupon(id: number, body: any) {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Code promo introuvable');
    const data = this.buildCoupon(body, true);
    if (data.code && data.code !== coupon.code && (await this.couponRepository.findOne({ where: { code: data.code } }))) {
      throw new BadRequestException('Ce code existe déjà');
    }
    const merged = { ...coupon, ...data };
    this.assertCouponCoherent(merged);
    return this.couponRepository.save(merged);
  }

  async deleteCoupon(id: number) {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Code promo introuvable');
    await this.couponRepository.update(id, { isActive: false });
    const [used] = await this.query(`select count(*) as n from orders where coupon_id = $1`, [id]);
    if (toNumber(used?.n) === 0) await this.couponRepository.delete(id);
    return { success: true };
  }

  // ---------- Avis ----------

  async getReviews(status?: string) {
    const where = status === 'pending' ? 'where r.is_approved = false' : status === 'approved' ? 'where r.is_approved = true' : '';
    const rows = await this.query(
      `select r.id, r.rating, r.title, r.comment, r.is_approved, r.created_at,
              p.id as product_id, p.name as product_name, ${productImage('p.id')} as product_image,
              u.first_name, u.last_name, u.email
         from reviews r
         join products p on p.id = r.product_id
         join users u on u.id = r.user_id
         ${where}
        order by r.created_at desc limit 300`,
    );
    return rows.map((r: any) => ({
      id: Number(r.id),
      rating: toNumber(r.rating),
      title: r.title,
      comment: r.comment,
      isApproved: r.is_approved,
      createdAt: r.created_at,
      product: { id: Number(r.product_id), name: r.product_name, image: r.product_image },
      author: { name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(), email: r.email },
    }));
  }

  async setReviewApproval(id: number, isApproved: unknown) {
    if (typeof isApproved !== 'boolean') throw new BadRequestException('Valeur isApproved attendue');
    const res = await this.reviewRepository.update(id, { isApproved });
    if (!res.affected) throw new NotFoundException('Avis introuvable');
    return { success: true };
  }

  async deleteReview(id: number) {
    const res = await this.reviewRepository.delete(id);
    if (!res.affected) throw new NotFoundException('Avis introuvable');
    return { success: true };
  }

  // ---------- Newsletter ----------

  getNewsletter() {
    return this.newsletterRepository.find({ order: { createdAt: 'DESC' } });
  }

  async deleteSubscriber(id: number) {
    const res = await this.newsletterRepository.delete(id);
    if (!res.affected) throw new NotFoundException('Abonné introuvable');
    return { success: true };
  }

  // ---------- Zones de livraison ----------

  getDeliveryZones() {
    return this.deliveryZoneRepository.find({ order: { price: 'ASC', name: 'ASC' } });
  }

  private buildZone(body: any, partial: boolean): Partial<DeliveryZone> {
    const data: Partial<DeliveryZone> = {};
    if (!partial || body.name !== undefined) {
      const name = cleanText(body.name, 120);
      if (!name) throw new BadRequestException('Le nom de la zone est obligatoire');
      data.name = name;
    }
    if (body.description !== undefined) data.description = cleanText(body.description, 500);
    if (!partial || body.price !== undefined) data.price = parseOptionalNumber(body.price, 'prix') ?? 0;
    if (body.minOrderFreeDelivery !== undefined) data.minOrderFreeDelivery = parseOptionalNumber(body.minOrderFreeDelivery, 'livraison offerte dès');
    if (body.estimatedDaysMin !== undefined) data.estimatedDaysMin = parseOptionalNumber(body.estimatedDaysMin, 'délai min', { integer: true });
    if (body.estimatedDaysMax !== undefined) data.estimatedDaysMax = parseOptionalNumber(body.estimatedDaysMax, 'délai max', { integer: true });
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    return data;
  }

  createDeliveryZone(body: any) {
    return this.deliveryZoneRepository.save(this.deliveryZoneRepository.create(this.buildZone(body, false)));
  }

  async updateDeliveryZone(id: number, body: any) {
    const zone = await this.deliveryZoneRepository.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone introuvable');
    return this.deliveryZoneRepository.save({ ...zone, ...this.buildZone(body, true) });
  }

  async deleteDeliveryZone(id: number) {
    const zone = await this.deliveryZoneRepository.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone introuvable');
    const [used] = await this.query(`select count(*) as n from orders where delivery_zone_id = $1`, [id]);
    if (toNumber(used?.n) > 0) {
      await this.deliveryZoneRepository.update(id, { isActive: false });
      return { success: true, deactivated: true };
    }
    await this.deliveryZoneRepository.delete(id);
    return { success: true };
  }
}
