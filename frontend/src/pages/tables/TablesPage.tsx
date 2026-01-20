import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Select, Button, Modal, Form, InputNumber, Input, Badge, Space, Empty, Spin, message } from 'antd';
import { PlusOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import { Zone, Table, TableStatus } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

export default function TablesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [openTableModal, setOpenTableModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [form] = Form.useForm();

  // Fetch zones with tables
  const { data: zones, isLoading } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => {
      const response = await api.get('/tables/zones');
      return response.data;
    },
  });

  // Open table session mutation
  const openTableMutation = useMutation({
    mutationFn: async (data: { tableId: string; customerCount: number; customerName?: string }) => {
      const response = await api.post(`/tables/${data.tableId}/open`, {
        customerCount: data.customerCount,
        customerName: data.customerName,
      });
      return response.data;
    },
    onSuccess: (data) => {
      message.success('Mesa abierta correctamente');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setOpenTableModal(false);
      form.resetFields();
      navigate(`/tables/${data.tableId}`);
    },
    onError: () => {
      message.error('Error al abrir la mesa');
    },
  });

  // Listen for real-time table updates
  useEffect(() => {
    const unsubscribe = socketService.on('table:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    });

    return unsubscribe;
  }, [queryClient]);

  const handleTableClick = (table: Table) => {
    if (table.status === 'AVAILABLE') {
      setSelectedTable(table);
      setOpenTableModal(true);
    } else if (table.status === 'OCCUPIED' && table.currentSession) {
      navigate(`/tables/${table.id}`);
    }
  };

  const handleOpenTable = (values: { customerCount: number; customerName?: string }) => {
    if (selectedTable) {
      openTableMutation.mutate({
        tableId: selectedTable.id,
        customerCount: values.customerCount,
        customerName: values.customerName,
      });
    }
  };

  const getStatusConfig = (status: TableStatus) => {
    const configs: Record<TableStatus, { color: string; label: string; badgeStatus: 'success' | 'error' | 'warning' | 'processing' }> = {
      AVAILABLE: { color: '#52c41a', label: 'Disponible', badgeStatus: 'success' },
      OCCUPIED: { color: '#ff4d4f', label: 'Ocupada', badgeStatus: 'error' },
      RESERVED: { color: '#faad14', label: 'Reservada', badgeStatus: 'warning' },
      CLEANING: { color: '#1890ff', label: 'Limpieza', badgeStatus: 'processing' },
    };
    return configs[status];
  };

  const getTableShape = (shape: string) => {
    if (shape === 'CIRCLE') return 'table-card shape-circle';
    if (shape === 'RECTANGLE') return 'table-card shape-rectangle';
    return 'table-card';
  };

  const filteredZones = zones?.filter(zone => 
    selectedZone === 'all' || zone.id === selectedZone
  );

  const allTables = filteredZones?.flatMap(zone => 
    zone.tables.map(table => ({ ...table, zoneName: zone.name }))
  ) || [];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>Mapa de Mesas</Title>
        </Col>
        <Col>
          <Space>
            <Select
              value={selectedZone}
              onChange={setSelectedZone}
              style={{ width: 200 }}
              options={[
                { value: 'all', label: 'Todas las zonas' },
                ...(zones?.map(zone => ({
                  value: zone.id,
                  label: zone.name,
                })) || []),
              ]}
            />
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <Button type="primary" icon={<PlusOutlined />}>
                Añadir Mesa
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Status Legend */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Space size="large">
          {Object.entries({
            AVAILABLE: 'Disponible',
            OCCUPIED: 'Ocupada',
            RESERVED: 'Reservada',
            CLEANING: 'Limpieza',
          }).map(([status, label]) => (
            <Space key={status}>
              <Badge status={getStatusConfig(status as TableStatus).badgeStatus} />
              <Text>{label}</Text>
            </Space>
          ))}
        </Space>
      </Card>

      {/* Tables Grid */}
      {allTables.length === 0 ? (
        <Empty description="No hay mesas configuradas" />
      ) : (
        <div className="table-grid">
          {allTables.map((table) => {
            const config = getStatusConfig(table.status);
            return (
              <div
                key={table.id}
                className={getTableShape(table.shape)}
                style={{ backgroundColor: config.color }}
                onClick={() => handleTableClick(table)}
              >
                <Text strong style={{ color: 'white', fontSize: 18 }}>
                  {table.number}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}>
                  {table.name || table.zoneName}
                </Text>
                <Space style={{ marginTop: 4 }}>
                  <UserOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    {table.currentSession?.customerCount || 0}/{table.capacity}
                  </Text>
                </Space>
                {table.currentSession && (
                  <Space style={{ marginTop: 4 }}>
                    <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>
                      {new Date(table.currentSession.openedAt).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Space>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Open Table Modal */}
      <Modal
        title={`Abrir Mesa ${selectedTable?.number}`}
        open={openTableModal}
        onCancel={() => {
          setOpenTableModal(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleOpenTable}
          initialValues={{ customerCount: 2 }}
        >
          <Form.Item
            name="customerCount"
            label="Número de comensales"
            rules={[{ required: true, message: 'Ingrese el número de comensales' }]}
          >
            <InputNumber
              min={1}
              max={selectedTable?.capacity || 20}
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="customerName"
            label="Nombre del cliente (opcional)"
          >
            <Input placeholder="Nombre o referencia" size="large" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpenTableModal(false)}>
                Cancelar
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={openTableMutation.isPending}
              >
                Abrir Mesa
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
