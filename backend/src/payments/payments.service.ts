import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { BillStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrintingService } from '../printing/printing.service';
import { TablesService } from '../tables/tables.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaginationDto, createPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(forwardRef(() => PrintingService))
    private readonly printingService: PrintingService,
    @Inject(forwardRef(() => TablesService))
    private readonly tablesService: TablesService,
  ) {}

  async create(userId: string, createPaymentDto: CreatePaymentDto) {
    const bill = await this.prisma.bill.findUnique({
      where: { id: createPaymentDto.billId },
      include: {
        payments: true,
        tableSession: {
          include: { table: true },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.status === BillStatus.CANCELLED || bill.status === BillStatus.VOID) {
      throw new BadRequestException('Cannot pay cancelled or voided bill');
    }

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill already fully paid');
    }

    const totalPaid = bill.payments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const remaining = Number(bill.total) - totalPaid;

    if (createPaymentDto.amount > remaining + 0.01) {
      throw new BadRequestException(`Payment amount exceeds remaining balance of ${remaining.toFixed(2)}`);
    }

    // Calculate change for cash payments
    let changeGiven: number | null = null;
    if (createPaymentDto.method === PaymentMethod.CASH && createPaymentDto.amountTendered) {
      if (createPaymentDto.amountTendered < createPaymentDto.amount) {
        throw new BadRequestException('Amount tendered is less than payment amount');
      }
      changeGiven = createPaymentDto.amountTendered - createPaymentDto.amount;
    }

    const payment = await this.prisma.payment.create({
      data: {
        billId: createPaymentDto.billId,
        userId,
        amount: new Prisma.Decimal(createPaymentDto.amount),
        method: createPaymentDto.method,
        status: PaymentStatus.COMPLETED,
        amountTendered: createPaymentDto.amountTendered
          ? new Prisma.Decimal(createPaymentDto.amountTendered)
          : null,
        changeGiven: changeGiven !== null ? new Prisma.Decimal(changeGiven) : null,
        transactionRef: createPaymentDto.transactionRef,
        cardLastFour: createPaymentDto.cardLastFour,
        notes: createPaymentDto.notes,
        completedAt: new Date(),
      },
      include: {
        bill: {
          include: {
            tableSession: {
              include: { table: { include: { zone: true } } },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Update bill paid amount and status
    const newTotalPaid = totalPaid + createPaymentDto.amount;
    const billTotal = Number(bill.total);

    let newStatus: BillStatus;
    if (newTotalPaid >= billTotal - 0.01) {
      newStatus = BillStatus.PAID;
    } else {
      newStatus = BillStatus.PARTIALLY_PAID;
    }

    const updatedBill = await this.prisma.bill.update({
      where: { id: bill.id },
      data: {
        paidAmount: new Prisma.Decimal(Math.round(newTotalPaid * 100) / 100),
        status: newStatus,
        paidAt: newStatus === BillStatus.PAID ? new Date() : null,
      },
      include: {
        items: {
          include: {
            orderItem: { include: { product: true } },
          },
        },
        payments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        tableSession: {
          include: { table: { include: { zone: true } } },
        },
      },
    });

    // Emit events
    this.realtimeGateway.emitPaymentReceived(payment);
    this.realtimeGateway.emitBillUpdated(updatedBill);

    // Print receipt if auto-print enabled or if bill is fully paid
    if (newStatus === BillStatus.PAID) {
      const autoPrint = await this.prisma.systemConfig.findUnique({
        where: { key: 'auto_print_receipt' },
      });

      if (autoPrint?.value === 'true') {
        await this.printingService.printReceipt(updatedBill);
      }
    }

    return {
      payment,
      bill: updatedBill,
      change: changeGiven,
    };
  }

  async findAll(
    pagination: PaginationDto,
    billId?: string,
    method?: PaymentMethod,
    fromDate?: Date,
    toDate?: Date,
  ) {
    const where: Prisma.PaymentWhereInput = {};

    if (billId) {
      where.billId = billId;
    }

    if (method) {
      where.method = method;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          bill: {
            include: {
              tableSession: {
                include: { table: { include: { zone: true } } },
              },
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: pagination.sortOrder || 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return createPaginatedResult(payments, total, pagination);
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        bill: {
          include: {
            items: {
              include: {
                orderItem: { include: { product: true } },
              },
            },
            tableSession: {
              include: { table: { include: { zone: true } } },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async refund(id: string, userId: string, amount?: number, reason?: string) {
    const payment = await this.findById(id);

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment already refunded');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    const refundAmount = amount || Number(payment.amount);

    if (refundAmount > Number(payment.amount)) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    // Create refund payment record
    const refund = await this.prisma.payment.create({
      data: {
        billId: payment.billId,
        userId,
        amount: new Prisma.Decimal(-refundAmount),
        method: payment.method,
        status: PaymentStatus.REFUNDED,
        notes: reason || 'Refund',
        completedAt: new Date(),
      },
    });

    // Update original payment status
    await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.REFUNDED },
    });

    // Update bill paid amount
    const bill = payment.bill;
    const newPaidAmount = Number(bill.paidAmount) - refundAmount;

    await this.prisma.bill.update({
      where: { id: bill.id },
      data: {
        paidAmount: new Prisma.Decimal(Math.max(0, newPaidAmount)),
        status: newPaidAmount <= 0 ? BillStatus.OPEN : BillStatus.PARTIALLY_PAID,
        paidAt: null,
      },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'REFUND',
        entityType: 'Payment',
        entityId: id,
        oldValue: { amount: Number(payment.amount), status: payment.status },
        newValue: { refundAmount, reason },
      },
    });

    return refund;
  }

  async getPaymentSummary(fromDate?: Date, toDate?: Date) {
    const start = fromDate || new Date(new Date().setHours(0, 0, 0, 0));
    const end = toDate || new Date(new Date().setHours(23, 59, 59, 999));

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const summary = {
      totalPayments: payments.length,
      totalAmount: 0,
      byMethod: {} as Record<string, { count: number; amount: number }>,
    };

    for (const payment of payments) {
      const amount = Number(payment.amount);
      summary.totalAmount += amount;

      if (!summary.byMethod[payment.method]) {
        summary.byMethod[payment.method] = { count: 0, amount: 0 };
      }
      summary.byMethod[payment.method].count++;
      summary.byMethod[payment.method].amount += amount;
    }

    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;
    for (const method of Object.keys(summary.byMethod)) {
      summary.byMethod[method].amount = Math.round(summary.byMethod[method].amount * 100) / 100;
    }

    return summary;
  }
}
