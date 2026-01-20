import Dexie, { Table } from 'dexie';
import { Order, Bill, Product, Table as TableType, Zone } from '@/types';

// Offline database for local persistence
class TormelDB extends Dexie {
  orders!: Table<Order & { synced: boolean }>;
  bills!: Table<Bill & { synced: boolean }>;
  products!: Table<Product>;
  tables!: Table<TableType>;
  zones!: Table<Zone>;
  syncQueue!: Table<{
    id?: number;
    action: string;
    entity: string;
    data: any;
    timestamp: number;
    retries: number;
  }>;

  constructor() {
    super('TormelPOS');
    
    this.version(1).stores({
      orders: '++id, tableSessionId, status, synced, createdAt',
      bills: '++id, tableSessionId, status, synced, createdAt',
      products: 'id, categoryId, name, isActive',
      tables: 'id, zoneId, status',
      zones: 'id, restaurantId',
      syncQueue: '++id, action, entity, timestamp',
    });
  }
}

export const db = new TormelDB();

// Sync queue management
export async function addToSyncQueue(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  data: any
) {
  await db.syncQueue.add({
    action,
    entity,
    data,
    timestamp: Date.now(),
    retries: 0,
  });
}

export async function processSyncQueue() {
  const items = await db.syncQueue.toArray();
  
  for (const item of items) {
    try {
      // Process sync item based on action and entity
      // This would make API calls to sync data
      console.log('Syncing:', item);
      
      // Remove from queue on success
      await db.syncQueue.delete(item.id!);
    } catch (error) {
      // Increment retry count
      await db.syncQueue.update(item.id!, {
        retries: item.retries + 1,
      });
      
      // Remove if too many retries
      if (item.retries >= 5) {
        await db.syncQueue.delete(item.id!);
      }
    }
  }
}

// Cache products for offline use
export async function cacheProducts(products: Product[]) {
  await db.products.clear();
  await db.products.bulkAdd(products);
}

// Cache tables for offline use
export async function cacheTables(tables: TableType[]) {
  await db.tables.clear();
  await db.tables.bulkAdd(tables);
}

// Cache zones for offline use
export async function cacheZones(zones: Zone[]) {
  await db.zones.clear();
  await db.zones.bulkAdd(zones);
}

// Get cached products
export async function getCachedProducts(): Promise<Product[]> {
  return db.products.toArray();
}

// Get cached tables
export async function getCachedTables(): Promise<TableType[]> {
  return db.tables.toArray();
}

// Get cached zones
export async function getCachedZones(): Promise<Zone[]> {
  return db.zones.toArray();
}

export default db;
