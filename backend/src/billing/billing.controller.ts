import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillStatus, UserRole } from '@prisma/client';

import { BillingService } from './billing.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { SplitBillDto } from './dto/split-bill.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('bills')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @ApiOperation({ summary: 'Generate bill for table' })
  @ApiResponse({ status: 201, description: 'Bill created successfully' })
  @ApiResponse({ status: 400, description: 'No unbilled items found' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createBillDto: CreateBillDto,
  ) {
    return this.billingService.create(user.id, createBillDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bills' })
  @ApiResponse({ status: 200, description: 'List of bills' })
  @ApiQuery({ name: 'tableSessionId', required: false })
  @ApiQuery({ name: 'status', enum: BillStatus, required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('tableSessionId') tableSessionId?: string,
    @Query('status') status?: BillStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.billingService.findAll(
      pagination,
      tableSessionId,
      status,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined,
    );
  }

  @Get('table/:tableId')
  @ApiOperation({ summary: 'Get bills for a specific table' })
  @ApiResponse({ status: 200, description: 'Table bills' })
  findByTable(@Param('tableId') tableId: string) {
    return this.billingService.findByTable(tableId);
  }

  @Get('summary/daily')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get daily sales summary' })
  @ApiResponse({ status: 200, description: 'Daily summary' })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format' })
  getDailySummary(@Query('date') date?: string) {
    return this.billingService.getDailySummary(date ? new Date(date) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bill by ID' })
  @ApiResponse({ status: 200, description: 'Bill found' })
  @ApiResponse({ status: 404, description: 'Bill not found' })
  findOne(@Param('id') id: string) {
    return this.billingService.findById(id);
  }

  @Post(':id/split')
  @ApiOperation({ summary: 'Split bill' })
  @ApiResponse({ status: 201, description: 'Bill split successfully' })
  @ApiResponse({ status: 400, description: 'Cannot split this bill' })
  splitBill(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() splitBillDto: SplitBillDto,
  ) {
    return this.billingService.splitBill(id, user.id, splitBillDto);
  }

  @Patch(':id/discount')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Apply discount to bill' })
  @ApiResponse({ status: 200, description: 'Discount applied' })
  applyDiscount(
    @Param('id') id: string,
    @Body() discountDto: ApplyDiscountDto,
  ) {
    return this.billingService.applyDiscount(id, discountDto);
  }

  @Patch(':id/tip')
  @ApiOperation({ summary: 'Add tip to bill' })
  @ApiResponse({ status: 200, description: 'Tip added' })
  @ApiQuery({ name: 'amount', type: Number })
  addTip(@Param('id') id: string, @Query('amount') amount: number) {
    return this.billingService.addTip(id, amount);
  }

  @Post(':id/void')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void bill' })
  @ApiResponse({ status: 200, description: 'Bill voided' })
  @ApiQuery({ name: 'reason', required: false })
  voidBill(@Param('id') id: string, @Query('reason') reason?: string) {
    return this.billingService.voidBill(id, reason);
  }

  @Post(':id/print')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print bill receipt' })
  @ApiResponse({ status: 200, description: 'Bill sent to printer' })
  printBill(@Param('id') id: string) {
    return this.billingService.printBill(id);
  }
}
