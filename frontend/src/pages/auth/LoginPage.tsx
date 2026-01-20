import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined, NumberOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const [pinForm] = Form.useForm();
  const { login, pinLogin, isLoading, error, clearError } = useAuthStore();
  const [activeTab, setActiveTab] = useState('email');

  const handleEmailLogin = async (values: { email: string; password: string }) => {
    try {
      await login(values);
      message.success('Bienvenido a Tormel POS');
    } catch (err) {
      // Error is handled in the store
    }
  };

  const handlePinLogin = async (values: { pin: string }) => {
    try {
      await pinLogin(values);
      message.success('Bienvenido a Tormel POS');
    } catch (err) {
      // Error is handled in the store
    }
  };

  const tabItems = [
    {
      key: 'email',
      label: 'Email',
      children: (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEmailLogin}
          autoComplete="off"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Por favor ingrese su email' },
              { type: 'email', message: 'Email inválido' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Email"
              size="large"
              onChange={clearError}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Por favor ingrese su contraseña' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Contraseña"
              size="large"
              onChange={clearError}
            />
          </Form.Item>

          {error && (
            <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
              {error}
            </Text>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoading}
              block
            >
              Iniciar Sesión
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'pin',
      label: 'PIN Rápido',
      children: (
        <Form
          form={pinForm}
          layout="vertical"
          onFinish={handlePinLogin}
          autoComplete="off"
        >
          <Form.Item
            name="pin"
            rules={[
              { required: true, message: 'Por favor ingrese su PIN' },
              { len: 4, message: 'El PIN debe tener 4 dígitos' },
            ]}
          >
            <Input.Password
              prefix={<NumberOutlined />}
              placeholder="PIN de 4 dígitos"
              size="large"
              maxLength={4}
              onChange={clearError}
              style={{ textAlign: 'center', letterSpacing: 8 }}
            />
          </Form.Item>

          {error && (
            <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
              {error}
            </Text>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoading}
              block
            >
              Acceder
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <Card
      style={{
        width: 400,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
          TORMEL
        </Title>
        <Text type="secondary">Sistema de Punto de Venta</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        centered
      />
    </Card>
  );
}
