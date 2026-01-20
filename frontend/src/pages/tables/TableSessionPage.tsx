import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Row, Col, Card, Typography, Button, List, Tag, Space, Divider, 
  Modal, InputNumber, Input, message, Spin, Empty, Popconfirm, Badge
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  PrinterOutlined,
  DollarOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import { Table, Category, Product, Order, OrderItem, CartItem } from '@/types';
import { useCartStore } from '@/stores/cartStore';

const { Title, Text } = Typography;

export default function TableSessionPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { items: cartItems, addItem, removeItem, updateQuantity, clearCart, getTotal } = useCartStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [itemNotesModal, setItemNotesModal] = useState<{ visible: boolean; item?: CartItem }>({ visible: false });
  const [notesInput, setNotesInput] = useState('');

  // Fetch table details with current session
  const { data: table, isLoading: tableLoading } = useQuery<Table>({
    queryKey: ['table', tableId],
    queryFn: async () => {
      const response = await api.get(`/tables/${tableId}`);
      return response.data;
    },
  });

  // Fetch categories with products
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/products/categories');
      return response.data;
    },
  });

  // Fetch orders for current session
  const { data: orders } = useQuery<Order[]>({
    queryKey: ['table-orders', table?.currentSession?.id],
    queryFn: async () => {
      if (!table?.currentSession?.id) return [];
      const response = await api.get(`/orders?tableSessionId=${table.currentSession.id}`);
      return response.data;
    },
    enabled: !!table?.currentSession?.id,
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (items: { productId: string; quantity: number; notes?: string; modifiers?: string[] }[]) => {
      const response = await api.post('/orders', {
        tableSessionId: table?.currentSession?.id,
        items,
      });
      return response.data;
    },
    onSuccess: () => {
      message.success('Pedido enviado a cocina');
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['table-orders'] });
    },
    onError: () => {
      message.error('Error al crear el pedido');
    },
  });

  // Close table mutation
  const closeTableMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/tables/${tableId}/close`);
      return response.data;
    },
    onSuccess: () => {
      message.success('Mesa cerrada correctamente');
      navigate('/tables');
    },
    onError: () => {
      message.error('Error al cerrar la mesa');
    },
  });

  // Listen for real-time updates
  useEffect(() => {
    if (tableId) {
      socketService.subscribeToTable(tableId);
    }

    const unsubscribeOrder = socketService.on('order:created', () => {
      queryClient.invalidateQueries({ queryKey: ['table-orders'] });
    });

    const unsubscribeOrderUpdate = socketService.on('order:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['table-orders'] });
    });

    return () => {
      if (tableId) {
        socketService.unsubscribeFromTable(tableId);
      }
      unsubscribeOrder();
      unsubscribeOrderUpdate();
    };
  }, [tableId, queryClient]);

  const handleProductClick = (product: Product) => {
    addItem(product, 1);
  };

  const handleSendOrder = () => {
    if (cartItems.length === 0) {
      message.warning('Añada productos al pedido');
      return;
    }

    const items = cartItems.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      notes: item.notes,
      modifiers: item.modifiers?.map(m => m.id),
    }));

    createOrderMutation.mutate(items);
  };

  const handleGoToBilling = () => {
    // Navigate to billing with this table's session
    navigate(`/billing?tableSessionId=${table?.currentSession?.id}`);
  };

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

  const filteredProducts = selectedCategory
    ? categories?.find(c => c.id === selectedCategory)?.products || []
    : categories?.flatMap(c => c.products) || [];

  const totalOrdersAmount = orders?.reduce((sum, order) => 
    sum + order.items.reduce((itemSum, item) => itemSum + item.totalPrice, 0)
  , 0) || 0;

  if (tableLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!table?.currentSession) {
    return (
      <Empty
        description="Esta mesa no tiene una sesión activa"
        style={{ marginTop: 100 }}
      >
        <Button type="primary" onClick={() => navigate('/tables')}>
          Volver a Mesas
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/tables')}
            />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Mesa {table.number}
              </Title>
              <Text type="secondary">
                {table.currentSession.customerCount} comensales • 
                Abierta: {new Date(table.currentSession.openedAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<PrinterOutlined />}>
              Imprimir
            </Button>
            <Button 
              type="primary" 
              icon={<DollarOutlined />}
              onClick={handleGoToBilling}
            >
              Cobrar
            </Button>
            <Popconfirm
              title="¿Cerrar mesa?"
              description="¿Está seguro de cerrar esta mesa?"
              onConfirm={() => closeTableMutation.mutate()}
              okText="Sí"
              cancelText="No"
            >
              <Button 
                danger 
                icon={<CloseCircleOutlined />}
                loading={closeTableMutation.isPending}
              >
                Cerrar Mesa
              </Button>
            </Popconfirm>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* Products Section */}
        <Col xs={24} lg={14}>
          {/* Categories */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space wrap>
              <Button
                type={selectedCategory === null ? 'primary' : 'default'}
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Button>
              {categories?.map(category => (
                <Button
                  key={category.id}
                  type={selectedCategory === category.id ? 'primary' : 'default'}
                  onClick={() => setSelectedCategory(category.id)}
                  style={category.color ? { borderColor: category.color } : undefined}
                >
                  {category.name}
                </Button>
              ))}
            </Space>
          </Card>

          {/* Products Grid */}
          <Card title="Productos" bodyStyle={{ padding: 16 }}>
            <div className="product-grid">
              {filteredProducts.map(product => (
                <Card
                  key={product.id}
                  className="product-card"
                  size="small"
                  hoverable
                  onClick={() => handleProductClick(product)}
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }}
                    />
                  )}
                  <Text strong style={{ display: 'block' }}>{product.name}</Text>
                  <Text type="success">{formatCurrency(product.price)}</Text>
                </Card>
              ))}
            </div>
          </Card>
        </Col>

        {/* Order Section */}
        <Col xs={24} lg={10}>
          {/* Current Cart */}
          <Card 
            title={
              <Space>
                <span>Nuevo Pedido</span>
                {cartItems.length > 0 && (
                  <Badge count={cartItems.reduce((sum, item) => sum + item.quantity, 0)} />
                )}
              </Space>
            }
            extra={
              cartItems.length > 0 && (
                <Button type="link" danger onClick={clearCart}>
                  Limpiar
                </Button>
              )
            }
            style={{ marginBottom: 16 }}
          >
            {cartItems.length === 0 ? (
              <Empty description="Añada productos al pedido" />
            ) : (
              <>
                <List
                  className="order-items-list"
                  dataSource={cartItems}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setItemNotesModal({ visible: true, item });
                            setNotesInput(item.notes || '');
                          }}
                        />,
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeItem(item.product.id)}
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={item.product.name}
                        description={item.notes && <Text type="secondary" style={{ fontSize: 12 }}>{item.notes}</Text>}
                      />
                      <Space>
                        <Button
                          size="small"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <Text>{item.quantity}</Text>
                        <Button
                          size="small"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        >
                          +
                        </Button>
                        <Text strong style={{ minWidth: 60, textAlign: 'right' }}>
                          {formatCurrency(item.product.price * item.quantity)}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
                <Divider />
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong style={{ fontSize: 18 }}>Total</Text>
                  </Col>
                  <Col>
                    <Text strong style={{ fontSize: 18 }}>{formatCurrency(getTotal())}</Text>
                  </Col>
                </Row>
                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<PlusOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={handleSendOrder}
                  loading={createOrderMutation.isPending}
                >
                  Enviar Pedido
                </Button>
              </>
            )}
          </Card>

          {/* Previous Orders */}
          <Card 
            title="Pedidos de la Mesa"
            extra={<Text strong>{formatCurrency(totalOrdersAmount)}</Text>}
          >
            {!orders || orders.length === 0 ? (
              <Empty description="Sin pedidos aún" />
            ) : (
              <List
                dataSource={orders}
                renderItem={(order) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text>Pedido #{order.orderNumber || order.id.slice(-6)}</Text>
                          <Tag color={getStatusColor(order.status)}>
                            {getStatusLabel(order.status)}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          {order.items.map((item: OrderItem) => (
                            <Text key={item.id} type="secondary" style={{ fontSize: 12 }}>
                              {item.quantity}x {item.product?.name || 'Producto'}
                            </Text>
                          ))}
                        </Space>
                      }
                    />
                    <Text strong>
                      {formatCurrency(order.items.reduce((sum: number, item: OrderItem) => sum + item.totalPrice, 0))}
                    </Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Notes Modal */}
      <Modal
        title="Notas del producto"
        open={itemNotesModal.visible}
        onOk={() => {
          if (itemNotesModal.item) {
            // Update notes functionality would go here
          }
          setItemNotesModal({ visible: false });
        }}
        onCancel={() => setItemNotesModal({ visible: false })}
      >
        <Input.TextArea
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          placeholder="Añadir notas especiales..."
          rows={4}
        />
      </Modal>
    </div>
  );
}
