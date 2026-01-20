import { create } from 'zustand';
import { CartItem, Product, Modifier } from '@/types';

interface CartState {
  items: CartItem[];
  tableSessionId: string | null;
  
  // Actions
  addItem: (product: Product, quantity?: number, modifiers?: Modifier[], notes?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateNotes: (productId: string, notes: string) => void;
  clearCart: () => void;
  setTableSession: (tableSessionId: string | null) => void;
  
  // Computed
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  tableSessionId: null,

  addItem: (product: Product, quantity = 1, modifiers?: Modifier[], notes?: string) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => 
          item.product.id === product.id && 
          JSON.stringify(item.modifiers) === JSON.stringify(modifiers) &&
          item.notes === notes
      );

      if (existingIndex >= 0) {
        // Update quantity of existing item
        const newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
        };
        return { items: newItems };
      }

      // Add new item
      return {
        items: [...state.items, { product, quantity, modifiers, notes }],
      };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      ),
    }));
  },

  updateNotes: (productId: string, notes: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, notes } : item
      ),
    }));
  },

  clearCart: () => {
    set({ items: [], tableSessionId: null });
  },

  setTableSession: (tableSessionId: string | null) => {
    set({ tableSessionId });
  },

  getTotal: () => {
    const { items } = get();
    return items.reduce((total, item) => {
      const modifiersPrice = item.modifiers?.reduce((sum, mod) => sum + mod.price, 0) || 0;
      return total + (item.product.price + modifiersPrice) * item.quantity;
    }, 0);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((count, item) => count + item.quantity, 0);
  },
}));
