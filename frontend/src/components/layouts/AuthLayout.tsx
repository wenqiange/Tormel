import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';

const { Content } = Layout;

export default function AuthLayout() {
  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Content
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
        }}
      >
        <Outlet />
      </Content>
    </Layout>
  );
}
