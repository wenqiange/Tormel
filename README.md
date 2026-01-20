# Tormel - POS & Management System for HORECA

A comprehensive Point of Sale and management system designed for restaurants, bars, and cafés.

## Features

- 🪑 **Dynamic Table Management** - Visual table map with real-time status
- 📝 **Order Processing** - Create, modify, and track orders
- 💰 **Billing & Payments** - Split bills, apply taxes, track payments
- 🔄 **Real-time Updates** - WebSocket-powered instant synchronization
- 📴 **Offline Support** - Continue working without internet
- 🖨️ **Receipt Printing** - ESC/POS thermal printer support

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   Backend API   │────▶│   PostgreSQL    │
│  React/Electron │◀────│     NestJS      │◀────│    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         └───────────────────────┘
              WebSocket (Socket.IO)
```

## Tech Stack

### Backend
- Node.js + NestJS
- Prisma ORM
- PostgreSQL
- Socket.IO
- JWT Authentication

### Frontend
- React 18 + TypeScript
- Vite
- Ant Design
- Zustand (State Management)
- Electron (Desktop)

## Project Structure

```
tormel/
├── backend/                 # NestJS Backend
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── users/          # User management
│   │   ├── tables/         # Table management
│   │   ├── products/       # Product catalog
│   │   ├── orders/         # Order processing
│   │   ├── billing/        # Bill generation
│   │   ├── payments/       # Payment processing
│   │   ├── realtime/       # WebSocket gateway
│   │   └── printing/       # Receipt printing
│   └── prisma/             # Database schema
│
├── frontend/               # React + Electron Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API services
│   │   └── electron/       # Electron main process
│   └── public/
│
└── docker/                 # Docker configuration
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- pnpm (recommended) or npm

### Development Setup

1. **Clone and install dependencies**
```bash
cd tormel

# Backend
cd backend
pnpm install
cp .env.example .env
# Edit .env with your database credentials

# Frontend
cd ../frontend
pnpm install
```

2. **Setup database**
```bash
cd backend
pnpm prisma migrate dev
pnpm prisma db seed
```

3. **Start development servers**
```bash
# Terminal 1 - Backend
cd backend
pnpm run start:dev

# Terminal 2 - Frontend
cd frontend
pnpm run dev

# Terminal 3 - Electron (optional)
cd frontend
pnpm run electron:dev
```

### Docker Setup

```bash
docker-compose up -d
```

## User Roles

| Role    | Permissions |
|---------|-------------|
| Admin   | Full system access, user management, reports |
| Manager | Table management, orders, billing, reports |
| Waiter  | Table assignment, order creation, basic billing |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Tables
- `GET /api/tables` - List all tables
- `POST /api/tables` - Create table
- `PATCH /api/tables/:id` - Update table
- `PATCH /api/tables/:id/status` - Change table status

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id` - Update order
- `PATCH /api/orders/:id/status` - Change order status

### Billing
- `GET /api/bills` - List bills
- `POST /api/bills` - Generate bill
- `POST /api/bills/:id/split` - Split bill
- `POST /api/bills/:id/payment` - Process payment

## WebSocket Events

### Emitted by Server
- `table:updated` - Table status changed
- `order:created` - New order created
- `order:updated` - Order modified
- `order:status` - Order status changed
- `bill:created` - Bill generated
- `payment:received` - Payment processed

### Emitted by Client
- `table:subscribe` - Subscribe to table updates
- `order:subscribe` - Subscribe to order updates
- `kitchen:subscribe` - Subscribe to kitchen orders

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tormel

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# Printing
PRINTER_ENABLED=true
PRINTER_NAME=EPSON_TM_T88V
```

## License

MIT License - See LICENSE file for details
