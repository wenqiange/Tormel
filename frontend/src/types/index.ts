// User types
export type UserRole = 'ADMIN' | 'MANAGER' | 'WAITER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  pin?: string;
  isActive: boolean;
  restaurantId?: string;
  createdAt: string;
  updatedAt: string;
}

// Table types
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED';
export type TableShape = 'square' | 'rectangle' | 'circle';

export interface Zone {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  restaurantId: string;
  tables: Table[];
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  number: string;
  name?: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zoneId: string;
  zone?: Zone;
  sessions?: TableSession[];
  currentSession?: TableSession;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Table position update for drag & drop
export interface TablePositionUpdate {
  id: string;
  positionX: number;
  positionY: number;
}

// Create/Update table DTOs
export interface CreateTableData {
  zoneId: string;
  number: string;
  name?: string;
  capacity?: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  shape?: TableShape;
}

export interface UpdateTableData extends Partial<CreateTableData> {
  status?: TableStatus;
  isActive?: boolean;
}

export interface TableSession {
  id: string;
  tableId: string;
  table?: Table;
  waiterId?: string;
  waiter?: User;
  guestCount: number;
  guestName?: string;
  customerCount?: number; // Alias for backward compatibility
  customerName?: string;  // Alias for backward compatibility
  notes?: string;
  openedAt: string;
  closedAt?: string;
  orders: Order[];
  bills: Bill[];
}

// Product types
export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  barcode?: string;
  sku?: string;
  categoryId: string;
  category?: Category;
  isActive: boolean;
  sendToKitchen: boolean;
  preparationTime?: number;
  stock?: number;
  modifierGroups?: ModifierGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  groupId: string;
}

// Order types
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface Order {
  id: string;
  orderNumber?: number;
  tableSessionId: string;
  tableSession?: TableSession;
  waiterId: string;
  waiter?: User;
  status: OrderStatus;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  modifiers?: OrderItemModifier[];
  isBilled: boolean;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderItemModifier {
  id: string;
  orderItemId: string;
  modifierId: string;
  modifier?: Modifier;
  name: string;
  price: number;
}

// Billing types
export type BillStatus = 'OPEN' | 'PAID' | 'PARTIALLY_PAID' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';

export interface Bill {
  id: string;
  billNumber?: number;
  tableSessionId: string;
  tableSession?: TableSession;
  subtotal: number;
  tax: number;
  taxRate: number;
  discount: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  tip: number;
  total: number;
  status: BillStatus;
  items: BillItem[];
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}

export interface BillItem {
  id: string;
  billId: string;
  orderItemId: string;
  orderItem?: OrderItem;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Payment {
  id: string;
  billId: string;
  bill?: Bill;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  change?: number;
  processedById: string;
  processedBy?: User;
  processedAt: string;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface PinLoginCredentials {
  pin: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Real-time event types
export interface RealtimeEvent<T = any> {
  type: string;
  payload: T;
  timestamp: string;
}

// Cart types (for order creation)
export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  modifiers?: Modifier[];
}

export interface Cart {
  items: CartItem[];
  tableSessionId?: string;
}
