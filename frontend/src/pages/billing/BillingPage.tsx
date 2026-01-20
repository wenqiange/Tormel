import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Table, Button, Space, Modal, Form,
  InputNumber, Select, Input, Divider, message, Tag, Statistic, List
} from 'antd';
import {
  DollarOutlined, PrinterOutlined, CreditCardOutlined,
  WalletOutlined, BankOutlined, GiftOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Bill, BillItem, Payment, PaymentMethod } from '@/types';

const { Title, Text } = Typography;

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const tableSessionId = searchParams.get('tableSessionId');
  const queryClient = useQueryClient();

  const [paymentModal, setPaymentModal] = useState<{ visible: boolean; bill?: Bill }>({ visible: false });
  const [discountModal, setDiscountModal] = useState<{ visible: boolean; bill?: Bill }>({ visible: false });
  const [paymentForm] = Form.useForm();
  const [discountForm] = Form.useForm();

  // Fetch bills
  const { data: bills, isLoading } = useQuery<Bill[]>({
    queryKey: ['bills', tableSessionId],
    queryFn: async () => {
      const url = tableSessionId 
        ? `/billing?tableSessionId=${tableSessionId}` 
        : '/billing';
      const response = await api.get(url);
      return response.data;
    },
  });

  // Create bill mutation
  const createBillMutation = useMutation({
    mutationFn: async (data: { tableSessionId: string; orderItemIds?: string[] }) => {
      const response = await api.post('/billing', data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Cuenta creada');
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: () => {
      message.error('Error al crear la cuenta');
    },
  });

  // Process payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (data: { billId: string; amount: number; method: PaymentMethod; reference?: string }) => {
      const response = await api.post('/payments', data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Pago procesado');
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setPaymentModal({ visible: false });
      paymentForm.resetFields();
    },
    onError: () => {
      message.error('Error al procesar el pago');
    },
  });

  // Apply discount mutation
  const discountMutation = useMutation({
    mutationFn: async (data: { billId: string; type: 'FIXED' | 'PERCENTAGE'; value: number }) => {
      const response = await api.post(`/billing/${data.billId}/discount`, {
        discountType: data.type,
        discountValue: data.value,
      });
      return response.data;
    },
    onSuccess: () => {
      message.success('Descuento aplicado');
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setDiscountModal({ visible: false });
      discountForm.resetFields();
    },
    onError: () => {
      message.error('Error al aplicar descuento');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'blue',
      PARTIALLY_PAID: 'orange',
      PAID: 'green',
      VOIDED: 'red',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      OPEN: 'Abierta',
      PARTIALLY_PAID: 'Pago Parcial',
      PAID: 'Pagada',
      VOIDED: 'Anulada',
    };
    return labels[status] || status;
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    const icons: Record<PaymentMethod, React.ReactNode> = {
      CASH: <WalletOutlined />,
      CARD: <CreditCardOutlined />,
      TRANSFER: <BankOutlined />,
      VOUCHER: <GiftOutlined />,
    };
    return icons[method];
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    const labels: Record<PaymentMethod, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      VOUCHER: 'Vale',
    };
    return labels[method];
  };

  const handlePayment = (values: { amount: number; method: PaymentMethod; reference?: string }) => {
    if (paymentModal.bill) {
      paymentMutation.mutate({
        billId: paymentModal.bill.id,
        ...values,
      });
    }
  };

  const handleDiscount = (values: { type: 'FIXED' | 'PERCENTAGE'; value: number }) => {
    if (discountModal.bill) {
      discountMutation.mutate({
        billId: discountModal.bill.id,
        ...values,
      });
    }
  };

  const getPendingAmount = (bill: Bill) => {
    const paid = bill.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    return bill.total - paid;
  };

  const billColumns = [
    {
      title: 'Nº Cuenta',
      dataIndex: 'billNumber',
      key: 'billNumber',
      render: (num: number, record: Bill) => `#${num || record.id.slice(-6)}`,
    },
    {
      title: 'Mesa',
      key: 'table',
      render: (_: any, record: Bill) => 
        record.tableSession?.table?.number || 'N/A',
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (v: number) => formatCurrency(v),
    },
    {
      title: 'Descuento',
      dataIndex: 'discount',
      key: 'discount',
      render: (v: number) => v > 0 ? `-${formatCurrency(v)}` : '-',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
    },
    {
      title: 'Pendiente',
      key: 'pending',
      render: (_: any, record: Bill) => {
        const pending = getPendingAmount(record);
        return (
          <Text type={pending > 0 ? 'danger' : 'success'}>
            {formatCurrency(pending)}
          </Text>
        );
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Bill) => {
        const pending = getPendingAmount(record);
        return (
          <Space>
            {pending > 0 && record.status !== 'VOIDED' && (
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => {
                  paymentForm.setFieldsValue({ amount: pending });
                  setPaymentModal({ visible: true, bill: record });
                }}
              >
                Cobrar
              </Button>
            )}
            {record.status === 'OPEN' && (
              <Button
                onClick={() => {
                  setDiscountModal({ visible: true, bill: record });
                }}
              >
                Descuento
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => message.info('Imprimiendo...')}>
              Imprimir
            </Button>
          </Space>
        );
      },
    },
  ];

  const expandedRowRender = (bill: Bill) => {
    return (
      <Row gutter={24}>
        <Col span={12}>
          <Card size="small" title="Artículos">
            <List
              size="small"
              dataSource={bill.items}
              renderItem={(item: BillItem) => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text>{item.quantity}x {item.productName}</Text>
                    <Text>{formatCurrency(item.totalPrice)}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="Pagos">
            {bill.payments?.length === 0 ? (
              <Text type="secondary">Sin pagos registrados</Text>
            ) : (
              <List
                size="small"
                dataSource={bill.payments}
                renderItem={(payment: Payment) => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        {getPaymentMethodIcon(payment.method)}
                        <Text>{getPaymentMethodLabel(payment.method)}</Text>
                      </Space>
                      <Text>{formatCurrency(payment.amount)}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    );
  };

  // Calculate totals
  const todayBills = bills?.filter(b => 
    new Date(b.createdAt).toDateString() === new Date().toDateString()
  ) || [];
  const totalSales = todayBills.reduce((sum, b) => sum + b.total, 0);
  const totalPending = todayBills.reduce((sum, b) => sum + getPendingAmount(b), 0);

  return (
    <div>
      <Title level={2}>Facturación</Title>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Cuentas Hoy"
              value={todayBills.length}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Ventas"
              value={totalSales}
              precision={2}
              suffix="€"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pendiente de Cobro"
              value={totalPending}
              precision={2}
              suffix="€"
              valueStyle={{ color: totalPending > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ticket Promedio"
              value={todayBills.length > 0 ? totalSales / todayBills.length : 0}
              precision={2}
              suffix="€"
            />
          </Card>
        </Col>
      </Row>

      {/* Bills Table */}
      <Card title="Cuentas">
        <Table
          columns={billColumns}
          dataSource={bills}
          rowKey="id"
          loading={isLoading}
          expandable={{ expandedRowRender }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Payment Modal */}
      <Modal
        title="Procesar Pago"
        open={paymentModal.visible}
        onCancel={() => setPaymentModal({ visible: false })}
        footer={null}
        width={500}
      >
        {paymentModal.bill && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Total"
                    value={paymentModal.bill.total}
                    precision={2}
                    suffix="€"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Pagado"
                    value={paymentModal.bill.total - getPendingAmount(paymentModal.bill)}
                    precision={2}
                    suffix="€"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Pendiente"
                    value={getPendingAmount(paymentModal.bill)}
                    precision={2}
                    suffix="€"
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
              </Row>
            </Card>

            <Form
              form={paymentForm}
              layout="vertical"
              onFinish={handlePayment}
            >
              <Form.Item
                name="amount"
                label="Cantidad a cobrar"
                rules={[{ required: true, message: 'Ingrese la cantidad' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  max={getPendingAmount(paymentModal.bill)}
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

              <Divider />

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setPaymentModal({ visible: false })}>
                    Cancelar
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit"
                    loading={paymentMutation.isPending}
                    icon={<DollarOutlined />}
                  >
                    Cobrar
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Discount Modal */}
      <Modal
        title="Aplicar Descuento"
        open={discountModal.visible}
        onCancel={() => setDiscountModal({ visible: false })}
        footer={null}
      >
        <Form
          form={discountForm}
          layout="vertical"
          onFinish={handleDiscount}
          initialValues={{ type: 'PERCENTAGE' }}
        >
          <Form.Item
            name="type"
            label="Tipo de descuento"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="PERCENTAGE">Porcentaje (%)</Select.Option>
              <Select.Option value="FIXED">Cantidad fija (€)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="value"
            label="Valor"
            rules={[{ required: true, message: 'Ingrese el valor' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setDiscountModal({ visible: false })}>
                Cancelar
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={discountMutation.isPending}
              >
                Aplicar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
