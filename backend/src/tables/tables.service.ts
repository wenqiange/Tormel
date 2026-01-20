import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TableStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { OpenTableDto } from './dto/open-table.dto';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // ============================================
  // ZONES
  // ============================================

  async createZone(restaurantId: string, createZoneDto: CreateZoneDto) {
    const zone = await this.prisma.zone.create({
      data: {
        restaurantId,
        ...createZoneDto,
      },
      include: {
        tables: true,
      },
    });

    this.realtimeGateway.emitZoneUpdated(zone);
    return zone;
  }

  async findAllZones(restaurantId?: string) {
    const where = restaurantId ? { restaurantId, isActive: true } : { isActive: true };

    return this.prisma.zone.findMany({
      where,
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { number: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findZoneById(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    return zone;
  }

  async updateZone(id: string, updateZoneDto: UpdateZoneDto) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    const updatedZone = await this.prisma.zone.update({
      where: { id },
      data: updateZoneDto,
      include: {
        tables: true,
      },
    });

    this.realtimeGateway.emitZoneUpdated(updatedZone);
    return updatedZone;
  }

  async deleteZone(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: { tables: true },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    // Check if any table is occupied
    const occupiedTables = zone.tables.filter((t) => t.status === TableStatus.OCCUPIED);
    if (occupiedTables.length > 0) {
      throw new BadRequestException('Cannot delete zone with occupied tables');
    }

    await this.prisma.zone.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================
  // TABLES
  // ============================================

  async createTable(createTableDto: CreateTableDto) {
    // Check if zone exists
    const zone = await this.prisma.zone.findUnique({
      where: { id: createTableDto.zoneId },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    // Check if table number already exists in zone
    const existingTable = await this.prisma.table.findFirst({
      where: {
        zoneId: createTableDto.zoneId,
        number: createTableDto.number,
      },
    });

    if (existingTable) {
      throw new ConflictException('Table number already exists in this zone');
    }

    const table = await this.prisma.table.create({
      data: createTableDto,
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
        },
      },
    });

    this.realtimeGateway.emitTableUpdated(table);
    return table;
  }

  async findAllTables(zoneId?: string) {
    const where = zoneId
      ? { zoneId, isActive: true }
      : { isActive: true };

    return this.prisma.table.findMany({
      where,
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
          include: {
            orders: {
              include: {
                items: true,
              },
            },
          },
        },
      },
      orderBy: [{ zone: { sortOrder: 'asc' } }, { number: 'asc' }],
    });
  }

  async findTableById(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
          include: {
            orders: {
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
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            bills: {
              include: {
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  async updateTable(id: string, updateTableDto: UpdateTableDto) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    // Check table number uniqueness if being updated
    if (updateTableDto.number && updateTableDto.number !== table.number) {
      const existingTable = await this.prisma.table.findFirst({
        where: {
          zoneId: updateTableDto.zoneId || table.zoneId,
          number: updateTableDto.number,
          id: { not: id },
        },
      });

      if (existingTable) {
        throw new ConflictException('Table number already exists in this zone');
      }
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: updateTableDto,
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
        },
      },
    });

    this.realtimeGateway.emitTableUpdated(updatedTable);
    return updatedTable;
  }

  async deleteTable(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.status === TableStatus.OCCUPIED) {
      throw new BadRequestException('Cannot delete occupied table');
    }

    await this.prisma.table.update({
      where: { id },
      data: { isActive: false },
    });

    this.realtimeGateway.emitTableDeleted(id);
  }

  // ============================================
  // TABLE SESSIONS
  // ============================================

  async openTable(id: string, openTableDto: OpenTableDto) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { closedAt: null },
          take: 1,
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.sessions.length > 0) {
      throw new BadRequestException('Table already has an active session');
    }

    if (table.status === TableStatus.BLOCKED) {
      throw new BadRequestException('Table is blocked');
    }

    const session = await this.prisma.tableSession.create({
      data: {
        tableId: id,
        guestCount: openTableDto.guestCount,
        guestName: openTableDto.guestName,
        notes: openTableDto.notes,
      },
    });

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: { status: TableStatus.OCCUPIED },
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
        },
      },
    });

    this.realtimeGateway.emitTableUpdated(updatedTable);
    return { table: updatedTable, session };
  }

  async closeTable(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { closedAt: null },
          take: 1,
          include: {
            orders: {
              where: {
                status: { notIn: ['SERVED', 'CANCELLED'] },
              },
            },
            bills: {
              where: {
                status: { notIn: ['PAID', 'CANCELLED', 'VOID'] },
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.sessions.length === 0) {
      throw new BadRequestException('Table has no active session');
    }

    const session = table.sessions[0];

    // Check for unpaid bills
    if (session.bills.length > 0) {
      throw new BadRequestException('Table has unpaid bills');
    }

    // Check for pending orders
    if (session.orders.length > 0) {
      throw new BadRequestException('Table has pending orders');
    }

    // Close session
    await this.prisma.tableSession.update({
      where: { id: session.id },
      data: { closedAt: new Date() },
    });

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: { status: TableStatus.FREE },
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
        },
      },
    });

    this.realtimeGateway.emitTableUpdated(updatedTable);
    return updatedTable;
  }

  async updateTableStatus(id: string, status: TableStatus) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: { status },
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
        },
      },
    });

    this.realtimeGateway.emitTableUpdated(updatedTable);
    return updatedTable;
  }

  async getTableSession(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { closedAt: null },
          take: 1,
          include: {
            orders: {
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
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            bills: {
              include: {
                items: {
                  include: { orderItem: { include: { product: true } } },
                },
                payments: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.sessions.length === 0) {
      return null;
    }

    return table.sessions[0];
  }

  async getTablesOverview() {
    const tables = await this.prisma.table.findMany({
      where: { isActive: true },
      include: {
        zone: true,
        sessions: {
          where: { closedAt: null },
          take: 1,
          include: {
            orders: {
              select: {
                id: true,
                status: true,
              },
            },
            bills: {
              select: {
                id: true,
                status: true,
                total: true,
                paidAmount: true,
              },
            },
          },
        },
      },
    });

    const overview = {
      total: tables.length,
      free: tables.filter((t) => t.status === TableStatus.FREE).length,
      occupied: tables.filter((t) => t.status === TableStatus.OCCUPIED).length,
      reserved: tables.filter((t) => t.status === TableStatus.RESERVED).length,
      blocked: tables.filter((t) => t.status === TableStatus.BLOCKED).length,
      byZone: {} as Record<string, { total: number; free: number; occupied: number }>,
    };

    // Group by zone
    for (const table of tables) {
      if (!overview.byZone[table.zone.name]) {
        overview.byZone[table.zone.name] = { total: 0, free: 0, occupied: 0 };
      }
      overview.byZone[table.zone.name].total++;
      if (table.status === TableStatus.FREE) {
        overview.byZone[table.zone.name].free++;
      } else if (table.status === TableStatus.OCCUPIED) {
        overview.byZone[table.zone.name].occupied++;
      }
    }

    return overview;
  }
}
