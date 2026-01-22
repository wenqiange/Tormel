import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, TableStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's sales from completed bills
    const todayBills = await this.prisma.bill.findMany({
      where: {
        createdAt: { gte: today },
        status: 'PAID',
      },
      select: { total: true },
    });
    const todaySales = todayBills.reduce((sum, bill) => sum + Number(bill.total), 0);

    // Get today's orders count
    const totalOrders = await this.prisma.order.count({
      where: { createdAt: { gte: today } },
    });

    // Get table stats
    const allTables = await this.prisma.table.findMany({
      where: { isActive: true },
      select: { status: true },
    });
    const totalTables = allTables.length;
    const occupiedTables = allTables.filter(t => t.status === TableStatus.OCCUPIED).length;

    // Get active waiters (users who have orders today)
    const activeWaiters = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: today } },
    });

    // Calculate average ticket
    const averageTicket = todayBills.length > 0 
      ? todaySales / todayBills.length 
      : 0;

    // Get top products today
    const topProductsData = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { createdAt: { gte: today } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const topProducts = await Promise.all(
      topProductsData.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        return {
          name: product?.name || 'Producto desconocido',
          quantity: item._sum.quantity || 0,
        };
      }),
    );

    // Get recent orders
    const recentOrdersData = await this.prisma.order.findMany({
      where: { createdAt: { gte: today } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        tableSession: {
          include: {
            table: true,
          },
        },
        items: {
          include: { product: true },
        },
      },
    });

    const recentOrders = recentOrdersData.map((order) => {
      const total = order.items.reduce((sum, item) => {
        return sum + Number(item.unitPrice) * item.quantity;
      }, 0);
      
      return {
        id: order.id,
        tableName: `Mesa ${order.tableSession.table.number}`,
        total,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      };
    });

    return {
      todaySales: Math.round(todaySales * 100) / 100,
      totalOrders,
      occupiedTables,
      totalTables,
      activeWaiters: activeWaiters.length,
      averageTicket: Math.round(averageTicket * 100) / 100,
      topProducts,
      recentOrders,
    };
  }
}
