import { create, StateCreator } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';

export interface CartItem {
  id: string;
  dish_id: number;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  comment?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

type CartPersist = (
  config: StateCreator<CartStore>,
  options: PersistOptions<CartStore>
) => StateCreator<CartStore>;

const useCartStore = create<CartStore>(
  (persist as CartPersist)(
    (set: (state: Partial<CartStore>) => void, get: () => CartStore) => ({
      items: [],
      
      addItem: (item: Omit<CartItem, 'id'>) => {
        const items = get().items;
        const id = Math.random().toString(36).substr(2, 9);
        set({ items: [...items, { ...item, id }] });
      },
      
      removeItem: (id: string) => {
        const items = get().items;
        set({ items: items.filter(item => item.id !== id) });
      },
      
      updateQuantity: (id: string, quantity: number) => {
        const items = get().items;
        set({
          items: items.map(item =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      },
      
      clearCart: () => set({ items: [] }),
      
      getTotal: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
      getStorage: () => localStorage,
    }
  )
);

export default useCartStore; 