import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Row, Col, Card, Typography, Button, List, Tag, Space, Divider, 
  Modal, InputNumber, Input, message, Spin, Empty, Popconfirm, Badge, Form,
  Checkbox, Select, Tabs, Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  PrinterOutlined,
  DollarOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  WalletOutlined,
  CreditCardOutlined,
  BankOutlined,
  GiftOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import { Table, Category, Product, Order, OrderItem, CartItem, PaymentMethod } from '@/types';
import { useCartStore } from '@/stores/cartStore';

const { Title, Text } = Typography;

export default function TableSessionPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { items: cartItems, addItem, removeItem, updateQuantity, clearCart, getTotal, updateNotes } = useCartStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [itemNotesModal, setItemNotesModal] = useState<{ visible: boolean; item?: CartItem }>({ visible: false });
  const [notesInput, setNotesInput] = useState('');
  
  // Payment modal states
  const [paymentModal, setPaymentModal] = useState(false);
  const [splitPaymentModal, setSplitPaymentModal] = useState(false);
  const [selectedItemsForPayment, setSelectedItemsForPayment] = useState<string[]>([]);
  const [paymentForm] = Form.useForm();

  // Fetch table details with current session
  const { data: table, isLoading: tableLoading } = useQuery<Table>({
    queryKey: ['table', tableId],
    queryFn: async () => {
      const response = await api.get(`/tables/${tableId}`);
      return response.data;
    },
  });

  // Fetch categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/products/categories');
      return response.data;
    },
  });

  // Fetch all products
  const { data: productsResponse } = useQuery<{ data: Product[]; meta?: { total: number } }>({
    queryKey: ['all-products'],
    queryFn: async () => {
      const response = await api.get('/products?limit=100');
      // API returns { data: [...], meta: {...} } after interceptor unwraps success wrapper
      return response.data;
    },
  });

  // Extract products array from paginated response
  const allProducts = Array.isArray(productsResponse?.data) ? productsResponse.data : [];

  const currentSession = table?.currentSession || table?.sessions?.[0];

  // Fetch orders for current session
  const { data: orders } = useQuery<Order[]>({
    queryKey: ['table-orders', currentSession?.id],
    queryFn: async () => {
      if (!currentSession?.id) return [];
      const response = await api.get(`/orders?tableSessionId=${currentSession.id}`);
      return response.data;
    },
    enabled: !!currentSession?.id,
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (items: { productId: string; quantity: number; notes?: string; modifierIds?: string[] }[]) => {
      const response = await api.post('/orders', {
        tableId: tableId,
        items,
      });
      return response.data;
    },
    onSuccess: () => {
      message.success('Pedido enviado correctamente');
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['table-orders'] });
    },
    onError: () => {
      message.error('Error al crear el pedido');
    },
  });

  // Create bill mutation
  const createBillMutation = useMutation({
    mutationFn: async (data: { tableSessionId: string; orderItemIds?: string[] }) => {
      const response = await api.post('/bills', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['table-orders'] });
      return data;
    },
    onError: () => {
      message.error('Error al crear la cuenta');
    },
  });

  // Process payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (data: { billId: string; amount: number; method: PaymentMethod; reference?: string; closeTable?: boolean }) => {
      const response = await api.post('/payments', data);
      return { ...response.data, closeTable: data.closeTable };
    },
    onSuccess: async (data) => {
      message.success('Pago procesado correctamente');
      queryClient.invalidateQueries({ queryKey: ['table-orders'] });
      queryClient.invalidateQueries({ queryKey: ['table', tableId] });
      setPaymentModal(false);
      setSplitPaymentModal(false);
      paymentForm.resetFields();
      setSelectedItemsForPayment([]);
      
      // If full payment was processed, close the table and navigate
      if (data.closeTable) {
        try {
          await api.post(`/tables/${tableId}/close`);
          message.success('Mesa cerrada y liberada');
          navigate('/tables');
        } catch (err) {
          // Table might have remaining items, don't show error
          queryClient.invalidateQueries({ queryKey: ['table', tableId] });
        }
      }
    },
    onError: () => {
      message.error('Error al procesar el pago');
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

  // Open table session (from session page) - direct without asking
  const openSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/tables/${tableId}/open`, { guestCount: 1 });
      return response.data;
    },
    onSuccess: () => {
      message.success('Mesa abierta correctamente');
      queryClient.invalidateQueries({ queryKey: ['table', tableId] });
    },
    onError: () => {
      message.error('Error al abrir la mesa');
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

  // Get all unbilled order items
  const allOrderItems = useMemo(() => {
    if (!orders) return [];
    return orders.flatMap(order => 
      order.items.filter(item => !item.isBilled && item.status !== 'CANCELLED')
    );
  }, [orders]);

  // Calculate total of unbilled items
  const totalUnbilledAmount = useMemo(() => {
    return allOrderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [allOrderItems]);

  // Calculate total of selected items for split payment
  const selectedItemsTotal = useMemo(() => {
    return allOrderItems
      .filter(item => selectedItemsForPayment.includes(item.id))
      .reduce((sum, item) => sum + item.totalPrice, 0);
  }, [allOrderItems, selectedItemsForPayment]);

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
      modifierIds: item.modifiers?.map(m => m.id),
    }));

    createOrderMutation.mutate(items);
  };

  // Handle full payment
  const handleFullPayment = async () => {
    if (allOrderItems.length === 0) {
      message.warning('No hay productos pendientes de cobro');
      return;
    }
    setPaymentModal(true);
    paymentForm.setFieldsValue({ amount: totalUnbilledAmount, method: 'CASH' });
  };

  // Handle split payment mode
  const handleSplitPaymentMode = () => {
    if (allOrderItems.length === 0) {
      message.warning('No hay productos pendientes de cobro');
      return;
    }
    setSelectedItemsForPayment([]);
    setSplitPaymentModal(true);
  };

  // Process payment
  const handleProcessPayment = async (values: { amount: number; method: PaymentMethod; reference?: string }, itemIds?: string[]) => {
    try {
      // Determine if this is a full payment (all items)
      const isFullPayment = !itemIds || itemIds.length === allOrderItems.length;
      
      // Create bill with selected items or all items
      const billData = {
        tableSessionId: currentSession!.id,
        orderItemIds: itemIds || allOrderItems.map(item => item.id),
      };
      
      const billResponse = await createBillMutation.mutateAsync(billData);
      
      // Process payment for the bill
      await paymentMutation.mutateAsync({
        billId: billResponse.id,
        amount: values.amount,
        method: values.method,
        reference: values.reference,
        closeTable: isFullPayment, // Close table if full payment
      });
    } catch (error) {
      // Error handling is done in mutation
    }
  };

  // Toggle item selection for split payment
  const toggleItemSelection = (itemId: string) => {
    setSelectedItemsForPayment(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Select all items
  const selectAllItems = () => {
    setSelectedItemsForPayment(allOrderItems.map(item => item.id));
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItemsForPayment([]);
  };

  const handleGoToBilling = () => {
    // Navigate to billing with this table's session
    navigate(`/billing?tableSessionId=${currentSession?.id}`);
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

  // Get products filtered by category (including subcategories)
  const filteredProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];
    if (!selectedCategory) return allProducts.filter(p => p.isActive);
    
    // Find selected category and get its children IDs
    const selectedCat = categories?.find(c => c.id === selectedCategory);
    const categoryIds = [selectedCategory];
    
    // Add children category IDs if any
    if (selectedCat?.children && selectedCat.children.length > 0) {
      categoryIds.push(...selectedCat.children.map(child => child.id));
    }
    
    return allProducts.filter(p => categoryIds.includes(p.categoryId) && p.isActive);
  }, [allProducts, selectedCategory, categories]);

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

  if (!currentSession) {
    return (
      <Empty
        description="Esta mesa no tiene una sesión activa"
        style={{ marginTop: 100 }}
      >
        <Space>
          <Button 
            type="primary" 
            onClick={() => openSessionMutation.mutate()}
            loading={openSessionMutation.isPending}
          >
            Abrir Mesa
          </Button>
          <Button onClick={() => navigate('/tables')}>
            Volver a Mesas
          </Button>
        </Space>
      </Empty>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Col>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/tables')}
            />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Mesa {table?.number}
              </Title>
              <Text type="secondary">
                {currentSession?.guestCount || currentSession?.customerCount || 0} comensales • 
                Abierta: {new Date(currentSession?.openedAt || new Date()).toLocaleTimeString('es-ES', {
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

      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        {/* LEFT SIDE - Products Catalog */}
        <Col xs={24} lg={14} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Categories */}
          <Card size="small" style={{ marginBottom: 12, flexShrink: 0 }}>
            <Space wrap size={[8, 8]}>
              <Button
                type={selectedCategory === null ? 'primary' : 'default'}
                onClick={() => setSelectedCategory(null)}
                size="middle"
              >
                Todos
              </Button>
              {categories?.filter(c => c.isActive).map(category => (
                <Button
                  key={category.id}
                  type={selectedCategory === category.id ? 'primary' : 'default'}
                  onClick={() => setSelectedCategory(category.id)}
                  style={selectedCategory !== category.id && category.color ? { 
                    borderColor: category.color,
                    color: category.color 
                  } : undefined}
                  size="middle"
                >
                  {category.name}
                </Button>
              ))}
            </Space>
          </Card>

          {/* Products Grid */}
          <Card 
            title={<Space><ShoppingCartOutlined /> Productos</Space>}
            bodyStyle={{ padding: 12, overflow: 'auto', height: 'calc(100% - 57px)' }}
            style={{ flex: 1, overflow: 'hidden' }}
          >
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
              gap: 12 
            }}>
              {filteredProducts.filter(Boolean).map(product => (
                <Card
                  key={product.id}
                  size="small"
                  hoverable
                  onClick={() => handleProductClick(product)}
                  style={{ 
                    cursor: 'pointer',
                    borderColor: product.color || undefined,
                    transition: 'all 0.2s'
                  }}
                  bodyStyle={{ padding: 12 }}
                >
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      style={{ 
                        width: '100%', 
                        height: 60, 
                        objectFit: 'cover', 
                        borderRadius: 4, 
                        marginBottom: 8 
                      }}
                    />
                  )}
                  <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                    {product.name}
                  </Text>
                  <Text type="success" style={{ fontSize: 14, fontWeight: 600 }}>
                    {formatCurrency(product.price)}
                  </Text>
                  {product.trackStock && product.stockQty !== undefined && product.stockQty <= 5 && (
                    <Tag color="orange" style={{ fontSize: 10, marginTop: 4 }}>
                      Stock: {product.stockQty}
                    </Tag>
                  )}
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
                  <Empty description="No hay productos en esta categoría" />
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* RIGHT SIDE - Order & Payment */}
        <Col xs={24} lg={10} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Tabs 
            defaultActiveKey="cart" 
            style={{ height: '100%' }}
            items={[
              {
                key: 'cart',
                label: (
                  <Space>
                    <PlusOutlined />
                    Nuevo Pedido
                    {cartItems.length > 0 && (
                      <Badge count={cartItems.reduce((sum, item) => sum + item.quantity, 0)} size="small" />
                    )}
                  </Space>
                ),
                children: (
                  <Card 
                    style={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}
                    bodyStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                    extra={
                      cartItems.length > 0 && (
                        <Button type="link" danger size="small" onClick={clearCart}>
                          Limpiar
                        </Button>
                      )
                    }
                  >
                    {cartItems.length === 0 ? (
                      <Empty 
                        description="Selecciona productos del catálogo" 
                        style={{ margin: 'auto' }}
                      />
                    ) : (
                      <>
                        <List
                          style={{ flex: 1, overflow: 'auto' }}
                          dataSource={cartItems}
                          renderItem={(item) => (
                            <List.Item style={{ padding: '8px 0' }}>
                              <div style={{ width: '100%' }}>
                                <Row justify="space-between" align="middle">
                                  <Col flex="1">
                                    <Text strong>{item.product.name}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      {formatCurrency(item.product.price)} c/u
                                    </Text>
                                    {item.notes && (
                                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                        📝 {item.notes}
                                      </Text>
                                    )}
                                  </Col>
                                  <Col>
                                    <Space>
                                      <Button
                                        size="small"
                                        icon={<MinusOutlined />}
                                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                      />
                                      <Text style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</Text>
                                      <Button
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                      />
                                    </Space>
                                  </Col>
                                  <Col style={{ minWidth: 70, textAlign: 'right' }}>
                                    <Text strong>{formatCurrency(item.product.price * item.quantity)}</Text>
                                  </Col>
                                  <Col>
                                    <Space size={4}>
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => {
                                          setItemNotesModal({ visible: true, item });
                                          setNotesInput(item.notes || '');
                                        }}
                                      />
                                      <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => removeItem(item.product.id)}
                                      />
                                    </Space>
                                  </Col>
                                </Row>
                              </div>
                            </List.Item>
                          )}
                        />
                        <Divider style={{ margin: '12px 0' }} />
                        <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                          <Col>
                            <Text strong style={{ fontSize: 18 }}>TOTAL</Text>
                          </Col>
                          <Col>
                            <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                              {formatCurrency(getTotal())}
                            </Text>
                          </Col>
                        </Row>
                        <Button
                          type="primary"
                          block
                          size="large"
                          icon={<CheckCircleOutlined />}
                          onClick={handleSendOrder}
                          loading={createOrderMutation.isPending}
                        >
                          Enviar Pedido
                        </Button>
                      </>
                    )}
                  </Card>
                ),
              },
              {
                key: 'orders',
                label: (
                  <Space>
                    <DollarOutlined />
                    Cuenta Mesa
                    {allOrderItems.length > 0 && (
                      <Badge count={allOrderItems.length} size="small" color="green" />
                    )}
                  </Space>
                ),
                children: (
                  <Card 
                    style={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}
                    bodyStyle={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                  >
                    {allOrderItems.length === 0 ? (
                      <Empty 
                        description="No hay productos pendientes de cobro" 
                        style={{ margin: 'auto' }}
                      />
                    ) : (
                      <>
                        <List
                          style={{ flex: 1, overflow: 'auto' }}
                          dataSource={allOrderItems}
                          renderItem={(item: OrderItem) => (
                            <List.Item style={{ padding: '8px 0' }}>
                              <Row style={{ width: '100%' }} justify="space-between" align="middle">
                                <Col flex="1">
                                  <Text>{item.quantity}x {item.product?.name || 'Producto'}</Text>
                                  <br />
                                  <Space size={4}>
                                    <Tag color={getStatusColor(item.status)} style={{ fontSize: 10 }}>
                                      {getStatusLabel(item.status)}
                                    </Tag>
                                    {item.notes && (
                                      <Text type="secondary" style={{ fontSize: 10 }}>📝 {item.notes}</Text>
                                    )}
                                  </Space>
                                </Col>
                                <Col style={{ minWidth: 70, textAlign: 'right' }}>
                                  <Text strong>{formatCurrency(item.totalPrice)}</Text>
                                </Col>
                              </Row>
                            </List.Item>
                          )}
                        />
                        <Divider style={{ margin: '12px 0' }} />
                        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                          <Col>
                            <Text strong style={{ fontSize: 18 }}>TOTAL A COBRAR</Text>
                          </Col>
                          <Col>
                            <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
                              {formatCurrency(totalUnbilledAmount)}
                            </Text>
                          </Col>
                        </Row>
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                          <Button
                            type="primary"
                            block
                            size="large"
                            icon={<DollarOutlined />}
                            onClick={handleFullPayment}
                          >
                            Cobrar Todo ({formatCurrency(totalUnbilledAmount)})
                          </Button>
                          <Button
                            block
                            size="large"
                            icon={<SplitCellsOutlined />}
                            onClick={handleSplitPaymentMode}
                          >
                            Cobrar por Separado
                          </Button>
                        </Space>
                      </>
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </Col>
      </Row>

      {/* Notes Modal */}
      <Modal
        title="Notas del producto"
        open={itemNotesModal.visible}
        onOk={() => {
          if (itemNotesModal.item) {
            updateNotes(itemNotesModal.item.product.id, notesInput);
          }
          setItemNotesModal({ visible: false });
        }}
        onCancel={() => setItemNotesModal({ visible: false })}
      >
        <Input.TextArea
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          placeholder="Añadir notas especiales (sin cebolla, poco hecho, etc.)..."
          rows={4}
        />
      </Modal>

      {/* Full Payment Modal */}
      <Modal
        title="Cobrar Cuenta Completa"
        open={paymentModal}
        onCancel={() => setPaymentModal(false)}
        footer={null}
        width={500}
      >
        <Alert
          message={`Total a cobrar: ${formatCurrency(totalUnbilledAmount)}`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={(values) => handleProcessPayment(values)}
        >
          <Form.Item
            name="amount"
            label="Cantidad recibida"
            rules={[{ required: true, message: 'Ingrese la cantidad' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              addonAfter="€"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="method"
            label="Método de pago"
            rules={[{ required: true, message: 'Seleccione el método' }]}
          >
            <Select size="large">
              <Select.Option value="CASH">
                <Space><WalletOutlined /> Efectivo</Space>
              </Select.Option>
              <Select.Option value="CARD">
                <Space><CreditCardOutlined /> Tarjeta</Space>
              </Select.Option>
              <Select.Option value="TRANSFER">
                <Space><BankOutlined /> Transferencia</Space>
              </Select.Option>
              <Select.Option value="VOUCHER">
                <Space><GiftOutlined /> Vale</Space>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="reference" label="Referencia (opcional)">
            <Input placeholder="Nº tarjeta, referencia transfer..." />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prevValues, curValues) => prevValues.amount !== curValues.amount}>
            {({ getFieldValue }) => {
              const amount = getFieldValue('amount') || 0;
              const change = amount - totalUnbilledAmount;
              return change > 0 ? (
                <Alert
                  message={`Cambio a devolver: ${formatCurrency(change)}`}
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              ) : null;
            }}
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setPaymentModal(false)}>
                Cancelar
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={createBillMutation.isPending || paymentMutation.isPending}
                icon={<DollarOutlined />}
                size="large"
              >
                Cobrar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Split Payment Modal */}
      <Modal
        title="Cobrar por Separado"
        open={splitPaymentModal}
        onCancel={() => {
          setSplitPaymentModal(false);
          setSelectedItemsForPayment([]);
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="Selecciona los productos que deseas cobrar"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Space style={{ marginBottom: 16 }}>
          <Button size="small" onClick={selectAllItems}>
            Seleccionar todos
          </Button>
          <Button size="small" onClick={deselectAllItems}>
            Deseleccionar todos
          </Button>
        </Space>

        <List
          style={{ maxHeight: 300, overflow: 'auto', marginBottom: 16 }}
          bordered
          dataSource={allOrderItems}
          renderItem={(item: OrderItem) => (
            <List.Item
              style={{ 
                cursor: 'pointer',
                backgroundColor: selectedItemsForPayment.includes(item.id) ? '#e6f7ff' : undefined
              }}
              onClick={() => toggleItemSelection(item.id)}
            >
              <Row style={{ width: '100%' }} align="middle">
                <Col>
                  <Checkbox 
                    checked={selectedItemsForPayment.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                  />
                </Col>
                <Col flex="1" style={{ marginLeft: 12 }}>
                  <Text>{item.quantity}x {item.product?.name || 'Producto'}</Text>
                </Col>
                <Col style={{ minWidth: 80, textAlign: 'right' }}>
                  <Text strong>{formatCurrency(item.totalPrice)}</Text>
                </Col>
              </Row>
            </List.Item>
          )}
        />

        <Divider />

        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Text strong style={{ fontSize: 16 }}>
              Seleccionados: {selectedItemsForPayment.length} productos
            </Text>
          </Col>
          <Col>
            <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
              Total: {formatCurrency(selectedItemsTotal)}
            </Text>
          </Col>
        </Row>

        {selectedItemsForPayment.length > 0 && (
          <Form
            layout="vertical"
            onFinish={(values) => handleProcessPayment(values, selectedItemsForPayment)}
          >
            <Form.Item
              name="method"
              label="Método de pago"
              rules={[{ required: true, message: 'Seleccione el método' }]}
              initialValue="CASH"
            >
              <Select size="large">
                <Select.Option value="CASH">
                  <Space><WalletOutlined /> Efectivo</Space>
                </Select.Option>
                <Select.Option value="CARD">
                  <Space><CreditCardOutlined /> Tarjeta</Space>
                </Select.Option>
                <Select.Option value="TRANSFER">
                  <Space><BankOutlined /> Transferencia</Space>
                </Select.Option>
                <Select.Option value="VOUCHER">
                  <Space><GiftOutlined /> Vale</Space>
                </Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="amount"
              label="Cantidad recibida"
              rules={[{ required: true, message: 'Ingrese la cantidad' }]}
              initialValue={selectedItemsTotal}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0.01}
                precision={2}
                addonAfter="€"
                size="large"
              />
            </Form.Item>

            <Form.Item name="reference" label="Referencia (opcional)">
              <Input placeholder="Nº tarjeta, referencia transfer..." />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setSplitPaymentModal(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  loading={createBillMutation.isPending || paymentMutation.isPending}
                  icon={<DollarOutlined />}
                  size="large"
                >
                  Cobrar Seleccionados ({formatCurrency(selectedItemsTotal)})
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
