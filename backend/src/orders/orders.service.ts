import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrintingService } from '../printing/printing.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { PaginationDto, createPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(forwardRef(() => PrintingService))
    private readonly printingService: PrintingService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    // Verify table session exists and is active
    const session = await this.prisma.tableSession.findFirst({
      where: {
        tableId: createOrderDto.tableId,
        closedAt: null,
      },
    });

    if (!session) {
      throw new BadRequestException('Table has no active session. Please open the table first.');
    }

    // Get next order number
    const orderNumber = await this.getNextOrderNumber();

    // Create order with items
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tableSessionId: session.id,
          userId,
          orderNumber,
          notes: createOrderDto.notes,
          status: OrderStatus.PENDING,
        },
      });

      // Add items
      if (createOrderDto.items && createOrderDto.items.length > 0) {
        for (const item of createOrderDto.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new BadRequestException(`Product ${item.productId} not found`);
          }

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
              taxRate: product.taxRate,
              notes: item.notes,
              status: OrderStatus.PENDING,
            },
          });

          // Add modifiers
          if (item.modifierIds && item.modifierIds.length > 0) {
            for (const modifierId of item.modifierIds) {
              const modifier = await tx.modifier.findUnique({
                where: { id: modifierId },
              });

              if (modifier) {
                await tx.orderItemModifier.create({
                  data: {
                    orderItemId: orderItem.id,
                    modifierId: modifier.id,
                    price: modifier.price,
                  },
                });
              }
            }
          }

          // Update stock if tracked
          if (product.trackStock) {
            await tx.product.update({
              where: { id: product.id },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
        }
      }

      return newOrder;
    });

    // Fetch complete order with relations
    const completeOrder = await this.findById(order.id);

    // Emit real-time event
    this.realtimeGateway.emitOrderCreated(completeOrder);

    // Print to kitchen if configured
    const kitchenItems = completeOrder.items.filter(
      (item) => item.product.sendToKitchen,
    );
    if (kitchenItems.length > 0) {
      await this.printingService.printKitchenTicket(completeOrder);
    }

    return completeOrder;
  }

  async findAll(
    pagination: PaginationDto,
    tableSessionId?: string,
    status?: OrderStatus,
    userId?: string,
    fromDate?: Date,
    toDate?: Date,
  ) {
    const where: Prisma.OrderWhereInput = {};

    if (tableSessionId) {
      where.tableSessionId = tableSessionId;
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = fromDate;
      }
      if (toDate) {
        where.createdAt.lte = toDate;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          items: {
            include: {
              product: true,
              modifiers: {
                include: { modifier: true },
              },
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          tableSession: {
            include: {
              table: {
                include: { zone: true },
              },
            },
          },
        },
        orderBy: { createdAt: pagination.sortOrder || 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return createPaginatedResult(orders, total, pagination);
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            modifiers: {
              include: { modifier: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        tableSession: {
          include: {
            table: {
              include: { zone: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByTable(tableId: string) {
    const session = await this.prisma.tableSession.findFirst({
      where: {
        tableId,
        closedAt: null,
      },
    });

    if (!session) {
      return [];
    }

    return this.prisma.order.findMany({
      where: { tableSessionId: session.id },
      include: {
        items: {
          include: {
            product: true,
            modifiers: {
              include: { modifier: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findById(id);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update cancelled order');
    }

    if (order.status === OrderStatus.SERVED) {
      throw new BadRequestException('Cannot update served order');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        notes: updateOrderDto.notes,
      },
      include: {
        items: {
          include: {
            product: true,
            modifiers: {
              include: { modifier: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        tableSession: {
          include: {
            table: {
              include: { zone: true },
            },
          },
        },
      },
    });

    this.realtimeGateway.emitOrderUpdated(updatedOrder);
    return updatedOrder;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.findById(id);

    const now = new Date();
    const updateData: Prisma.OrderUpdateInput = { status };

    switch (status) {
      case OrderStatus.CONFIRMED:
        updateData.confirmedAt = now;
        break;
      case OrderStatus.IN_PREPARATION:
        updateData.preparedAt = now;
        break;
      case OrderStatus.READY:
        updateData.readyAt = now;
        break;
      case OrderStatus.SERVED:
        updateData.servedAt = now;
        // Update all items status
        await this.prisma.orderItem.updateMany({
          where: { orderId: id },
          data: { status: OrderStatus.SERVED },
        });
        break;
      case OrderStatus.CANCELLED:
        updateData.cancelledAt = now;
        // Restore stock for cancelled items
        for (const item of order.items) {
          if (item.product.trackStock) {
            await this.prisma.product.update({
              where: { id: item.productId },
              data: { stockQty: { increment: item.quantity } },
            });
          }
        }
        break;
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
            modifiers: {
              include: { modifier: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        tableSession: {
          include: {
            table: {
              include: { zone: true },
            },
          },
        },
      },
    });

    this.realtimeGateway.emitOrderStatusChanged(updatedOrder);
    return updatedOrder;
  }

  async addItem(orderId: string, addItemDto: AddOrderItemDto) {
    const order = await this.findById(orderId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot add items to cancelled order');
    }

    if (order.status === OrderStatus.SERVED) {
      throw new BadRequestException('Cannot add items to served order');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: addItemDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const orderItem = await this.prisma.orderItem.create({
      data: {
        orderId,
        productId: addItemDto.productId,
        quantity: addItemDto.quantity,
        unitPrice: product.price,
        taxRate: product.taxRate,
        notes: addItemDto.notes,
        status: OrderStatus.PENDING,
      },
    });

    // Add modifiers
    if (addItemDto.modifierIds && addItemDto.modifierIds.length > 0) {
      for (const modifierId of addItemDto.modifierIds) {
        const modifier = await this.prisma.modifier.findUnique({
          where: { id: modifierId },
        });

        if (modifier) {
          await this.prisma.orderItemModifier.create({
            data: {
              orderItemId: orderItem.id,
              modifierId: modifier.id,
              price: modifier.price,
            },
          });
        }
      }
    }

    // Update stock
    if (product.trackStock) {
      await this.prisma.product.update({
        where: { id: product.id },
        data: { stockQty: { decrement: addItemDto.quantity } },
      });
    }

    const updatedOrder = await this.findById(orderId);
    this.realtimeGateway.emitOrderUpdated(updatedOrder);

    // Print new item to kitchen
    if (product.sendToKitchen) {
      await this.printingService.printKitchenTicket(updatedOrder);
    }

    return updatedOrder;
  }

  async updateItemStatus(orderId: string, itemId: string, status: OrderStatus) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });

    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    const updateData: Prisma.OrderItemUpdateInput = { status };

    if (status === OrderStatus.READY || status === OrderStatus.SERVED) {
      updateData.preparedAt = new Date();
    }

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Check if all items are ready/served
    const order = await this.findById(orderId);
    const allItemsReady = order.items.every(
      (item) => item.status === OrderStatus.READY || item.status === OrderStatus.SERVED,
    );

    if (allItemsReady && order.status !== OrderStatus.READY) {
      await this.updateStatus(orderId, OrderStatus.READY);
    }

    const updatedOrder = await this.findById(orderId);
    this.realtimeGateway.emitOrderUpdated(updatedOrder);
    return updatedOrder;
  }

  async removeItem(orderId: string, itemId: string) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      include: { product: true },
    });

    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    if (orderItem.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Cannot remove item that is already being prepared');
    }

    // Restore stock
    if (orderItem.product.trackStock) {
      await this.prisma.product.update({
        where: { id: orderItem.productId },
        data: { stockQty: { increment: orderItem.quantity } },
      });
    }

    await this.prisma.orderItem.delete({
      where: { id: itemId },
    });

    const updatedOrder = await this.findById(orderId);
    this.realtimeGateway.emitOrderUpdated(updatedOrder);
    return updatedOrder;
  }

  async getKitchenOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION],
        },
      },
      include: {
        items: {
          where: {
            product: { sendToKitchen: true },
            status: {
              in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_PREPARATION],
            },
          },
          include: {
            product: true,
            modifiers: {
              include: { modifier: true },
            },
          },
        },
        tableSession: {
          include: {
            table: {
              include: { zone: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filter orders with kitchen items
    return orders.filter((order) => order.items.length > 0);
  }

  private async getNextOrderNumber(): Promise<number> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'order_number_sequence' },
    });

    const currentNumber = config ? parseInt(config.value, 10) : 1000;
    const nextNumber = currentNumber + 1;

    await this.prisma.systemConfig.upsert({
      where: { key: 'order_number_sequence' },
      update: { value: nextNumber.toString() },
      create: {
        key: 'order_number_sequence',
        value: nextNumber.toString(),
        description: 'Current order number sequence',
      },
    });

    return nextNumber;
  }

  async calculateOrderTotal(orderId: string) {
    const order = await this.findById(orderId);

    let subtotal = 0;
    let taxAmount = 0;

    for (const item of order.items) {
      const itemPrice = Number(item.unitPrice);
      const itemTotal = itemPrice * item.quantity;

      // Add modifier prices
      let modifierTotal = 0;
      for (const mod of item.modifiers) {
        modifierTotal += Number(mod.price);
      }

      const lineTotal = (itemPrice + modifierTotal) * item.quantity;
      const lineTax = lineTotal * (Number(item.taxRate) / 100);

      subtotal += lineTotal;
      taxAmount += lineTax;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }
}
