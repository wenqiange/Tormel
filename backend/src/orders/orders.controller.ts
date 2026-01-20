import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrderStatus, UserRole } from '@prisma/client';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Table has no active session' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(user.id, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  @ApiQuery({ name: 'tableSessionId', required: false })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('tableSessionId') tableSessionId?: string,
    @Query('status') status?: OrderStatus,
    @Query('userId') userId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.ordersService.findAll(
      pagination,
      tableSessionId,
      status,
      userId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined,
    );
  }

  @Get('kitchen')
  @ApiOperation({ summary: 'Get kitchen orders (pending preparation)' })
  @ApiResponse({ status: 200, description: 'Kitchen orders' })
  getKitchenOrders() {
    return this.ordersService.getKitchenOrders();
  }

  @Get('table/:tableId')
  @ApiOperation({ summary: 'Get orders for a specific table' })
  @ApiResponse({ status: 200, description: 'Table orders' })
  findByTable(@Param('tableId') tableId: string) {
    return this.ordersService.findByTable(tableId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Get(':id/total')
  @ApiOperation({ summary: 'Calculate order total' })
  @ApiResponse({ status: 200, description: 'Order total calculation' })
  calculateTotal(@Param('id') id: string) {
    return this.ordersService.calculateOrderTotal(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiQuery({ name: 'status', enum: OrderStatus })
  updateStatus(
    @Param('id') id: string,
    @Query('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to order' })
  @ApiResponse({ status: 201, description: 'Item added' })
  addItem(@Param('id') id: string, @Body() addItemDto: AddOrderItemDto) {
    return this.ordersService.addItem(id, addItemDto);
  }

  @Patch(':orderId/items/:itemId/status')
  @ApiOperation({ summary: 'Update order item status (for kitchen)' })
  @ApiResponse({ status: 200, description: 'Item status updated' })
  @ApiQuery({ name: 'status', enum: OrderStatus })
  updateItemStatus(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Query('status') status: OrderStatus,
  ) {
    return this.ordersService.updateItemStatus(orderId, itemId, status);
  }

  @Delete(':orderId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from order' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  @ApiResponse({ status: 400, description: 'Cannot remove item being prepared' })
  removeItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeItem(orderId, itemId);
  }
}
