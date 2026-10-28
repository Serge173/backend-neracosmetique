import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { DeliveryZone } from './entities/delivery-zone.entity';
import { v4 as uuidv4 } from 'uuid';
import { computeCouponDiscount } from '../coupons/coupon-discount';

const SAFE_PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400?text=Produit';

const PAYMENT_METHODS = ['cash_on_delivery'];

/** Tarifs de secours si la zone de livraison correspondante est absente ou désactivée. */
const DELIVERY_METHODS: Record<string, { zoneId: number; price: number }> = {
  abidjan: { zoneId: 1, price: 1500 },
  interior: { zoneId: 2, price: 3000 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(DeliveryZone)
    private deliveryZoneRepository: Repository<DeliveryZone>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Sécurise les colonnes infos produit sur order_items même si la migration SQL n'a pas été exécutée manuellement.
    try {
      await this.orderItemRepository.query(`
        ALTER TABLE order_items
          ADD COLUMN IF NOT EXISTS product_short_description TEXT,
          ADD COLUMN IF NOT EXISTS product_brand_name VARCHAR(100)
      `);
      this.logger.log('order_items product info columns are present.');
    } catch (err: any) {
      this.logger.error(
        'Failed to ensure order_items product info columns',
        err?.message ?? String(err),
      );
    }
  }

  /**
   * Les montants (prix, livraison, réduction, total) sont toujours recalculés ici :
   * seuls les identifiants produits, quantités, mode de livraison et code promo du client sont pris en compte.
   */
  async create(userId: string | null, orderData: any): Promise<Order> {
    const timestampPart = Date.now().toString().slice(-8);
    const uuidPart = uuidv4().replace(/-/g, '').substring(0, 4).toUpperCase();
    const orderNumber = `NERA-${timestampPart}-${uuidPart}`.substring(0, 20);

    const customer = this.parseCustomer(orderData);
    const lines = this.parseLines(orderData?.items);
    const products = await this.loadProducts(lines.map((l) => l.productId));

    const itemsData: Partial<OrderItem>[] = lines.map(({ productId, quantity }) => {
      const p = products.get(productId);
      if (!p) throw new BadRequestException("Un produit de votre panier n'est plus disponible. Mettez votre panier à jour.");
      if (p.stock < quantity) {
        throw new BadRequestException(
          p.stock > 0 ? `Stock insuffisant pour « ${p.name} » (${p.stock} disponible(s)).` : `« ${p.name} » est en rupture de stock.`,
        );
      }
      return {
        productId,
        productName: p.name.substring(0, 240),
        productSlug: p.slug.substring(0, 240),
        quantity,
        unitPrice: p.unitPrice,
        totalPrice: round2(p.unitPrice * quantity),
        productImageUrl: p.image ? (/bing\.com|blogspot\.com/i.test(p.image) ? SAFE_PLACEHOLDER_IMAGE : p.image.substring(0, 240)) : null,
        productShortDescription: p.shortDescription ? p.shortDescription.substring(0, 500) : null,
        productBrandName: p.brandName ? p.brandName.substring(0, 100) : null,
      };
    });
    const subtotal = round2(itemsData.reduce((sum, it) => sum + Number(it.totalPrice), 0));

    const { deliveryZoneId, deliveryMethod, shippingAmount } = await this.resolveDelivery(orderData, subtotal);
    const couponCode = String(orderData?.couponCode ?? '').trim().toUpperCase().substring(0, 40);

    try {
      const orderId = uuidv4();
      await this.orderRepository.manager.transaction(async (manager) => {
        let discountAmount = 0;
        let couponId: number | null = null;
        if (couponCode) {
          const applied = await this.applyCoupon(manager, couponCode, subtotal, userId);
          discountAmount = applied.discount;
          couponId = applied.couponId;
        }
        const order = manager.create(Order, {
          id: orderId,
          ...customer,
          deliveryZoneId,
          deliveryMethod,
          subtotal,
          shippingAmount,
          discountAmount,
          couponId,
          total: round2(Math.max(0, subtotal + shippingAmount - discountAmount)),
          userId: userId ?? null,
          orderNumber,
          status: 'pending',
          paymentStatus: 'pending',
        });
        await manager.save(Order, order);
        await manager.save(
          OrderItem,
          itemsData.map((data) => manager.create(OrderItem, { ...data, orderId })),
        );
      });

      return this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items'],
      }) as Promise<Order>;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Order create failed', err?.message, err?.stack);
      const msg = err?.message || String(err);
      if (err?.code === '22001' || err?.code === 'ER_DATA_TOO_LONG' || msg.includes('Data too long')) {
        throw new BadRequestException('Une donnée dépasse la limite autorisée. Vérifiez vos informations.');
      }
      if (err?.code === '23503' || err?.code === 'ER_NO_REFERENCED_ROW' || msg.includes('foreign key')) {
        throw new BadRequestException('Référence invalide (zone de livraison ou produit). Vérifiez le panier.');
      }
      throw new BadRequestException('Impossible de créer la commande. Vérifiez vos informations.');
    }
  }

  private parseCustomer(data: any) {
    const field = (key: string, max: number, label: string, required = true) => {
      const value = String(data?.[key] ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
      if (required && !value) throw new BadRequestException(`${label} est obligatoire.`);
      if (value.length > max) throw new BadRequestException(`${label} est trop long (${max} caractères maximum).`);
      return value || null;
    };
    const customer = {
      firstName: field('firstName', 100, 'Le nom'),
      lastName: field('lastName', 100, 'Le prénom'),
      email: field('email', 180, "L'e-mail").toLowerCase(),
      phone: field('phone', 30, 'Le téléphone'),
      addressLine1: field('addressLine1', 240, "L'adresse"),
      addressLine2: field('addressLine2', 240, "Le complément d'adresse", false),
      city: field('city', 100, 'La ville'),
      postalCode: field('postalCode', 20, 'Le code postal', false),
      paymentMethod: String(data?.paymentMethod ?? 'cash_on_delivery').trim(),
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new BadRequestException('Adresse e-mail invalide.');
    if (!/^[+0-9 ().-]{6,30}$/.test(customer.phone)) throw new BadRequestException('Numéro de téléphone invalide.');
    if (!PAYMENT_METHODS.includes(customer.paymentMethod)) throw new BadRequestException('Mode de paiement indisponible.');
    return customer;
  }

  private parseLines(items: unknown): { productId: number; quantity: number }[] {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('Votre panier est vide.');
    if (items.length > 50) throw new BadRequestException('Trop d’articles différents dans une même commande.');
    const merged = new Map<number, number>();
    for (const it of items) {
      const productId = Number(it?.productId);
      const quantity = Number(it?.quantity);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new BadRequestException('Un article du panier est invalide.');
      }
      merged.set(productId, (merged.get(productId) ?? 0) + quantity);
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  }

  private async loadProducts(ids: number[]) {
    const rows = await this.orderRepository.query(
      `select p.id, p.name, p.slug, p.price, p.promo_price, p.stock_quantity, p.short_description, b.name as brand_name,
              (select pi.url from product_images pi where pi.product_id = p.id
                order by pi.is_primary desc, pi.sort_order asc, pi.id asc limit 1) as image
         from products p left join brands b on b.id = p.brand_id
        where p.id = any($1) and p.is_active = true`,
      [ids],
    );
    const map = new Map<number, { name: string; slug: string; unitPrice: number; stock: number; image: string | null; shortDescription: string | null; brandName: string | null }>();
    for (const r of rows) {
      const promo = r.promo_price != null ? Number(r.promo_price) : null;
      const unitPrice = promo != null && promo > 0 ? promo : Number(r.price);
      map.set(Number(r.id), {
        name: String(r.name),
        slug: String(r.slug ?? ''),
        unitPrice: round2(unitPrice),
        stock: Number(r.stock_quantity) || 0,
        image: r.image ?? null,
        shortDescription: r.short_description ?? null,
        brandName: r.brand_name ?? null,
      });
    }
    return map;
  }

  async getDeliveryOptions() {
    const zones = await this.deliveryZoneRepository.find({
      where: Object.values(DELIVERY_METHODS).map((m) => ({ id: m.zoneId, isActive: true })),
    });
    return Object.entries(DELIVERY_METHODS).map(([method, fallback]) => {
      const zone = zones.find((z) => z.id === fallback.zoneId);
      return {
        method,
        price: round2(zone ? Number(zone.price) : fallback.price),
        freeFrom: zone?.minOrderFreeDelivery != null ? Number(zone.minOrderFreeDelivery) : null,
      };
    });
  }

  private async resolveDelivery(data: any, subtotal: number) {
    const method = String(data?.deliveryMethod ?? '').trim();
    const fallback = DELIVERY_METHODS[method];
    if (!fallback) throw new BadRequestException('Choisissez un mode de livraison.');
    const zone = await this.deliveryZoneRepository.findOne({ where: { id: fallback.zoneId, isActive: true } });
    const free = zone?.minOrderFreeDelivery != null && subtotal >= Number(zone.minOrderFreeDelivery);
    return {
      deliveryMethod: method,
      deliveryZoneId: zone ? zone.id : null,
      shippingAmount: free ? 0 : round2(zone ? Number(zone.price) : fallback.price),
    };
  }

  /** Valide et consomme un code promo dans la transaction de la commande. */
  private async applyCoupon(manager: EntityManager, code: string, subtotal: number, userId: string | null) {
    const [coupon] = await manager.query(
      `select id, type, value, min_order_amount, max_uses, used_count, valid_from, valid_to
         from coupons where code = $1 and is_active = true for update`,
      [code],
    );
    if (!coupon) throw new BadRequestException('Code promo invalide.');
    const now = Date.now();
    if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) throw new BadRequestException("Ce code promo n'est pas encore valide.");
    if (coupon.valid_to && new Date(coupon.valid_to).getTime() < now) throw new BadRequestException('Ce code promo a expiré.');
    if (coupon.max_uses != null && Number(coupon.used_count) >= Number(coupon.max_uses)) {
      throw new BadRequestException("Ce code promo n'est plus disponible.");
    }
    if (coupon.min_order_amount != null && Number(coupon.min_order_amount) > subtotal) {
      throw new BadRequestException(
        `Ce code promo nécessite un minimum d'achat de ${Number(coupon.min_order_amount).toLocaleString('fr-FR')} F CFA.`,
      );
    }
    const [owner] = await manager.query(`select user_id from user_loyalty_redemptions where coupon_id = $1`, [coupon.id]);
    if (owner && owner.user_id !== userId) {
      throw new BadRequestException('Ce bon fidélité est personnel : connectez-vous avec le compte qui l’a obtenu.');
    }
    await manager.query(`update coupons set used_count = used_count + 1, updated_at = now() where id = $1`, [coupon.id]);
    return { couponId: Number(coupon.id), discount: computeCouponDiscount(coupon.type, coupon.value, subtotal) };
  }

  async findAll(userId?: string): Promise<Order[]> {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    return this.orderRepository.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'user'],
    });
    if (order?.user) {
      const { id: uid, email, firstName, lastName, phone } = order.user;
      order.user = { id: uid, email, firstName, lastName, phone } as Order['user'];
    }
    return order;
  }

  /** Pour un client : la commande uniquement si elle lui appartient. */
  async findOneForUser(id: string, userId: string): Promise<Order | null> {
    const order = await this.findOne(id);
    if (!order || order.userId !== userId) return null;
    return order;
  }

  /** Pour l’admin : toutes les commandes. */
  async findAllForAdmin(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Stats : nombre de commandes, CA total, répartition par statut, ventes par catégorie et par mois. */
  async getStats(): Promise<{
    totalOrders: number;
    totalSales: number;
    byStatus: Record<Order['status'], number>;
    categoriesSales: { categoryId: number; categoryName: string; totalSales: number }[];
    totalsByStatusAmount: Record<Order['status'], number>;
    monthlySales: {
      year: number;
      month: number;
      label: string;
      totalSales: number;
      ordersCount: number;
    }[];
  }> {
    const orders = await this.orderRepository.find({ select: ['id', 'total', 'status', 'createdAt'] });
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const byStatus: Record<Order['status'], number> = {
      pending: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    const totalsByStatusAmount: Record<Order['status'], number> = {
      pending: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const o of orders) {
      if (o.status in byStatus) {
        byStatus[o.status]++;
        totalsByStatusAmount[o.status] += Number(o.total || 0);
      }
    }

    // Ventes par catégorie (somme des totalPrice des order_items, groupé par catégorie produit)
    const rawCategorySales = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .innerJoin('product.category', 'category')
      .select('category.id', 'categoryId')
      .addSelect('category.name', 'categoryName')
      .addSelect('SUM(item.totalPrice)', 'totalSales')
      .groupBy('category.id')
      .addGroupBy('category.name')
      .getRawMany();

    const categoriesSales = rawCategorySales.map((row: any) => ({
      categoryId: Number(row.categoryId),
      categoryName: row.categoryName as string,
      totalSales: Number(row.totalSales || 0),
    }));

    // Ventes mensuelles (PostgreSQL)
    const rawMonthlySales = await this.orderRepository
      .createQueryBuilder('order')
      .select(`EXTRACT(YEAR FROM "order"."created_at")`, 'year')
      .addSelect(`EXTRACT(MONTH FROM "order"."created_at")`, 'month')
      .addSelect('SUM(order.total)', 'totalSales')
      .addSelect('COUNT(order.id)', 'ordersCount')
      .groupBy('year')
      .addGroupBy('month')
      .orderBy('year', 'ASC')
      .addOrderBy('month', 'ASC')
      .getRawMany();

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthlySales = rawMonthlySales.map((row: any) => {
      const year = Number(row.year);
      const month = Number(row.month);
      const label = `${monthNames[month - 1] || month}/${year}`;
      return {
        year,
        month,
        label,
        totalSales: Number(row.totalSales || 0),
        ordersCount: Number(row.ordersCount || 0),
      };
    });

    return { totalOrders, totalSales, byStatus, categoriesSales, totalsByStatusAmount, monthlySales };
  }

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    await this.orderRepository.manager.transaction(async (manager) => {
      const [order] = await manager.query(`select status, coupon_id from orders where id = $1 for update`, [id]);
      if (!order) throw new NotFoundException('Commande introuvable');
      await manager.query(`update orders set status = $2, updated_at = now() where id = $1`, [id, status]);
      const wasCancelled = order.status === 'cancelled';
      const isCancelled = status === 'cancelled';
      if (order.coupon_id != null && wasCancelled !== isCancelled) {
        await manager.query(
          `update coupons set used_count = greatest(used_count + $2, 0), updated_at = now() where id = $1`,
          [order.coupon_id, isCancelled ? -1 : 1],
        );
      }
    });
    return this.findOne(id) as Promise<Order>;
  }
}
