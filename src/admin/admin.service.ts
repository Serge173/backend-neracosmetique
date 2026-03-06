import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class AdminService {
  constructor(
    private ordersService: OrdersService,
    private productsService: ProductsService,
  ) {}

  async getStats(): Promise<{
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    byStatus: {
      pending: number;
      paid: number;
      processing: number;
      shipped: number;
      delivered: number;
      cancelled: number;
    };
    categoriesSales: { categoryId: number; categoryName: string; totalSales: number }[];
  }> {
    const [orderStats, productList] = await Promise.all([
      this.ordersService.getStats(),
      this.productsService.findAll({ page: 1, limit: 1 }),
    ]);
    return {
      totalSales: orderStats.totalSales,
      totalOrders: orderStats.totalOrders,
      totalProducts: productList.total,
      byStatus: orderStats.byStatus,
      categoriesSales: orderStats.categoriesSales,
    };
  }
}
