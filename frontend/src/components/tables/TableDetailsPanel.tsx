import { useMemo } from 'react';
import { Card, Typography, List, Tag, Space, Button, Divider, Empty, Statistic, Row, Col, Popconfirm } from 'antd';
import { 
  UserOutlined, 
  ClockCircleOutlined, 
  ShoppingCartOutlined,
  PrinterOutlined,
  DollarOutlined,
  EditOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Table, Order, OrderStatus } from '@/types';

const { Title, Text } = Typography;

interface TableDetailsPanelProps {
  table: Table | null;
  onClose: () => void;
  onOpenSession: (table: Table) => void;
  onViewSession: (table: Table) => void;
  onEditTable: (table: Table) => void;
  onDeleteTable?: (table: Table) => void;
  onPrintTicket?: (table: Table) => void;
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { color: string; label: string }> = {
  PENDING: { color: 'gold', label: 'Pendiente' },
  PREPARING: { color: 'blue', label: 'Preparando' },
  READY: { color: 'green', label: 'Listo' },
  SERVED: { color: 'purple', label: 'Servido' },
  CANCELLED: { color: 'red', label: 'Cancelado' },
};

const TABLE_STATUS_CONFIG = {
  FREE: { color: '#52c41a', label: 'Libre' },
  OCCUPIED: { color: '#ff4d4f', label: 'Ocupada' },
  RESERVED: { color: '#faad14', label: 'Reservada' },
  BLOCKED: { color: '#8c8c8c', label: 'Bloqueada' },
};

export default function TableDetailsPanel({
  table,
  onClose,
  onOpenSession,
  onViewSession,
  onEditTable,
  onDeleteTable,
  onPrintTicket,
}: TableDetailsPanelProps) {
  const currentSession = table?.sessions?.[0] || table?.currentSession;
  
  // Calculate session stats
  const sessionStats = useMemo(() => {
    if (!currentSession) return null;
    
    const orders = currentSession.orders || [];
    const totalItems = orders.reduce((sum, order) => 
      sum + (order.items?.length || 0), 0
    );
    const totalAmount = orders.reduce((sum, order) => 
      sum + (order.items?.reduce((itemSum, item) => 
        itemSum + (item.totalPrice || 0), 0
      ) || 0), 0
    );
    const pendingOrders = orders.filter(o => 
      o.status === 'PENDING' || o.status === 'PREPARING'
    ).length;
    
    // Duration
    const start = new Date(currentSession.openedAt);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);
    
    return {
      totalItems,
      totalAmount,
      pendingOrders,
      duration: diffMins,
      orders: orders.length,
    };
  }, [currentSession]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return `${hours}h ${remaining}m`;
  };

  if (!table) {
    return (
      <Card className="table-details-panel empty">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Selecciona una mesa para ver sus detalles"
        />
      </Card>
    );
  }

  const statusConfig = TABLE_STATUS_CONFIG[table.status];

  return (
    <Card 
      className="table-details-panel"
      title={
        <Space>
          <span>Mesa {table.number}</span>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </Space>
      }
      extra={
        <Button 
          type="text" 
          icon={<CloseCircleOutlined />} 
          onClick={onClose}
        />
      }
    >
      {/* Table Info */}
      <div className="table-info-section">
        {table.name && (
          <Text type="secondary">{table.name}</Text>
        )}
        <div className="table-meta">
          <Space>
            <UserOutlined />
            <Text>Capacidad: {table.capacity} personas</Text>
          </Space>
          {table.zone && (
            <Space>
              <span 
                style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%', 
                  backgroundColor: table.zone.color || '#1890ff',
                  display: 'inline-block',
                }} 
              />
              <Text>{table.zone.name}</Text>
            </Space>
          )}
        </div>
      </div>

      <Divider />

      {/* Session Info (if occupied) */}
      {currentSession && sessionStats && (
        <>
          <div className="session-info-section">
            <Title level={5}>Sesión Actual</Title>
            
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Comensales"
                  value={currentSession.guestCount || currentSession.customerCount || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Tiempo"
                  value={formatDuration(sessionStats.duration)}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Pedidos"
                  value={sessionStats.orders}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Total"
                  value={sessionStats.totalAmount}
                  precision={2}
                  prefix="€"
                  valueStyle={{ fontSize: 20, color: '#1890ff' }}
                />
              </Col>
            </Row>

            {currentSession.guestName && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">Cliente: </Text>
                <Text strong>{currentSession.guestName}</Text>
              </div>
            )}

            {currentSession.notes && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Notas: </Text>
                <Text>{currentSession.notes}</Text>
              </div>
            )}
          </div>

          <Divider />

          {/* Recent Orders */}
          <div className="orders-section">
            <Title level={5}>
              <Space>
                Pedidos
                {sessionStats.pendingOrders > 0 && (
                  <Tag color="gold">{sessionStats.pendingOrders} pendientes</Tag>
                )}
              </Space>
            </Title>
            
            {currentSession.orders && currentSession.orders.length > 0 ? (
              <List
                size="small"
                dataSource={currentSession.orders.slice(0, 5)}
                renderItem={(order: Order) => {
                  const statusCfg = ORDER_STATUS_CONFIG[order.status];
                  return (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text>#{order.orderNumber || order.id.slice(-4)}</Text>
                            <Tag color={statusCfg.color} style={{ margin: 0 }}>
                              {statusCfg.label}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Text type="secondary">
                            {order.items?.length || 0} items · {
                              formatCurrency(
                                order.items?.reduce((sum, item) => 
                                  sum + (item.totalPrice || 0), 0
                                ) || 0
                              )
                            }
                          </Text>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Sin pedidos"
              />
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <Divider />
      <div className="table-actions">
        {table.status === 'FREE' && (
          <Button
            type="primary"
            size="large"
            block
            icon={<UserOutlined />}
            onClick={() => onOpenSession(table)}
          >
            Abrir Mesa
          </Button>
        )}
        
        {table.status === 'OCCUPIED' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary"
              size="large"
              block
              icon={<ShoppingCartOutlined />}
              onClick={() => onViewSession(table)}
            >
              Ver / Añadir Pedidos
            </Button>
            <Row gutter={8}>
              <Col span={12}>
                <Button
                  size="large"
                  block
                  icon={<DollarOutlined />}
                  onClick={() => onViewSession(table)}
                >
                  Cobrar
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  size="large"
                  block
                  icon={<PrinterOutlined />}
                  onClick={() => onPrintTicket?.(table)}
                >
                  Imprimir
                </Button>
              </Col>
            </Row>
          </Space>
        )}

        {table.status === 'RESERVED' && (
          <Button
            type="primary"
            size="large"
            block
            icon={<UserOutlined />}
            onClick={() => onOpenSession(table)}
          >
            Convertir en Ocupada
          </Button>
        )}

        <Space style={{ marginTop: 8, width: '100%' }} split={<span>·</span>}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onEditTable(table)}
          >
            Editar
          </Button>
          
          {onDeleteTable && table.status === 'FREE' && (
            <Popconfirm
              title="¿Eliminar esta mesa?"
              description="Esta acción no se puede deshacer"
              okText="Eliminar"
              cancelText="Cancelar"
              okType="danger"
              onConfirm={() => onDeleteTable(table)}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              >
                Eliminar
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>
    </Card>
  );
}
