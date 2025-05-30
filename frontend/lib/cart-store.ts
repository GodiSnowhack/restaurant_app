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
  totalPrice: number;
  reservationCode: string | null;
  reservationCodeError: string;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  setReservationCode: (code: string | null) => void;
  setReservationCodeError: (error: string) => void;
}

type CartPersist = (
  config: StateCreator<CartStore>,
  options: PersistOptions<CartStore>
) => StateCreator<CartStore>;

const useCartStore = create<CartStore>(
  (persist as CartPersist)(
    (set: (state: Partial<CartStore>) => void, get: () => CartStore) => ({
      items: [],
      totalPrice: 0,
      reservationCode: null,
      reservationCodeError: '',
      
      addItem: (item: Omit<CartItem, 'id'>) => {
        const items = get().items;
        const id = Math.random().toString(36).substr(2, 9);
        const newItems = [...items, { ...item, id }];
        const total = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        set({ items: newItems, totalPrice: total });
      },
      
      removeItem: (id: string) => {
        const items = get().items;
        const newItems = items.filter(item => item.id !== id);
        const total = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        set({ items: newItems, totalPrice: total });
      },
      
      updateQuantity: (id: string, quantity: number) => {
        const items = get().items;
        const newItems = items.map(item =>
          item.id === id ? { ...item, quantity } : item
        );
        const total = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        set({ items: newItems, totalPrice: total });
      },
      
      clearCart: () => set({ items: [], totalPrice: 0, reservationCode: null }),
      
      getTotal: () => {
        const items = get().items;
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      setReservationCode: (code: string | null) => set({ reservationCode: code }),
      
      setReservationCodeError: (error: string) => set({ reservationCodeError: error }),
    }),
    {
      name: 'cart-storage',
      getStorage: () => localStorage,
    }
  )
);

export default useCartStore; 