import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      
      if (token) {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('JWT_SECRET'),
        });
        client.userId = payload.sub;
        client.userRole = payload.role;
      }

      this.connectedClients.set(client.id, client);
      this.logger.log(`Client connected: ${client.id} (User: ${client.userId || 'anonymous'})`);

      // Send connection acknowledgment
      client.emit('connected', {
        clientId: client.id,
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`Client ${client.id} connected without valid auth`);
      this.connectedClients.set(client.id, client);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return client.handshake.auth?.token || null;
  }

  // ============================================
  // SUBSCRIPTION HANDLERS
  // ============================================

  @SubscribeMessage('subscribe:tables')
  handleSubscribeTables(@ConnectedSocket() client: Socket) {
    client.join('tables');
    this.logger.debug(`Client ${client.id} subscribed to tables`);
    return { event: 'subscribed', data: { room: 'tables' } };
  }

  @SubscribeMessage('subscribe:kitchen')
  handleSubscribeKitchen(@ConnectedSocket() client: Socket) {
    client.join('kitchen');
    this.logger.debug(`Client ${client.id} subscribed to kitchen`);
    return { event: 'subscribed', data: { room: 'kitchen' } };
  }

  @SubscribeMessage('subscribe:orders')
  handleSubscribeOrders(@ConnectedSocket() client: Socket) {
    client.join('orders');
    this.logger.debug(`Client ${client.id} subscribed to orders`);
    return { event: 'subscribed', data: { room: 'orders' } };
  }

  @SubscribeMessage('subscribe:billing')
  handleSubscribeBilling(@ConnectedSocket() client: Socket) {
    client.join('billing');
    this.logger.debug(`Client ${client.id} subscribed to billing`);
    return { event: 'subscribed', data: { room: 'billing' } };
  }

  @SubscribeMessage('subscribe:table')
  handleSubscribeTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string },
  ) {
    const room = `table:${data.tableId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
    return { event: 'subscribed', data: { room } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    client.leave(data.room);
    this.logger.debug(`Client ${client.id} unsubscribed from ${data.room}`);
    return { event: 'unsubscribed', data: { room: data.room } };
  }

  // ============================================
  // EMIT METHODS (called from services)
  // ============================================

  // Table events
  emitTableUpdated(table: any) {
    this.server.to('tables').emit('table:updated', {
      type: 'TABLE_UPDATED',
      payload: table,
      timestamp: new Date().toISOString(),
    });
    
    // Also emit to specific table room
    this.server.to(`table:${table.id}`).emit('table:updated', {
      type: 'TABLE_UPDATED',
      payload: table,
      timestamp: new Date().toISOString(),
    });
  }

  emitTableDeleted(tableId: string) {
    this.server.to('tables').emit('table:deleted', {
      type: 'TABLE_DELETED',
      payload: { id: tableId },
      timestamp: new Date().toISOString(),
    });
  }

  emitZoneUpdated(zone: any) {
    this.server.to('tables').emit('zone:updated', {
      type: 'ZONE_UPDATED',
      payload: zone,
      timestamp: new Date().toISOString(),
    });
  }

  // Order events
  emitOrderCreated(order: any) {
    this.server.to('orders').emit('order:created', {
      type: 'ORDER_CREATED',
      payload: order,
      timestamp: new Date().toISOString(),
    });

    // Emit to kitchen if has kitchen items
    const hasKitchenItems = order.items?.some(
      (item: any) => item.product?.sendToKitchen,
    );
    if (hasKitchenItems) {
      this.server.to('kitchen').emit('kitchen:new-order', {
        type: 'KITCHEN_NEW_ORDER',
        payload: order,
        timestamp: new Date().toISOString(),
      });
    }

    // Emit to specific table
    if (order.tableSession?.table?.id) {
      this.server
        .to(`table:${order.tableSession.table.id}`)
        .emit('order:created', {
          type: 'ORDER_CREATED',
          payload: order,
          timestamp: new Date().toISOString(),
        });
    }
  }

  emitOrderUpdated(order: any) {
    this.server.to('orders').emit('order:updated', {
      type: 'ORDER_UPDATED',
      payload: order,
      timestamp: new Date().toISOString(),
    });

    this.server.to('kitchen').emit('kitchen:order-updated', {
      type: 'KITCHEN_ORDER_UPDATED',
      payload: order,
      timestamp: new Date().toISOString(),
    });

    if (order.tableSession?.table?.id) {
      this.server
        .to(`table:${order.tableSession.table.id}`)
        .emit('order:updated', {
          type: 'ORDER_UPDATED',
          payload: order,
          timestamp: new Date().toISOString(),
        });
    }
  }

  emitOrderStatusChanged(order: any) {
    this.server.to('orders').emit('order:status', {
      type: 'ORDER_STATUS_CHANGED',
      payload: {
        orderId: order.id,
        status: order.status,
        order,
      },
      timestamp: new Date().toISOString(),
    });

    this.server.to('kitchen').emit('kitchen:order-status', {
      type: 'KITCHEN_ORDER_STATUS',
      payload: {
        orderId: order.id,
        status: order.status,
        order,
      },
      timestamp: new Date().toISOString(),
    });

    if (order.tableSession?.table?.id) {
      this.server
        .to(`table:${order.tableSession.table.id}`)
        .emit('order:status', {
          type: 'ORDER_STATUS_CHANGED',
          payload: {
            orderId: order.id,
            status: order.status,
            order,
          },
          timestamp: new Date().toISOString(),
        });
    }
  }

  // Billing events
  emitBillCreated(bill: any) {
    this.server.to('billing').emit('bill:created', {
      type: 'BILL_CREATED',
      payload: bill,
      timestamp: new Date().toISOString(),
    });

    if (bill.tableSession?.table?.id) {
      this.server
        .to(`table:${bill.tableSession.table.id}`)
        .emit('bill:created', {
          type: 'BILL_CREATED',
          payload: bill,
          timestamp: new Date().toISOString(),
        });
    }
  }

  emitBillUpdated(bill: any) {
    this.server.to('billing').emit('bill:updated', {
      type: 'BILL_UPDATED',
      payload: bill,
      timestamp: new Date().toISOString(),
    });

    if (bill.tableSession?.table?.id) {
      this.server
        .to(`table:${bill.tableSession.table.id}`)
        .emit('bill:updated', {
          type: 'BILL_UPDATED',
          payload: bill,
          timestamp: new Date().toISOString(),
        });
    }
  }

  // Payment events
  emitPaymentReceived(payment: any) {
    this.server.to('billing').emit('payment:received', {
      type: 'PAYMENT_RECEIVED',
      payload: payment,
      timestamp: new Date().toISOString(),
    });

    if (payment.bill?.tableSession?.table?.id) {
      this.server
        .to(`table:${payment.bill.tableSession.table.id}`)
        .emit('payment:received', {
          type: 'PAYMENT_RECEIVED',
          payload: payment,
          timestamp: new Date().toISOString(),
        });
    }
  }

  // System notifications
  emitNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    this.server.emit('notification', {
      type: 'NOTIFICATION',
      payload: {
        message,
        notificationType: type,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
