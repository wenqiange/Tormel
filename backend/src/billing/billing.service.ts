import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { BillStatus, OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrintingService } from '../printing/printing.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { SplitBillDto } from './dto/split-bill.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { PaginationDto, createPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(forwardRef(() => PrintingService))
    private readonly printingService: PrintingService,
  ) {}

  async create(userId: string, createBillDto: CreateBillDto) {
    // Get table session
    const session = await this.prisma.tableSession.findFirst({
      where: {
        tableId: createBillDto.tableId,
        closedAt: null,
      },
      include: {
        orders: {
          where: {
            status: { in: [OrderStatus.SERVED, OrderStatus.READY] },
          },
          include: {
            items: {
              include: {
                product: true,
                modifiers: { include: { modifier: true } },
                billItems: true, // To check if already billed
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new BadRequestException('Table has no active session');
    }

    // Get unbilled order items
    const unbilledItems = session.orders.flatMap((order) =>
      order.items.filter((item) => item.billItems.length === 0),
    );

    if (unbilledItems.length === 0) {
      throw new BadRequestException('No unbilled items found');
    }

    // Filter items if specific itemIds provided
    const itemsToBill = createBillDto.orderItemIds
      ? unbilledItems.filter((item) => createBillDto.orderItemIds!.includes(item.id))
      : unbilledItems;

    if (itemsToBill.length === 0) {
      throw new BadRequestException('Selected items already billed or not found');
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    const billItemsData: {
      orderItemId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
    }[] = [];

    for (const item of itemsToBill) {
      const unitPrice = Number(item.unitPrice);
      let modifierTotal = 0;

      for (const mod of item.modifiers) {
        modifierTotal += Number(mod.price);
      }

      const lineSubtotal = (unitPrice + modifierTotal) * item.quantity;
      const lineTax = lineSubtotal * (Number(item.taxRate) / 100);
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxAmount += lineTax;

      billItemsData.push({
        orderItemId: item.id,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unitPrice + modifierTotal),
        taxRate: item.taxRate,
        taxAmount: new Prisma.Decimal(Math.round(lineTax * 100) / 100),
        total: new Prisma.Decimal(Math.round(lineTotal * 100) / 100),
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    taxAmount = Math.round(taxAmount * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    // Generate bill number
    const billNumber = await this.generateBillNumber();

    // Create bill with items
    const bill = await this.prisma.bill.create({
      data: {
        tableSessionId: session.id,
        userId,
        billNumber,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(total),
        status: BillStatus.OPEN,
        notes: createBillDto.notes,
        items: {
          create: billItemsData,
        },
      },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                modifiers: { include: { modifier: true } },
              },
            },
          },
        },
        payments: true,
        tableSession: {
          include: {
            table: { include: { zone: true } },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    this.realtimeGateway.emitBillCreated(bill);
    return bill;
  }

  async findAll(
    pagination: PaginationDto,
    tableSessionId?: string,
    status?: BillStatus,
    fromDate?: Date,
    toDate?: Date,
  ) {
    const where: Prisma.BillWhereInput = {};

    if (tableSessionId) {
      where.tableSessionId = tableSessionId;
    }

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const [bills, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          items: {
            include: {
              orderItem: {
                include: { product: true },
              },
            },
          },
          payments: true,
          tableSession: {
            include: {
              table: { include: { zone: true } },
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: pagination.sortOrder || 'desc' },
      }),
      this.prisma.bill.count({ where }),
    ]);

    return createPaginatedResult(bills, total, pagination);
  }

  async findById(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                modifiers: { include: { modifier: true } },
              },
            },
          },
        },
        payments: true,
        tableSession: {
          include: {
            table: { include: { zone: true } },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        splitBills: {
          include: { payments: true },
        },
        parentBill: true,
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  async findByTable(tableId: string) {
    const session = await this.prisma.tableSession.findFirst({
      where: { tableId, closedAt: null },
    });

    if (!session) {
      return [];
    }

    return this.prisma.bill.findMany({
      where: { tableSessionId: session.id },
      include: {
        items: {
          include: {
            orderItem: { include: { product: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async splitBill(id: string, userId: string, splitBillDto: SplitBillDto) {
    const parentBill = await this.findById(id);

    if (parentBill.status !== BillStatus.OPEN) {
      throw new BadRequestException('Can only split open bills');
    }

    // Validate split items
    const billItemIds = parentBill.items.map((item) => item.id);
    for (const itemId of splitBillDto.billItemIds) {
      if (!billItemIds.includes(itemId)) {
        throw new BadRequestException(`Bill item ${itemId} not found in bill`);
      }
    }

    // Create split bill
    const splitItems = parentBill.items.filter((item) =>
      splitBillDto.billItemIds.includes(item.id),
    );

    let subtotal = 0;
    let taxAmount = 0;

    for (const item of splitItems) {
      const itemSubtotal = Number(item.unitPrice) * item.quantity;
      subtotal += itemSubtotal;
      taxAmount += Number(item.taxAmount);
    }

    subtotal = Math.round(subtotal * 100) / 100;
    taxAmount = Math.round(taxAmount * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const splitBillNumber = await this.generateBillNumber();

    const splitBill = await this.prisma.$transaction(async (tx) => {
      // Create new bill
      const newBill = await tx.bill.create({
        data: {
          tableSessionId: parentBill.tableSessionId,
          userId,
          billNumber: splitBillNumber,
          subtotal: new Prisma.Decimal(subtotal),
          taxAmount: new Prisma.Decimal(taxAmount),
          total: new Prisma.Decimal(total),
          status: BillStatus.OPEN,
          parentBillId: parentBill.id,
        },
      });

      // Move items to split bill
      await tx.billItem.updateMany({
        where: { id: { in: splitBillDto.billItemIds } },
        data: { billId: newBill.id },
      });

      // Recalculate parent bill
      const remainingItems = await tx.billItem.findMany({
        where: { billId: parentBill.id },
      });

      let parentSubtotal = 0;
      let parentTaxAmount = 0;

      for (const item of remainingItems) {
        parentSubtotal += Number(item.unitPrice) * item.quantity;
        parentTaxAmount += Number(item.taxAmount);
      }

      await tx.bill.update({
        where: { id: parentBill.id },
        data: {
          subtotal: new Prisma.Decimal(Math.round(parentSubtotal * 100) / 100),
          taxAmount: new Prisma.Decimal(Math.round(parentTaxAmount * 100) / 100),
          total: new Prisma.Decimal(Math.round((parentSubtotal + parentTaxAmount) * 100) / 100),
        },
      });

      return newBill;
    });

    const completeSplitBill = await this.findById(splitBill.id);
    this.realtimeGateway.emitBillCreated(completeSplitBill);

    return completeSplitBill;
  }

  async applyDiscount(id: string, discountDto: ApplyDiscountDto) {
    const bill = await this.findById(id);

    if (bill.status !== BillStatus.OPEN) {
      throw new BadRequestException('Can only apply discount to open bills');
    }

    let discountAmount: number;

    if (discountDto.isPercentage) {
      discountAmount = Number(bill.subtotal) * (discountDto.amount / 100);
    } else {
      discountAmount = discountDto.amount;
    }

    discountAmount = Math.min(discountAmount, Number(bill.subtotal));
    discountAmount = Math.round(discountAmount * 100) / 100;

    const newTotal = Number(bill.subtotal) + Number(bill.taxAmount) - discountAmount;

    const updatedBill = await this.prisma.bill.update({
      where: { id },
      data: {
        discountAmount: new Prisma.Decimal(discountAmount),
        discountReason: discountDto.reason,
        total: new Prisma.Decimal(Math.round(newTotal * 100) / 100),
      },
      include: {
        items: {
          include: {
            orderItem: { include: { product: true } },
          },
        },
        payments: true,
        tableSession: {
          include: { table: { include: { zone: true } } },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    this.realtimeGateway.emitBillUpdated(updatedBill);
    return updatedBill;
  }

  async addTip(id: string, tipAmount: number) {
    const bill = await this.findById(id);

    if (bill.status === BillStatus.CANCELLED || bill.status === BillStatus.VOID) {
      throw new BadRequestException('Cannot add tip to cancelled or voided bill');
    }

    const newTotal = Number(bill.total) - Number(bill.tipAmount) + tipAmount;

    const updatedBill = await this.prisma.bill.update({
      where: { id },
      data: {
        tipAmount: new Prisma.Decimal(tipAmount),
        total: new Prisma.Decimal(Math.round(newTotal * 100) / 100),
      },
      include: {
        items: {
          include: {
            orderItem: { include: { product: true } },
          },
        },
        payments: true,
        tableSession: {
          include: { table: { include: { zone: true } } },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    this.realtimeGateway.emitBillUpdated(updatedBill);
    return updatedBill;
  }

  async voidBill(id: string, reason?: string) {
    const bill = await this.findById(id);

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Cannot void a paid bill');
    }

    const updatedBill = await this.prisma.bill.update({
      where: { id },
      data: {
        status: BillStatus.VOID,
        notes: reason ? `VOID: ${reason}` : 'VOID',
      },
      include: {
        items: true,
        payments: true,
      },
    });

    this.realtimeGateway.emitBillUpdated(updatedBill);
    return updatedBill;
  }

  async printBill(id: string) {
    const bill = await this.findById(id);
    
    await this.printingService.printReceipt(bill);

    await this.prisma.bill.update({
      where: { id },
      data: { printedAt: new Date() },
    });

    return { message: 'Bill sent to printer' };
  }

  private async generateBillNumber(): Promise<string> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'bill_number_sequence' },
    });

    const prefix = (await this.prisma.systemConfig.findUnique({
      where: { key: 'bill_number_prefix' },
    }))?.value || 'B';

    const currentNumber = config ? parseInt(config.value, 10) : 1000;
    const nextNumber = currentNumber + 1;

    await this.prisma.systemConfig.upsert({
      where: { key: 'bill_number_sequence' },
      update: { value: nextNumber.toString() },
      create: {
        key: 'bill_number_sequence',
        value: nextNumber.toString(),
      },
    });

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    return `${prefix}${year}${month}-${nextNumber}`;
  }

  async getDailySummary(date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bills = await this.prisma.bill.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: BillStatus.PAID,
      },
      include: {
        payments: true,
      },
    });

    const summary = {
      date: targetDate.toISOString().split('T')[0],
      totalBills: bills.length,
      totalRevenue: 0,
      totalTax: 0,
      totalDiscounts: 0,
      totalTips: 0,
      paymentMethods: {} as Record<string, number>,
    };

    for (const bill of bills) {
      summary.totalRevenue += Number(bill.total);
      summary.totalTax += Number(bill.taxAmount);
      summary.totalDiscounts += Number(bill.discountAmount);
      summary.totalTips += Number(bill.tipAmount);

      for (const payment of bill.payments) {
        const method = payment.method;
        summary.paymentMethods[method] = (summary.paymentMethods[method] || 0) + Number(payment.amount);
      }
    }

    summary.totalRevenue = Math.round(summary.totalRevenue * 100) / 100;
    summary.totalTax = Math.round(summary.totalTax * 100) / 100;
    summary.totalDiscounts = Math.round(summary.totalDiscounts * 100) / 100;
    summary.totalTips = Math.round(summary.totalTips * 100) / 100;

    return summary;
  }
}
