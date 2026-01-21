import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { id: 'default-restaurant' },
    update: {},
    create: {
      id: 'default-restaurant',
      name: 'Tormel Demo Restaurant',
      address: 'Calle Principal 123, Madrid',
      phone: '+34 912 345 678',
      email: 'info@tormel-demo.com',
      taxId: 'B12345678',
      currency: 'EUR',
      timezone: 'Europe/Madrid',
      defaultTaxRate: 21.00,
      receiptHeader: 'Bienvenido a Tormel Demo',
      receiptFooter: 'Gracias por su visita. ¡Vuelva pronto!',
    },
  });

  console.log('✅ Restaurant created:', restaurant.name);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tormel.com' },
    update: {},
    create: {
      email: 'admin@tormel.com',
      username: 'admin',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      pin: '1234',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create manager user
  const managerPassword = await bcrypt.hash('manager123', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@tormel.com' },
    update: {},
    create: {
      email: 'manager@tormel.com',
      username: 'manager',
      passwordHash: managerPassword,
      firstName: 'María',
      lastName: 'García',
      role: UserRole.MANAGER,
      pin: '5678',
    },
  });

  console.log('✅ Manager user created:', manager.email);

  // Create waiter users
  const waiterPassword = await bcrypt.hash('waiter123', 12);
  const waiter1 = await prisma.user.upsert({
    where: { email: 'carlos@tormel.com' },
    update: {},
    create: {
      email: 'carlos@tormel.com',
      username: 'carlos',
      passwordHash: waiterPassword,
      firstName: 'Carlos',
      lastName: 'López',
      role: UserRole.WAITER,
      pin: '1111',
    },
  });

  const waiter2 = await prisma.user.upsert({
    where: { email: 'ana@tormel.com' },
    update: {},
    create: {
      email: 'ana@tormel.com',
      username: 'ana',
      passwordHash: waiterPassword,
      firstName: 'Ana',
      lastName: 'Martínez',
      role: UserRole.WAITER,
      pin: '2222',
    },
  });

  console.log('✅ Waiter users created');

  // Create zones
  const terrace = await prisma.zone.upsert({
    where: { id: 'zone-terrace' },
    update: { color: '#52c41a' },
    create: {
      id: 'zone-terrace',
      restaurantId: restaurant.id,
      name: 'Terraza',
      description: 'Zona exterior con vistas',
      color: '#52c41a',
      sortOrder: 1,
    },
  });

  const mainHall = await prisma.zone.upsert({
    where: { id: 'zone-main' },
    update: { color: '#1890ff' },
    create: {
      id: 'zone-main',
      restaurantId: restaurant.id,
      name: 'Salón Principal',
      description: 'Zona interior principal',
      color: '#1890ff',
      sortOrder: 2,
    },
  });

  const bar = await prisma.zone.upsert({
    where: { id: 'zone-bar' },
    update: { color: '#722ed1' },
    create: {
      id: 'zone-bar',
      restaurantId: restaurant.id,
      name: 'Barra',
      description: 'Zona de barra',
      color: '#722ed1',
      sortOrder: 3,
    },
  });

  console.log('✅ Zones created');

  // Create tables
  const tables = [
    // Terraza tables
    { zoneId: terrace.id, number: 'T1', capacity: 4, positionX: 50, positionY: 50, shape: 'square' },
    { zoneId: terrace.id, number: 'T2', capacity: 4, positionX: 200, positionY: 50, shape: 'square' },
    { zoneId: terrace.id, number: 'T3', capacity: 6, positionX: 350, positionY: 50, shape: 'rectangle' },
    { zoneId: terrace.id, number: 'T4', capacity: 2, positionX: 50, positionY: 200, shape: 'circle' },
    { zoneId: terrace.id, number: 'T5', capacity: 2, positionX: 200, positionY: 200, shape: 'circle' },
    // Main hall tables
    { zoneId: mainHall.id, number: '1', capacity: 4, positionX: 50, positionY: 50, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '2', capacity: 4, positionX: 200, positionY: 50, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '3', capacity: 4, positionX: 350, positionY: 50, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '4', capacity: 6, positionX: 500, positionY: 50, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '5', capacity: 4, positionX: 50, positionY: 200, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '6', capacity: 4, positionX: 200, positionY: 200, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '7', capacity: 8, positionX: 350, positionY: 200, width: 150, shape: 'rectangle' },
    { zoneId: mainHall.id, number: '8', capacity: 2, positionX: 50, positionY: 350, shape: 'circle' },
    { zoneId: mainHall.id, number: '9', capacity: 2, positionX: 200, positionY: 350, shape: 'circle' },
    { zoneId: mainHall.id, number: '10', capacity: 4, positionX: 350, positionY: 350, shape: 'square' },
    // Bar tables
    { zoneId: bar.id, number: 'B1', capacity: 2, positionX: 50, positionY: 50, shape: 'circle' },
    { zoneId: bar.id, number: 'B2', capacity: 2, positionX: 150, positionY: 50, shape: 'circle' },
    { zoneId: bar.id, number: 'B3', capacity: 2, positionX: 250, positionY: 50, shape: 'circle' },
    { zoneId: bar.id, number: 'B4', capacity: 2, positionX: 350, positionY: 50, shape: 'circle' },
  ];

  for (const table of tables) {
    await prisma.table.upsert({
      where: { zoneId_number: { zoneId: table.zoneId, number: table.number } },
      update: {},
      create: table,
    });
  }

  console.log('✅ Tables created');

  // Create categories
  const categories = [
    { id: 'cat-drinks', name: 'Bebidas', color: '#1890ff', icon: 'coffee', sortOrder: 1 },
    { id: 'cat-starters', name: 'Entrantes', color: '#52c41a', icon: 'dish', sortOrder: 2 },
    { id: 'cat-mains', name: 'Platos Principales', color: '#fa8c16', icon: 'main-dish', sortOrder: 3 },
    { id: 'cat-desserts', name: 'Postres', color: '#eb2f96', icon: 'cake', sortOrder: 4 },
    { id: 'cat-wines', name: 'Vinos', color: '#722ed1', icon: 'wine', sortOrder: 5 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {},
      create: category,
    });
  }

  // Create subcategories
  const drinkSubcategories = [
    { id: 'cat-soft-drinks', name: 'Refrescos', parentId: 'cat-drinks', color: '#40a9ff', sortOrder: 1 },
    { id: 'cat-hot-drinks', name: 'Bebidas Calientes', parentId: 'cat-drinks', color: '#d4380d', sortOrder: 2 },
    { id: 'cat-beers', name: 'Cervezas', parentId: 'cat-drinks', color: '#faad14', sortOrder: 3 },
  ];

  for (const subcat of drinkSubcategories) {
    await prisma.category.upsert({
      where: { id: subcat.id },
      update: {},
      create: subcat,
    });
  }

  console.log('✅ Categories created');

  // Create products
  const products = [
    // Drinks - Soft
    { categoryId: 'cat-soft-drinks', name: 'Coca-Cola', price: 2.50, taxRate: 10 },
    { categoryId: 'cat-soft-drinks', name: 'Coca-Cola Zero', price: 2.50, taxRate: 10 },
    { categoryId: 'cat-soft-drinks', name: 'Fanta Naranja', price: 2.50, taxRate: 10 },
    { categoryId: 'cat-soft-drinks', name: 'Sprite', price: 2.50, taxRate: 10 },
    { categoryId: 'cat-soft-drinks', name: 'Agua Mineral', price: 2.00, taxRate: 10 },
    { categoryId: 'cat-soft-drinks', name: 'Zumo de Naranja', price: 3.00, taxRate: 10 },
    // Drinks - Hot
    { categoryId: 'cat-hot-drinks', name: 'Café Solo', price: 1.50, taxRate: 10 },
    { categoryId: 'cat-hot-drinks', name: 'Café con Leche', price: 1.80, taxRate: 10 },
    { categoryId: 'cat-hot-drinks', name: 'Cortado', price: 1.60, taxRate: 10 },
    { categoryId: 'cat-hot-drinks', name: 'Té', price: 2.00, taxRate: 10 },
    { categoryId: 'cat-hot-drinks', name: 'Infusión', price: 2.00, taxRate: 10 },
    // Drinks - Beers
    { categoryId: 'cat-beers', name: 'Caña', price: 2.00, taxRate: 10 },
    { categoryId: 'cat-beers', name: 'Doble', price: 3.00, taxRate: 10 },
    { categoryId: 'cat-beers', name: 'Jarra', price: 4.50, taxRate: 10 },
    { categoryId: 'cat-beers', name: 'Cerveza Sin Alcohol', price: 2.50, taxRate: 10 },
    // Starters
    { categoryId: 'cat-starters', name: 'Pan con Tomate', price: 3.50, taxRate: 10, sendToKitchen: true, preparationTime: 5 },
    { categoryId: 'cat-starters', name: 'Croquetas (6 uds)', price: 7.00, taxRate: 10, sendToKitchen: true, preparationTime: 10 },
    { categoryId: 'cat-starters', name: 'Patatas Bravas', price: 5.50, taxRate: 10, sendToKitchen: true, preparationTime: 12 },
    { categoryId: 'cat-starters', name: 'Jamón Ibérico', price: 18.00, taxRate: 10, sendToKitchen: true, preparationTime: 5 },
    { categoryId: 'cat-starters', name: 'Tabla de Quesos', price: 12.00, taxRate: 10, sendToKitchen: true, preparationTime: 5 },
    { categoryId: 'cat-starters', name: 'Ensalada Mixta', price: 6.50, taxRate: 10, sendToKitchen: true, preparationTime: 8 },
    { categoryId: 'cat-starters', name: 'Gazpacho', price: 5.00, taxRate: 10, sendToKitchen: true, preparationTime: 3 },
    // Main courses
    { categoryId: 'cat-mains', name: 'Paella Valenciana', price: 14.00, taxRate: 10, sendToKitchen: true, preparationTime: 25 },
    { categoryId: 'cat-mains', name: 'Arroz Negro', price: 15.00, taxRate: 10, sendToKitchen: true, preparationTime: 25 },
    { categoryId: 'cat-mains', name: 'Entrecot de Ternera', price: 18.00, taxRate: 10, sendToKitchen: true, preparationTime: 20 },
    { categoryId: 'cat-mains', name: 'Lubina a la Plancha', price: 16.00, taxRate: 10, sendToKitchen: true, preparationTime: 18 },
    { categoryId: 'cat-mains', name: 'Pollo al Ajillo', price: 12.00, taxRate: 10, sendToKitchen: true, preparationTime: 20 },
    { categoryId: 'cat-mains', name: 'Merluza en Salsa Verde', price: 15.00, taxRate: 10, sendToKitchen: true, preparationTime: 18 },
    { categoryId: 'cat-mains', name: 'Cochinillo Asado', price: 22.00, taxRate: 10, sendToKitchen: true, preparationTime: 30 },
    { categoryId: 'cat-mains', name: 'Hamburguesa Gourmet', price: 13.00, taxRate: 10, sendToKitchen: true, preparationTime: 15 },
    // Desserts
    { categoryId: 'cat-desserts', name: 'Tarta de Queso', price: 5.50, taxRate: 10, sendToKitchen: true, preparationTime: 3 },
    { categoryId: 'cat-desserts', name: 'Crema Catalana', price: 5.00, taxRate: 10, sendToKitchen: true, preparationTime: 3 },
    { categoryId: 'cat-desserts', name: 'Flan Casero', price: 4.50, taxRate: 10, sendToKitchen: true, preparationTime: 3 },
    { categoryId: 'cat-desserts', name: 'Helado (2 bolas)', price: 4.00, taxRate: 10, sendToKitchen: true, preparationTime: 2 },
    { categoryId: 'cat-desserts', name: 'Brownie con Helado', price: 6.50, taxRate: 10, sendToKitchen: true, preparationTime: 5 },
    { categoryId: 'cat-desserts', name: 'Fruta del Tiempo', price: 4.00, taxRate: 10, sendToKitchen: true, preparationTime: 3 },
    // Wines
    { categoryId: 'cat-wines', name: 'Copa Vino Tinto', price: 3.50, taxRate: 10 },
    { categoryId: 'cat-wines', name: 'Copa Vino Blanco', price: 3.50, taxRate: 10 },
    { categoryId: 'cat-wines', name: 'Botella Rioja Crianza', price: 18.00, taxRate: 10 },
    { categoryId: 'cat-wines', name: 'Botella Ribera del Duero', price: 22.00, taxRate: 10 },
    { categoryId: 'cat-wines', name: 'Botella Albariño', price: 16.00, taxRate: 10 },
    { categoryId: 'cat-wines', name: 'Cava Brut', price: 15.00, taxRate: 10 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        ...product,
        sku: product.name.toLowerCase().replace(/\s+/g, '-'),
      },
    });
  }

  console.log('✅ Products created');

  // Create modifier groups
  const sizeModifierGroup = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-size' },
    update: {},
    create: {
      id: 'mod-group-size',
      name: 'Tamaño',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
    },
  });

  const cookingModifierGroup = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-cooking' },
    update: {},
    create: {
      id: 'mod-group-cooking',
      name: 'Punto de Cocción',
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
    },
  });

  const extrasModifierGroup = await prisma.modifierGroup.upsert({
    where: { id: 'mod-group-extras' },
    update: {},
    create: {
      id: 'mod-group-extras',
      name: 'Extras',
      minSelections: 0,
      maxSelections: 5,
      isRequired: false,
    },
  });

  // Create modifiers
  const sizeModifiers = [
    { modifierGroupId: sizeModifierGroup.id, name: 'Pequeño', price: 0, isDefault: true, sortOrder: 1 },
    { modifierGroupId: sizeModifierGroup.id, name: 'Mediano', price: 1.50, sortOrder: 2 },
    { modifierGroupId: sizeModifierGroup.id, name: 'Grande', price: 2.50, sortOrder: 3 },
  ];

  for (const modifier of sizeModifiers) {
    await prisma.modifier.create({
      data: modifier,
    });
  }

  const cookingModifiers = [
    { modifierGroupId: cookingModifierGroup.id, name: 'Poco Hecho', price: 0, sortOrder: 1 },
    { modifierGroupId: cookingModifierGroup.id, name: 'Al Punto', price: 0, isDefault: true, sortOrder: 2 },
    { modifierGroupId: cookingModifierGroup.id, name: 'Muy Hecho', price: 0, sortOrder: 3 },
  ];

  for (const modifier of cookingModifiers) {
    await prisma.modifier.create({
      data: modifier,
    });
  }

  const extraModifiers = [
    { modifierGroupId: extrasModifierGroup.id, name: 'Extra Queso', price: 1.50, sortOrder: 1 },
    { modifierGroupId: extrasModifierGroup.id, name: 'Extra Bacon', price: 2.00, sortOrder: 2 },
    { modifierGroupId: extrasModifierGroup.id, name: 'Huevo Frito', price: 1.00, sortOrder: 3 },
    { modifierGroupId: extrasModifierGroup.id, name: 'Guacamole', price: 2.00, sortOrder: 4 },
  ];

  for (const modifier of extraModifiers) {
    await prisma.modifier.create({
      data: modifier,
    });
  }

  console.log('✅ Modifiers created');

  // Link modifiers to products (hamburger)
  const hamburger = await prisma.product.findFirst({
    where: { name: 'Hamburguesa Gourmet' },
  });

  if (hamburger) {
    await prisma.productModifierGroup.createMany({
      data: [
        { productId: hamburger.id, modifierGroupId: cookingModifierGroup.id, sortOrder: 1 },
        { productId: hamburger.id, modifierGroupId: extrasModifierGroup.id, sortOrder: 2 },
      ],
      skipDuplicates: true,
    });
  }

  // Link size modifier to drinks
  const cafeSolo = await prisma.product.findFirst({
    where: { name: 'Café Solo' },
  });

  if (cafeSolo) {
    await prisma.productModifierGroup.createMany({
      data: [
        { productId: cafeSolo.id, modifierGroupId: sizeModifierGroup.id, sortOrder: 1 },
      ],
      skipDuplicates: true,
    });
  }

  console.log('✅ Product-Modifier links created');

  // Create system config
  const configs = [
    { key: 'order_number_sequence', value: '1000', description: 'Current order number sequence' },
    { key: 'bill_number_prefix', value: 'B', description: 'Bill number prefix' },
    { key: 'bill_number_sequence', value: '1000', description: 'Current bill number sequence' },
    { key: 'auto_print_kitchen', value: 'true', description: 'Auto print to kitchen' },
    { key: 'auto_print_receipt', value: 'false', description: 'Auto print receipt on payment' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  console.log('✅ System config created');

  console.log('');
  console.log('🎉 Database seeding completed!');
  console.log('');
  console.log('📧 Default users:');
  console.log('   Admin:   admin@tormel.com / admin123 (PIN: 1234)');
  console.log('   Manager: manager@tormel.com / manager123 (PIN: 5678)');
  console.log('   Waiter:  carlos@tormel.com / waiter123 (PIN: 1111)');
  console.log('   Waiter:  ana@tormel.com / waiter123 (PIN: 2222)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
