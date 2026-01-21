import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, Slider, Space, Typography, Divider, Alert } from 'antd';
import { Table, Zone, CreateTableData, UpdateTableData } from '@/types';

const { Text } = Typography;

interface TableModalProps {
  open: boolean;
  table: Table | null;  // null for create, Table for edit
  zones: Zone[];
  initialPosition?: { x: number; y: number };
  onSave: (data: CreateTableData | UpdateTableData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const SHAPE_OPTIONS = [
  { value: 'square', label: 'Cuadrada', icon: '◻' },
  { value: 'rectangle', label: 'Rectangular', icon: '▭' },
  { value: 'circle', label: 'Redonda', icon: '○' },
];

export default function TableModal({
  open,
  table,
  zones,
  initialPosition,
  onSave,
  onCancel,
  loading,
}: TableModalProps) {
  const [form] = Form.useForm();
  const isEdit = !!table;
  const hasZones = zones && zones.length > 0;
  
  // Shape preview
  const watchedShape = Form.useWatch('shape', form);
  const watchedWidth = Form.useWatch('width', form);
  const watchedHeight = Form.useWatch('height', form);

  useEffect(() => {
    if (open) {
      if (table) {
        // Edit mode - populate form
        form.setFieldsValue({
          number: table.number,
          name: table.name,
          capacity: table.capacity,
          zoneId: table.zoneId,
          shape: table.shape || 'square',
          width: table.width || 100,
          height: table.height || 100,
        });
      } else {
        // Create mode - set defaults
        form.setFieldsValue({
          capacity: 4,
          shape: 'square',
          width: 100,
          height: 100,
          zoneId: zones[0]?.id,
        });
      }
    }
  }, [open, table, form, zones]);

  const handleFinish = (values: any) => {
    const data = {
      ...values,
      positionX: table?.positionX ?? initialPosition?.x ?? 50,
      positionY: table?.positionY ?? initialPosition?.y ?? 50,
    };
    
    onSave(data);
  };

  const getPreviewStyle = () => {
    const shape = watchedShape || 'square';
    const width = Math.min(watchedWidth || 100, 80);
    const height = Math.min(watchedHeight || 100, 80);
    
    const baseStyle = {
      width,
      height,
      backgroundColor: '#52c41a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      transition: 'all 0.3s ease',
    };
    
    switch (shape) {
      case 'circle':
        return { ...baseStyle, borderRadius: '50%' };
      case 'rectangle':
        return { ...baseStyle, borderRadius: '8px' };
      default:
        return { ...baseStyle, borderRadius: '8px' };
    }
  };

  return (
    <Modal
      title={isEdit ? `Editar Mesa ${table.number}` : 'Nueva Mesa'}
      open={open}
      onOk={() => hasZones && form.submit()}
      onCancel={onCancel}
      okText={isEdit ? 'Guardar' : 'Crear'}
      cancelText="Cancelar"
      confirmLoading={loading}
      okButtonProps={{ disabled: !hasZones }}
      width={520}
      destroyOnClose
    >
      {!hasZones ? (
        <Alert
          message="No hay zonas configuradas"
          description="Debes crear al menos una zona antes de añadir mesas. Ve a las opciones del menú y selecciona 'Nueva Zona'."
          type="warning"
          showIcon
        />
      ) : (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="number"
              label="Número de mesa"
              rules={[{ required: true, message: 'Ingrese el número' }]}
            >
              <Input placeholder="1, A1, etc." size="large" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Nombre (opcional)"
            >
              <Input placeholder="Mesa del rincón" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="zoneId"
              label="Zona"
              rules={[{ required: true, message: 'Seleccione una zona' }]}
            >
              <Select
                placeholder="Seleccionar zona"
                size="large"
                options={zones.map(zone => ({
                  value: zone.id,
                  label: (
                    <Space>
                      <span 
                        style={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '50%', 
                          backgroundColor: zone.color || '#1890ff',
                          display: 'inline-block',
                        }} 
                      />
                      {zone.name}
                    </Space>
                  ),
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="capacity"
              label="Capacidad (personas)"
              rules={[{ required: true, message: 'Ingrese la capacidad' }]}
            >
              <InputNumber
                min={1}
                max={50}
                size="large"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider>Apariencia Visual</Divider>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="shape"
              label="Forma"
            >
              <Select
                size="large"
                options={SHAPE_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: (
                    <Space>
                      <span style={{ fontSize: 18 }}>{opt.icon}</span>
                      {opt.label}
                    </Space>
                  ),
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', paddingTop: 30 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Vista previa</Text>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <div style={getPreviewStyle()}>
                  {form.getFieldValue('number') || '?'}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="width"
              label={`Ancho: ${watchedWidth || 100}px`}
            >
              <Slider
                min={60}
                max={200}
                step={10}
                marks={{
                  60: '60',
                  100: '100',
                  150: '150',
                  200: '200',
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="height"
              label={`Alto: ${watchedHeight || 100}px`}
            >
              <Slider
                min={60}
                max={200}
                step={10}
                marks={{
                  60: '60',
                  100: '100',
                  150: '150',
                  200: '200',
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      )}
    </Modal>
  );
}
