import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Row, Col, Typography, Select, Button, Space, Badge, Spin, message, 
  Modal, Form, InputNumber, Input, Segmented, Dropdown, Card, Statistic
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  AppstoreOutlined,
  LayoutOutlined,
  SettingOutlined,
  MoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { socketService } from '@/services/socket';
import { Zone, Table, TableStatus, CreateTableData, UpdateTableData } from '@/types';
import { useAuthStore } from '@/stores/authStore';

// Components
import TableFloorPlan from '@/components/tables/TableFloorPlan';
import TableDetailsPanel from '@/components/tables/TableDetailsPanel';
import TableModal from '@/components/tables/TableModal';
import ZoneModal from '@/components/tables/ZoneModal';

const { Title, Text } = Typography;

type ViewMode = 'floor' | 'grid';

export default function TablesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // UI State
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('floor');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  
  // Modal states
  const [openTableModal, setOpenTableModal] = useState(false);
  const [tableModalData, setTableModalData] = useState<{
    table: Table | null;
    position?: { x: number; y: number };
  }>({ table: null });
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [sessionForm] = Form.useForm();

  // Local table positions (for smooth drag)
  const [localTablePositions, setLocalTablePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Fetch zones with tables
  const { data: zones = [], isLoading, refetch } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => {
      const response = await api.get('/tables/zones');
      return response.data;
    },
  });

  // Flatten tables with zone info
  const allTables = useMemo(() => {
    return zones.flatMap(zone => 
      zone.tables.map(table => ({
        ...table,
        zone,
        // Use local position if being dragged
        positionX: localTablePositions[table.id]?.x ?? table.positionX,
        positionY: localTablePositions[table.id]?.y ?? table.positionY,
      }))
    );
  }, [zones, localTablePositions]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = allTables.length;
    const free = allTables.filter(t => t.status === 'FREE').length;
    const occupied = allTables.filter(t => t.status === 'OCCUPIED').length;
    const reserved = allTables.filter(t => t.status === 'RESERVED').length;
    return { total, free, occupied, reserved };
  }, [allTables]);

  // ============================================
  // MUTATIONS
  // ============================================

  // Create table
  const createTableMutation = useMutation({
    mutationFn: async (data: CreateTableData) => {
      const response = await api.post('/tables', data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Mesa creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setOpenTableModal(false);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.message || 'Error al crear la mesa';
      message.error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
    },
  });

  // Update table
  const updateTableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTableData }) => {
      const response = await api.patch(`/tables/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Mesa actualizada');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setOpenTableModal(false);
    },
    onError: () => {
      message.error('Error al actualizar la mesa');
    },
  });

  // Update table position (debounced)
  const updatePositionMutation = useMutation({
    mutationFn: async ({ id, positionX, positionY }: { id: string; positionX: number; positionY: number }) => {
      const response = await api.patch(`/tables/${id}`, { positionX, positionY });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Clear local position after server confirms
      setLocalTablePositions(prev => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
    },
  });

  // Delete table
  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tables/${id}`);
    },
    onSuccess: () => {
      message.success('Mesa eliminada');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setSelectedTable(null);
    },
    onError: () => {
      message.error('Error al eliminar la mesa');
    },
  });

  // Create zone
  const createZoneMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const response = await api.post('/tables/zones', data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Zona creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setZoneModalOpen(false);
    },
    onError: () => {
      message.error('Error al crear la zona');
    },
  });

  // Update zone
  const updateZoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.patch(`/tables/zones/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Zona actualizada');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setZoneModalOpen(false);
      setEditingZone(null);
    },
    onError: () => {
      message.error('Error al actualizar la zona');
    },
  });

  // Open table session
  const openSessionMutation = useMutation({
    mutationFn: async (data: { tableId: string; guestCount: number; guestName?: string }) => {
      const response = await api.post(`/tables/${data.tableId}/open`, {
        guestCount: data.guestCount,
        guestName: data.guestName,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      message.success('Mesa abierta correctamente');
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setOpenSessionModal(false);
      sessionForm.resetFields();
      navigate(`/tables/${variables.tableId}`);
    },
    onError: () => {
      message.error('Error al abrir la mesa');
    },
  });

  // ============================================
  // REAL-TIME UPDATES
  // ============================================

  useEffect(() => {
    const unsubscribeTable = socketService.on('table:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    });

    const unsubscribeZone = socketService.on('zone:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    });

    return () => {
      unsubscribeTable();
      unsubscribeZone();
    };
  }, [queryClient]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleTableClick = useCallback((table: Table) => {
    if (isEditMode) {
      // In edit mode, open edit modal
      setTableModalData({ table });
      setOpenTableModal(true);
    } else {
      // In view mode, show details panel
      setSelectedTable(table);
    }
  }, [isEditMode]);

  const handleTablePositionChange = useCallback((tableId: string, x: number, y: number) => {
    // Update local position immediately for smooth drag
    setLocalTablePositions(prev => ({
      ...prev,
      [tableId]: { x, y },
    }));

    // Debounce server update
    updatePositionMutation.mutate({ id: tableId, positionX: x, positionY: y });
  }, [updatePositionMutation]);

  const handleAddTableAtPosition = useCallback((x: number, y: number) => {
    setTableModalData({ table: null, position: { x, y } });
    setOpenTableModal(true);
  }, []);

  const handleSaveTable = useCallback((data: CreateTableData | UpdateTableData) => {
    if (tableModalData.table) {
      updateTableMutation.mutate({ id: tableModalData.table.id, data });
    } else {
      createTableMutation.mutate(data as CreateTableData);
    }
  }, [tableModalData.table, updateTableMutation, createTableMutation]);

  const handleOpenSession = useCallback((table: Table) => {
    setSelectedTable(table);
    setOpenSessionModal(true);
  }, []);

  const handleViewSession = useCallback((table: Table) => {
    navigate(`/tables/${table.id}`);
  }, [navigate]);

  const handleEditTable = useCallback((table: Table) => {
    setTableModalData({ table });
    setOpenTableModal(true);
  }, []);

  const handleDeleteTable = useCallback((table: Table) => {
    Modal.confirm({
      title: `¿Eliminar mesa ${table.number}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => deleteTableMutation.mutate(table.id),
    });
  }, [deleteTableMutation]);

  const handleSaveZone = useCallback((data: { name: string; description?: string; color?: string }) => {
    if (editingZone) {
      updateZoneMutation.mutate({ id: editingZone.id, data });
    } else {
      createZoneMutation.mutate(data);
    }
  }, [editingZone, updateZoneMutation, createZoneMutation]);

  const handleOpenSessionSubmit = useCallback((values: { guestCount: number; guestName?: string }) => {
    if (selectedTable) {
      openSessionMutation.mutate({
        tableId: selectedTable.id,
        guestCount: values.guestCount,
        guestName: values.guestName,
      });
    }
  }, [selectedTable, openSessionMutation]);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="tables-page">
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>Mapa de Mesas</Title>
        </Col>
        <Col>
          <Space size="middle">
            {/* View Mode Toggle */}
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              options={[
                { value: 'floor', icon: <LayoutOutlined />, label: 'Plano' },
                { value: 'grid', icon: <AppstoreOutlined />, label: 'Cuadrícula' },
              ]}
            />
            
            {/* Zone Filter */}
            <Select
              value={selectedZone}
              onChange={setSelectedZone}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Todas las zonas' },
                ...zones.map(zone => ({
                  value: zone.id,
                  label: (
                    <Space>
                      <span 
                        style={{ 
                          width: 10, 
                          height: 10, 
                          borderRadius: '50%', 
                          backgroundColor: zone.color || '#1890ff',
                          display: 'inline-block',
                        }} 
                      />
                      {zone.name}
                    </Space>
                  ),
                })),
              ]}
            />

            {/* Refresh */}
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
            />

            {/* Admin Actions */}
            {isAdmin && (
              <>
                <Button
                  type={isEditMode ? 'primary' : 'default'}
                  icon={<EditOutlined />}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? 'Finalizar Edición' : 'Editar Plano'}
                </Button>
                
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'add-table',
                        icon: <PlusOutlined />,
                        label: 'Añadir Mesa',
                        onClick: () => {
                          setTableModalData({ table: null });
                          setOpenTableModal(true);
                        },
                      },
                      {
                        key: 'add-zone',
                        icon: <PlusOutlined />,
                        label: 'Nueva Zona',
                        onClick: () => {
                          setEditingZone(null);
                          setZoneModalOpen(true);
                        },
                      },
                      { type: 'divider' },
                      {
                        key: 'manage-zones',
                        icon: <SettingOutlined />,
                        label: 'Gestionar Zonas',
                        children: zones.map(zone => ({
                          key: zone.id,
                          label: zone.name,
                          onClick: () => {
                            setEditingZone(zone);
                            setZoneModalOpen(true);
                          },
                        })),
                      },
                    ],
                  }}
                >
                  <Button icon={<MoreOutlined />} />
                </Dropdown>
              </>
            )}
          </Space>
        </Col>
      </Row>

      {/* Stats Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col>
            <Statistic 
              title="Total" 
              value={stats.total} 
              valueStyle={{ fontSize: 18 }}
            />
          </Col>
          <Col>
            <Statistic 
              title={<Badge status="success" text="Libres" />}
              value={stats.free} 
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Col>
          <Col>
            <Statistic 
              title={<Badge status="error" text="Ocupadas" />}
              value={stats.occupied} 
              valueStyle={{ fontSize: 18, color: '#ff4d4f' }}
            />
          </Col>
          <Col>
            <Statistic 
              title={<Badge status="warning" text="Reservadas" />}
              value={stats.reserved} 
              valueStyle={{ fontSize: 18, color: '#faad14' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      <Row gutter={16}>
        {/* Floor Plan / Grid */}
        <Col xs={24} lg={selectedTable && !isEditMode ? 16 : 24}>
          {viewMode === 'floor' ? (
            <TableFloorPlan
              tables={allTables}
              zones={zones}
              selectedZone={selectedZone}
              isEditMode={isEditMode}
              onTableClick={handleTableClick}
              onTablePositionChange={handleTablePositionChange}
              onAddTable={handleAddTableAtPosition}
            />
          ) : (
            <div className="table-grid">
              {allTables
                .filter(table => selectedZone === 'all' || table.zoneId === selectedZone)
                .map(table => {
                  const statusColors: Record<TableStatus, string> = {
                    FREE: '#52c41a',
                    OCCUPIED: '#ff4d4f',
                    RESERVED: '#faad14',
                    BLOCKED: '#8c8c8c',
                  };
                  return (
                    <div
                      key={table.id}
                      className={`table-card ${table.shape === 'circle' ? 'shape-circle' : ''}`}
                      style={{ backgroundColor: statusColors[table.status] }}
                      onClick={() => handleTableClick(table)}
                    >
                      <Text strong style={{ color: 'white', fontSize: 18 }}>
                        {table.number}
                      </Text>
                      {table.name && (
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                          {table.name}
                        </Text>
                      )}
                      <Space style={{ marginTop: 4 }}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                          {table.capacity} pers.
                        </Text>
                      </Space>
                    </div>
                  );
                })
              }
            </div>
          )}
        </Col>

        {/* Details Panel */}
        {selectedTable && !isEditMode && (
          <Col xs={24} lg={8}>
            <TableDetailsPanel
              table={selectedTable}
              onClose={() => setSelectedTable(null)}
              onOpenSession={handleOpenSession}
              onViewSession={handleViewSession}
              onEditTable={handleEditTable}
              onDeleteTable={isAdmin ? handleDeleteTable : undefined}
            />
          </Col>
        )}
      </Row>

      {/* Table Create/Edit Modal */}
      <TableModal
        open={openTableModal}
        table={tableModalData.table}
        zones={zones}
        initialPosition={tableModalData.position}
        onSave={handleSaveTable}
        onCancel={() => {
          setOpenTableModal(false);
          setTableModalData({ table: null });
        }}
        loading={createTableMutation.isPending || updateTableMutation.isPending}
      />

      {/* Zone Modal */}
      <ZoneModal
        open={zoneModalOpen}
        zone={editingZone}
        onSave={handleSaveZone}
        onCancel={() => {
          setZoneModalOpen(false);
          setEditingZone(null);
        }}
        loading={createZoneMutation.isPending || updateZoneMutation.isPending}
      />

      {/* Open Session Modal */}
      <Modal
        title={`Abrir Mesa ${selectedTable?.number}`}
        open={openSessionModal}
        onCancel={() => {
          setOpenSessionModal(false);
          sessionForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={sessionForm}
          layout="vertical"
          onFinish={handleOpenSessionSubmit}
          initialValues={{ guestCount: 2 }}
        >
          <Form.Item
            name="guestCount"
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
            name="guestName"
            label="Nombre del cliente (opcional)"
          >
            <Input placeholder="Nombre o referencia" size="large" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpenSessionModal(false)}>
                Cancelar
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={openSessionMutation.isPending}
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
