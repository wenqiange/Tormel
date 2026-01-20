import { useState } from 'react';
import { 
  Typography, Card, Table, Button, Space, Modal, Form, Input, 
  InputNumber, Select, Switch, message, Popconfirm, Tag, Row, Col 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Category, Product } from '@/types';

const { Title } = Typography;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [productModal, setProductModal] = useState<{ visible: boolean; product?: Product }>({ visible: false });
  const [categoryModal, setCategoryModal] = useState<{ visible: boolean; category?: Category }>({ visible: false });
  const [productForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/products/categories');
      return response.data;
    },
  });

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await api.get('/products');
      return response.data;
    },
  });

  // Create/Update product
  const productMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      if (productModal.product?.id) {
        const response = await api.patch(`/products/${productModal.product.id}`, data);
        return response.data;
      }
      const response = await api.post('/products', data);
      return response.data;
    },
    onSuccess: () => {
      message.success(productModal.product ? 'Producto actualizado' : 'Producto creado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setProductModal({ visible: false });
      productForm.resetFields();
    },
    onError: () => {
      message.error('Error al guardar el producto');
    },
  });

  // Delete product
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      message.success('Producto eliminado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      message.error('Error al eliminar el producto');
    },
  });

  // Create/Update category
  const categoryMutation = useMutation({
    mutationFn: async (data: Partial<Category>) => {
      if (categoryModal.category?.id) {
        const response = await api.patch(`/products/categories/${categoryModal.category.id}`, data);
        return response.data;
      }
      const response = await api.post('/products/categories', data);
      return response.data;
    },
    onSuccess: () => {
      message.success(categoryModal.category ? 'Categoría actualizada' : 'Categoría creada');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryModal({ visible: false });
      categoryForm.resetFields();
    },
    onError: () => {
      message.error('Error al guardar la categoría');
    },
  });

  const handleProductSubmit = (values: any) => {
    productMutation.mutate(values);
  };

  const handleCategorySubmit = (values: any) => {
    categoryMutation.mutate(values);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const productColumns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Product, b: Product) => a.name.localeCompare(b.name),
    },
    {
      title: 'Categoría',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (name: string, record: Product) => (
        <Tag color={record.category?.color}>{name || 'Sin categoría'}</Tag>
      ),
    },
    {
      title: 'Precio',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => formatCurrency(price),
      sorter: (a: Product, b: Product) => a.price - b.price,
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number | null) => stock !== null ? stock : '-',
    },
    {
      title: 'Cocina',
      dataIndex: 'sendToKitchen',
      key: 'sendToKitchen',
      render: (send: boolean) => (
        <Tag color={send ? 'green' : 'default'}>
          {send ? 'Sí' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Activo' : 'Inactivo'}
        </Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Product) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              productForm.setFieldsValue(record);
              setProductModal({ visible: true, product: record });
            }}
          />
          <Popconfirm
            title="¿Eliminar producto?"
            onConfirm={() => deleteProductMutation.mutate(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>Productos</Title>

      <Row gutter={24}>
        {/* Categories */}
        <Col xs={24} lg={8}>
          <Card
            title="Categorías"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  categoryForm.resetFields();
                  setCategoryModal({ visible: true });
                }}
              >
                Añadir
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {categories?.map(category => (
                <Card
                  key={category.id}
                  size="small"
                  style={{ borderLeft: `4px solid ${category.color || '#1890ff'}` }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{category.name}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {category.products?.length || 0} productos
                      </div>
                    </div>
                    <Space>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          categoryForm.setFieldsValue(category);
                          setCategoryModal({ visible: true, category });
                        }}
                      />
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>

        {/* Products */}
        <Col xs={24} lg={16}>
          <Card
            title="Lista de Productos"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  productForm.resetFields();
                  setProductModal({ visible: true });
                }}
              >
                Añadir Producto
              </Button>
            }
          >
            <Table
              columns={productColumns}
              dataSource={products}
              rowKey="id"
              loading={productsLoading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Product Modal */}
      <Modal
        title={productModal.product ? 'Editar Producto' : 'Nuevo Producto'}
        open={productModal.visible}
        onCancel={() => setProductModal({ visible: false })}
        footer={null}
        width={600}
      >
        <Form
          form={productForm}
          layout="vertical"
          onFinish={handleProductSubmit}
          initialValues={{ isActive: true, sendToKitchen: true }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Nombre"
                rules={[{ required: true, message: 'Ingrese el nombre' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="categoryId"
                label="Categoría"
                rules={[{ required: true, message: 'Seleccione una categoría' }]}
              >
                <Select
                  options={categories?.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="Seleccionar categoría"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="price"
                label="Precio"
                rules={[{ required: true, message: 'Ingrese el precio' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  addonAfter="€"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stock" label="Stock">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="preparationTime" label="Tiempo prep. (min)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="barcode" label="Código de barras">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sku" label="SKU">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="imageUrl" label="URL de imagen">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="sendToKitchen" label="Enviar a cocina" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isActive" label="Activo" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setProductModal({ visible: false })}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={productMutation.isPending}>
                {productModal.product ? 'Actualizar' : 'Crear'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Category Modal */}
      <Modal
        title={categoryModal.category ? 'Editar Categoría' : 'Nueva Categoría'}
        open={categoryModal.visible}
        onCancel={() => setCategoryModal({ visible: false })}
        footer={null}
      >
        <Form
          form={categoryForm}
          layout="vertical"
          onFinish={handleCategorySubmit}
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="name"
            label="Nombre"
            rules={[{ required: true, message: 'Ingrese el nombre' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="color" label="Color">
                <Input type="color" style={{ width: 60, height: 32 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sortOrder" label="Orden">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isActive" label="Activa" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCategoryModal({ visible: false })}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={categoryMutation.isPending}>
                {categoryModal.category ? 'Actualizar' : 'Crear'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
