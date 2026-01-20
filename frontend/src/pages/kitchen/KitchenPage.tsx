import { useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Empty, message } from 'antd';
import { CheckOutlined, ClockCircleOutlined, FireOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import { Order, OrderItem } from '@/types';

const { Title, Text } = Typography;

export default function KitchenPage() {
  const queryClient = useQueryClient();

  // Fetch kitchen orders
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const response = await api.get('/orders/kitchen');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await api.patch(`/orders/${orderId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      message.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
    onError: () => {
      message.error('Error al actualizar el estado');
    },
  });

  // Listen for real-time kitchen updates
  useEffect(() => {
    socketService.subscribeToKitchen();

    const unsubscribeNew = socketService.on('kitchen:new-order', () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    });

    const unsubscribeUpdate = socketService.on('kitchen:order-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'gold',
      PREPARING: 'blue',
      READY: 'green',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      PREPARING: 'Preparando',
      READY: 'Listo',
    };
    return labels[status] || status;
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60); // minutes
    
    if (diff < 1) return 'Ahora';
    if (diff < 60) return `${diff} min`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  const getTimeColor = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60); // minutes
    
    if (diff < 10) return '#52c41a'; // green
    if (diff < 20) return '#faad14'; // yellow
    return '#ff4d4f'; // red
  };

  const handleStartPreparing = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'PREPARING' });
  };

  const handleMarkReady = (orderId: string) => {
    updateStatusMutation.mutate({ orderId, status: 'READY' });
  };

  // Group orders by status
  const pendingOrders = orders?.filter(o => o.status === 'PENDING') || [];
  const preparingOrders = orders?.filter(o => o.status === 'PREPARING') || [];
  const readyOrders = orders?.filter(o => o.status === 'READY') || [];

  const renderOrderCard = (order: Order) => {
    const kitchenItems = order.items.filter(item => item.product?.sendToKitchen !== false);
    
    return (
      <Card
        key={order.id}
        className={`kitchen-order-card status-${order.status.toLowerCase()}`}
        size="small"
        title={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Text strong style={{ fontSize: 16 }}>
                Mesa {order.tableSession?.table?.number || 'N/A'}
              </Text>
              <Tag color={getStatusColor(order.status)}>
                {getStatusLabel(order.status)}
              </Tag>
            </Space>
            <Space>
              <ClockCircleOutlined style={{ color: getTimeColor(order.createdAt) }} />
              <Text style={{ color: getTimeColor(order.createdAt) }}>
                {getTimeSince(order.createdAt)}
              </Text>
            </Space>
          </Space>
        }
        actions={
          order.status === 'PENDING'
            ? [
                <Button
                  type="primary"
                  icon={<FireOutlined />}
                  onClick={() => handleStartPreparing(order.id)}
                  loading={updateStatusMutation.isPending}
                >
                  Preparar
                </Button>,
              ]
            : order.status === 'PREPARING'
            ? [
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => handleMarkReady(order.id)}
                  loading={updateStatusMutation.isPending}
                >
                  Listo
                </Button>,
              ]
            : undefined
        }
      >
        <div>
          {kitchenItems.map((item: OrderItem) => (
            <div key={item.id} style={{ marginBottom: 8 }}>
              <Space align="start">
                <Tag color="blue" style={{ minWidth: 28, textAlign: 'center' }}>
                  {item.quantity}
                </Tag>
                <div>
                  <Text strong>{item.product?.name || 'Producto'}</Text>
                  {item.notes && (
                    <Text
                      type="danger"
                      style={{ display: 'block', fontSize: 12, fontStyle: 'italic' }}
                    >
                      ⚠️ {item.notes}
                    </Text>
                  )}
                </div>
              </Space>
            </div>
          ))}
        </div>
        {order.notes && (
          <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff7e6', borderRadius: 4 }}>
            <Text type="warning">📝 {order.notes}</Text>
          </div>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        <FireOutlined style={{ marginRight: 8 }} />
        Vista de Cocina
      </Title>

      {orders?.length === 0 ? (
        <Empty
          description="No hay pedidos pendientes"
          style={{ marginTop: 100 }}
        />
      ) : (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Pending Column */}
          <div style={{ flex: 1 }}>
            <Card
              title={
                <Space>
                  <Text strong>Pendientes</Text>
                  <Tag color="gold">{pendingOrders.length}</Tag>
                </Space>
              }
              bodyStyle={{ padding: 12 }}
              style={{ backgroundColor: '#fffbe6' }}
            >
              <div className="kitchen-grid" style={{ gridTemplateColumns: '1fr' }}>
                {pendingOrders.length === 0 ? (
                  <Text type="secondary">Sin pedidos pendientes</Text>
                ) : (
                  pendingOrders.map(renderOrderCard)
                )}
              </div>
            </Card>
          </div>

          {/* Preparing Column */}
          <div style={{ flex: 1 }}>
            <Card
              title={
                <Space>
                  <Text strong>Preparando</Text>
                  <Tag color="blue">{preparingOrders.length}</Tag>
                </Space>
              }
              bodyStyle={{ padding: 12 }}
              style={{ backgroundColor: '#e6f7ff' }}
            >
              <div className="kitchen-grid" style={{ gridTemplateColumns: '1fr' }}>
                {preparingOrders.length === 0 ? (
                  <Text type="secondary">Sin pedidos en preparación</Text>
                ) : (
                  preparingOrders.map(renderOrderCard)
                )}
              </div>
            </Card>
          </div>

          {/* Ready Column */}
          <div style={{ flex: 1 }}>
            <Card
              title={
                <Space>
                  <Text strong>Listos</Text>
                  <Tag color="green">{readyOrders.length}</Tag>
                </Space>
              }
              bodyStyle={{ padding: 12 }}
              style={{ backgroundColor: '#f6ffed' }}
            >
              <div className="kitchen-grid" style={{ gridTemplateColumns: '1fr' }}>
                {readyOrders.length === 0 ? (
                  <Text type="secondary">Sin pedidos listos</Text>
                ) : (
                  readyOrders.map(renderOrderCard)
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
