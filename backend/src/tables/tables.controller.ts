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
import { TableStatus, UserRole } from '@prisma/client';

import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { OpenTableDto } from './dto/open-table.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('tables')
@ApiBearerAuth()
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  // ============================================
  // ZONES
  // ============================================

  @Post('zones')
  @Public() // TODO: Restaurar @Roles después del desarrollo
  @ApiOperation({ summary: 'Create new zone' })
  @ApiResponse({ status: 201, description: 'Zone created successfully' })
  createZone(
    @Body() createZoneDto: CreateZoneDto,
    @Query('restaurantId') restaurantId: string = 'default-restaurant',
  ) {
    return this.tablesService.createZone(restaurantId, createZoneDto);
  }

  @Get('zones')
  @Public()
  @ApiOperation({ summary: 'Get all zones with tables' })
  @ApiResponse({ status: 200, description: 'List of zones' })
  @ApiQuery({ name: 'restaurantId', required: false })
  findAllZones(@Query('restaurantId') restaurantId?: string) {
    return this.tablesService.findAllZones(restaurantId);
  }

  @Get('zones/:id')
  @ApiOperation({ summary: 'Get zone by ID' })
  @ApiResponse({ status: 200, description: 'Zone found' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  findZone(@Param('id') id: string) {
    return this.tablesService.findZoneById(id);
  }

  @Patch('zones/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update zone' })
  @ApiResponse({ status: 200, description: 'Zone updated successfully' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  updateZone(@Param('id') id: string, @Body() updateZoneDto: UpdateZoneDto) {
    return this.tablesService.updateZone(id, updateZoneDto);
  }

  @Delete('zones/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete zone' })
  @ApiResponse({ status: 204, description: 'Zone deleted' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  deleteZone(@Param('id') id: string) {
    return this.tablesService.deleteZone(id);
  }

  // ============================================
  // TABLES
  // ============================================

  @Post()
  @Public() // TODO: Restaurar @Roles(UserRole.ADMIN, UserRole.MANAGER) después del desarrollo
  @ApiOperation({ summary: 'Create new table' })
  @ApiResponse({ status: 201, description: 'Table created successfully' })
  createTable(@Body() createTableDto: CreateTableDto) {
    return this.tablesService.createTable(createTableDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all tables' })
  @ApiResponse({ status: 200, description: 'List of tables' })
  @ApiQuery({ name: 'zoneId', required: false })
  findAllTables(@Query('zoneId') zoneId?: string) {
    return this.tablesService.findAllTables(zoneId);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get tables overview statistics' })
  @ApiResponse({ status: 200, description: 'Tables overview' })
  getOverview() {
    return this.tablesService.getTablesOverview();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get table by ID' })
  @ApiResponse({ status: 200, description: 'Table found' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  findTable(@Param('id') id: string) {
    return this.tablesService.findTableById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update table' })
  @ApiResponse({ status: 200, description: 'Table updated successfully' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  updateTable(@Param('id') id: string, @Body() updateTableDto: UpdateTableDto) {
    return this.tablesService.updateTable(id, updateTableDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete table' })
  @ApiResponse({ status: 204, description: 'Table deleted' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  deleteTable(@Param('id') id: string) {
    return this.tablesService.deleteTable(id);
  }

  // ============================================
  // TABLE STATUS & SESSIONS
  // ============================================

  @Post(':id/open')
  @ApiOperation({ summary: 'Open table (start session)' })
  @ApiResponse({ status: 200, description: 'Table opened successfully' })
  @ApiResponse({ status: 400, description: 'Table already has active session' })
  openTable(@Param('id') id: string, @Body() openTableDto: OpenTableDto) {
    return this.tablesService.openTable(id, openTableDto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close table (end session)' })
  @ApiResponse({ status: 200, description: 'Table closed successfully' })
  @ApiResponse({ status: 400, description: 'Table has pending orders or bills' })
  closeTable(@Param('id') id: string) {
    return this.tablesService.closeTable(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update table status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiQuery({ name: 'status', enum: TableStatus })
  updateStatus(
    @Param('id') id: string,
    @Query('status') status: TableStatus,
  ) {
    return this.tablesService.updateTableStatus(id, status);
  }

  @Get(':id/session')
  @ApiOperation({ summary: 'Get active table session with orders and bills' })
  @ApiResponse({ status: 200, description: 'Session data' })
  getSession(@Param('id') id: string) {
    return this.tablesService.getTableSession(id);
  }
}
