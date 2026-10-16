import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    private ordersService: OrdersService,
    private productsService: ProductsService,
    private usersService: UsersService,
  ) {}

  async getStats(): Promise<{
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    totalUsers: number;
    averageOrderValue: number;
    lastMonthSales: number;
    lastMonthOrders: number;
    byStatus: {
      pending: number;
      paid: number;
      processing: number;
      shipped: number;
      delivered: number;
      cancelled: number;
    };
    categoriesSales: { categoryId: number; categoryName: string; totalSales: number; percent: number }[];
    totalsByStatusAmount: {
      pending: number;
      paid: number;
      processing: number;
      shipped: number;
      delivered: number;
      cancelled: number;
    };
    monthlySales: {
      year: number;
      month: number;
      label: string;
      totalSales: number;
      ordersCount: number;
    }[];
  }> {
    const [orderStats, productList, totalUsers] = await Promise.all([
      this.ordersService.getStats(),
      this.productsService.findAll({ page: 1, limit: 1 }),
      this.usersService.count(),
    ]);

    const totalSales = orderStats.totalSales;
    const totalOrders = orderStats.totalOrders;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const lastMonthData = orderStats.monthlySales.find(
      (m) => m.month === lastMonth && m.year === lastMonthYear,
    );
    const lastMonthSales = lastMonthData?.totalSales ?? 0;
    const lastMonthOrders = lastMonthData?.ordersCount ?? 0;

    const categoriesSales = orderStats.categoriesSales.map((c) => ({
      ...c,
      percent: totalSales > 0 ? (c.totalSales / totalSales) * 100 : 0,
    }));

    const monthlySales = orderStats.monthlySales.slice(-12);

    return {
      totalSales,
      totalOrders,
      totalProducts: productList.total,
      totalUsers,
      averageOrderValue,
      lastMonthSales,
      lastMonthOrders,
      byStatus: orderStats.byStatus,
      categoriesSales,
      totalsByStatusAmount: orderStats.totalsByStatusAmount,
      monthlySales,
    };
  }
}
