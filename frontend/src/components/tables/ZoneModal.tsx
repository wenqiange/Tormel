import { Modal, Form, Input, InputNumber, ColorPicker } from 'antd';
import type { Color } from 'antd/es/color-picker';
import { Zone } from '@/types';
import { useEffect } from 'react';

interface ZoneModalProps {
  open: boolean;
  zone: Zone | null;  // null for create
  onSave: (data: { name: string; description?: string; color?: string; sortOrder?: number }) => void;
  onCancel: () => void;
  loading?: boolean;
}

const DEFAULT_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb',
];

export default function ZoneModal({
  open,
  zone,
  onSave,
  onCancel,
  loading,
}: ZoneModalProps) {
  const [form] = Form.useForm();
  const isEdit = !!zone;

  useEffect(() => {
    if (open) {
      if (zone) {
        form.setFieldsValue({
          name: zone.name,
          description: zone.description,
          color: zone.color || '#1890ff',
          sortOrder: zone.sortOrder || 0,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
          sortOrder: 0,
        });
      }
    }
  }, [open, zone, form]);

  const handleFinish = (values: any) => {
    const color = typeof values.color === 'string' 
      ? values.color 
      : (values.color as Color)?.toHexString?.() || '#1890ff';
    
    onSave({
      ...values,
      color,
    });
  };

  return (
    <Modal
      title={isEdit ? `Editar Zona: ${zone.name}` : 'Nueva Zona'}
      open={open}
      onOk={() => form.submit()}
      onCancel={onCancel}
      okText={isEdit ? 'Guardar' : 'Crear'}
      cancelText="Cancelar"
      confirmLoading={loading}
      width={400}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          label="Nombre de la zona"
          rules={[{ required: true, message: 'Ingrese el nombre' }]}
        >
          <Input 
            placeholder="Ej: Terraza, Interior, Barra..." 
            size="large" 
          />
        </Form.Item>

        <Form.Item
          name="description"
          label="Descripción (opcional)"
        >
          <Input.TextArea 
            placeholder="Descripción de la zona"
            rows={2}
          />
        </Form.Item>

        <Form.Item
          name="color"
          label="Color identificativo"
        >
          <ColorPicker
            showText
            presets={[
              {
                label: 'Colores recomendados',
                colors: DEFAULT_COLORS,
              },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="Orden de visualización"
        >
          <InputNumber
            min={0}
            max={100}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
