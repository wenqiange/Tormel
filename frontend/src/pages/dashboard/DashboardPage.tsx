import { Row, Col, Card, Statistic, Typography, List, Tag, Space, Progress } from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  TableOutlined,
  TeamOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

const { Title, Text } = Typography;

interface DashboardStats {
  todaySales: number;
  totalOrders: number;
  occupiedTables: number;
  totalTables: number;
  activeWaiters: number;
  averageTicket: number;
  topProducts: { name: string; quantity: number }[];
  recentOrders: {
    id: string;
    tableName: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats');
      return response.data;
    },
    // Placeholder data for demo
    placeholderData: {
      todaySales: 2456.80,
      totalOrders: 47,
      occupiedTables: 8,
      totalTables: 15,
      activeWaiters: 4,
      averageTicket: 52.27,
      topProducts: [
        { name: 'Pizza Margherita', quantity: 23 },
        { name: 'Pasta Carbonara', quantity: 18 },
        { name: 'Tiramisu', quantity: 15 },
        { name: 'Coca-Cola', quantity: 42 },
        { name: 'Agua Mineral', quantity: 38 },
      ],
      recentOrders: [
        { id: '1', tableName: 'Mesa 5', total: 45.50, status: 'PREPARING', createdAt: new Date().toISOString() },
        { id: '2', tableName: 'Mesa 3', total: 78.20, status: 'SERVED', createdAt: new Date().toISOString() },
        { id: '3', tableName: 'Mesa 8', total: 32.00, status: 'READY', createdAt: new Date().toISOString() },
      ],
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'gold',
      PREPARING: 'blue',
      READY: 'green',
      SERVED: 'purple',
      CANCELLED: 'red',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      PREPARING: 'Preparando',
      READY: 'Listo',
      SERVED: 'Servido',
      CANCELLED: 'Cancelado',
    };
    return labels[status] || status;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const occupancyPercent = stats ? Math.round((stats.occupiedTables / stats.totalTables) * 100) : 0;

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        Dashboard
      </Title>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ventas de Hoy"
              value={stats?.todaySales || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="€"
              valueStyle={{ color: '#3f8600' }}
            />
            <Space style={{ marginTop: 8 }}>
              <ArrowUpOutlined style={{ color: '#3f8600' }} />
              <Text type="secondary">+12% vs ayer</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pedidos Hoy"
              value={stats?.totalOrders || 0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Ticket promedio: {formatCurrency(stats?.averageTicket || 0)}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Mesas Ocupadas"
              value={stats?.occupiedTables || 0}
              suffix={`/ ${stats?.totalTables || 0}`}
              prefix={<TableOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Progress 
              percent={occupancyPercent} 
              size="small" 
              style={{ marginTop: 8 }}
              strokeColor="#722ed1"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Meseros Activos"
              value={stats?.activeWaiters || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Atendiendo clientes
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Recent Orders */}
        <Col xs={24} lg={12}>
          <Card 
            title="Pedidos Recientes" 
            extra={<ClockCircleOutlined />}
            bodyStyle={{ padding: 0 }}
          >
            <List
              dataSource={stats?.recentOrders || []}
              renderItem={(order) => (
                <List.Item
                  style={{ padding: '12px 24px' }}
                  actions={[
                    <Tag color={getStatusColor(order.status)} key="status">
                      {getStatusLabel(order.status)}
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    title={order.tableName}
                    description={new Date(order.createdAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                  <div>{formatCurrency(order.total)}</div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Top Products */}
        <Col xs={24} lg={12}>
          <Card title="Productos Más Vendidos">
            <List
              dataSource={stats?.topProducts || []}
              renderItem={(product, index) => (
                <List.Item>
                  <Space>
                    <Tag color={index < 3 ? 'gold' : 'default'}>
                      #{index + 1}
                    </Tag>
                    <Text>{product.name}</Text>
                  </Space>
                  <Text strong>{product.quantity} vendidos</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
