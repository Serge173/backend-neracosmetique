import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { v4 as uuidv4 } from 'uuid';

const SAFE_PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400?text=Produit';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
  ) {}

  async create(userId: string | null, orderData: any): Promise<Order> {
    // Génère un numéro de commande court pour respecter la taille de la colonne SQL
    const timestampPart = Date.now().toString().slice(-8);
    const uuidPart = uuidv4().replace(/-/g, '').substring(0, 4).toUpperCase();
    const orderNumber = `NERA-${timestampPart}-${uuidPart}`.substring(0, 20);
    const items = orderData.items || [];

    try {
      const order = this.orderRepository.create({
        id: uuidv4(),
        firstName: String(orderData.firstName ?? '').trim(),
        lastName: String(orderData.lastName ?? '').trim(),
        email: String(orderData.email ?? '').trim(),
        phone: String(orderData.phone ?? '').trim(),
        addressLine1: String(orderData.addressLine1 ?? '').trim(),
        addressLine2: orderData.addressLine2 != null ? String(orderData.addressLine2).trim() : null,
        city: String(orderData.city ?? '').trim(),
        postalCode: orderData.postalCode != null ? String(orderData.postalCode).trim() : null,
        deliveryZoneId: orderData.deliveryZoneId ?? null,
        deliveryMethod: orderData.deliveryMethod ?? null,
        paymentMethod: String(orderData.paymentMethod ?? 'mtn_momo').trim(),
        subtotal: Number(orderData.subtotal) || 0,
        shippingAmount: Number(orderData.shippingAmount) || 0,
        discountAmount: Number(orderData.discountAmount) || 0,
        total: Number(orderData.total) || 0,
        userId: userId ?? null,
        orderNumber,
        status: 'pending',
        paymentStatus: 'pending',
      });

      const savedOrder = (await this.orderRepository.save(order)) as Order;

      // Longueurs sûres pour MySQL (VARCHAR par défaut ≈ 255)
      const maxVarcharLength = 240;
      const maxUrlLength = maxVarcharLength;

      for (const it of items) {
        const unitPrice = Number(it.unitPrice ?? 0);
        const quantity = Number(it.quantity ?? 0);
        let productImageUrl: string | null = it.productImageUrl ?? null;
        if (productImageUrl) {
          // Bloquer certains domaines problématiques + tronquer pour rester sous la limite SQL
          if (/bing\.com|blogspot\.com/i.test(productImageUrl)) {
            productImageUrl = SAFE_PLACEHOLDER_IMAGE;
          }
          if (productImageUrl.length > maxUrlLength) {
            productImageUrl = productImageUrl.substring(0, maxUrlLength);
          }
        }

        const orderItem = this.orderItemRepository.create({
          orderId: savedOrder.id,
          productId: it.productId,
          productName: (it.productName ?? 'Produit').substring(0, maxVarcharLength),
          productSlug: (it.productSlug ?? '').substring(0, maxVarcharLength),
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
          productImageUrl,
        });
        await this.orderItemRepository.save(orderItem);
      }

      return this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items'],
      }) as Promise<Order>;
    } catch (err: any) {
      this.logger.error('Order create failed', err?.message, err?.stack);
      const msg = err?.message || String(err);
      if (err?.code === 'ER_DATA_TOO_LONG' || msg.includes('Data too long')) {
        throw new BadRequestException('Une donnée dépasse la limite autorisée (ex. URL d\'image trop longue). Réessayez.');
      }
      if (err?.code === 'ER_NO_REFERENCED_ROW' || msg.includes('foreign key')) {
        throw new BadRequestException('Référence invalide (zone de livraison ou produit). Vérifiez le panier.');
      }
      throw new BadRequestException(err?.message || 'Impossible de créer la commande. Vérifiez vos informations.');
    }
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
    return this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'user'],
    });
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

  /** Stats : nombre de commandes, CA total, répartition par statut et ventes par catégorie. */
  async getStats(): Promise<{
    totalOrders: number;
    totalSales: number;
    byStatus: Record<Order['status'], number>;
    categoriesSales: { categoryId: number; categoryName: string; totalSales: number }[];
  }> {
    const orders = await this.orderRepository.find({ select: ['total', 'status'] });
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
    for (const o of orders) {
      if (o.status in byStatus) {
        byStatus[o.status]++;
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

    return { totalOrders, totalSales, byStatus, categoriesSales };
  }

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    const order = await this.findOne(id);
    if (!order) throw new NotFoundException('Commande introuvable');
    await this.orderRepository.update(id, { status });
    return this.findOne(id) as Promise<Order>;
  }
}
