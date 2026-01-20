import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { RealtimeEvent } from '@/types';

type EventCallback = (data: RealtimeEvent) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.socket?.connected) {
      return;
    }

    const token = useAuthStore.getState().accessToken;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      // Re-subscribe to rooms
      this.subscribeToRooms();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('connected', (data) => {
      console.log('Connection acknowledged:', data);
    });

    // Forward all events to registered listeners
    this.socket.onAny((eventName: string, data: RealtimeEvent) => {
      const callbacks = this.listeners.get(eventName);
      if (callbacks) {
        callbacks.forEach((callback) => callback(data));
      }
    });
  }

  private subscribeToRooms() {
    if (!this.socket) return;

    // Subscribe to common rooms
    this.socket.emit('subscribe:tables');
    this.socket.emit('subscribe:orders');
    this.socket.emit('subscribe:billing');
    
    // Kitchen staff subscribe to kitchen
    const user = useAuthStore.getState().user;
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      this.socket.emit('subscribe:kitchen');
    }
  }

  subscribeToTable(tableId: string) {
    if (!this.socket) return;
    this.socket.emit('subscribe:table', { tableId });
  }

  unsubscribeFromTable(tableId: string) {
    if (!this.socket) return;
    this.socket.emit('unsubscribe', { room: `table:${tableId}` });
  }

  subscribeToKitchen() {
    if (!this.socket) return;
    this.socket.emit('subscribe:kitchen');
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: any) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot emit:', event);
      return;
    }
    this.socket.emit(event, data);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
