import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: number;
  dishId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  comment?: string;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  tableNumber?: number;
  comment?: string;
  isUrgent: boolean;
  isGroupOrder: boolean;
  reservationCode?: string; // Код бронирования
  
  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  updateComment: (id: number, comment: string) => void;
  setTableNumber: (tableNumber?: number) => void;
  setOrderComment: (comment: string) => void;
  setUrgent: (isUrgent: boolean) => void;
  setGroupOrder: (isGroupOrder: boolean) => void;
  setReservationCode: (code: string) => void; // Установка кода бронирования
  clearCart: () => void;
}

const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      totalItems: 0,
      totalPrice: 0,
      isUrgent: false,
      isGroupOrder: false,
      
      addItem: (newItem) => set((state) => {
        // Проверяем, есть ли уже такой товар в корзине
        const existingItemIndex = state.items.findIndex(
          (item) => item.dishId === newItem.dishId
        );
        
        let updatedItems;
        
        if (existingItemIndex !== -1) {
          // Если товар уже есть, увеличиваем количество
          updatedItems = state.items.map((item, index) => {
            if (index === existingItemIndex) {
              return { 
                ...item, 
                quantity: item.quantity + newItem.quantity,
                comment: newItem.comment || item.comment
              };
            }
            return item;
          });
        } else {
          // Если товара нет, добавляем его с новым id
          const newId = state.items.length > 0 
            ? Math.max(...state.items.map(item => item.id)) + 1 
            : 1;
            
          updatedItems = [...state.items, { ...newItem, id: newId }];
        }
        
        // Пересчитываем итоги
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        return { items: updatedItems, totalItems, totalPrice };
      }),
      
      removeItem: (id) => set((state) => {
        const updatedItems = state.items.filter(item => item.id !== id);
        
        // Пересчитываем итоги
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        return { items: updatedItems, totalItems, totalPrice };
      }),
      
      updateQuantity: (id, quantity) => set((state) => {
        // Если количество 0 или меньше, удаляем товар
        if (quantity <= 0) {
          // Вместо вызова метода выполним удаление вручную
          const updatedItems = state.items.filter(item => item.id !== id);
          const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
          const totalPrice = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
          
          return { items: updatedItems, totalItems, totalPrice };
        }
        
        const updatedItems = state.items.map(item => 
          item.id === id ? { ...item, quantity } : item
        );
        
        // Пересчитываем итоги
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        
        return { items: updatedItems, totalItems, totalPrice };
      }),
      
      updateComment: (id, comment) => set((state) => {
        const updatedItems = state.items.map(item => 
          item.id === id ? { ...item, comment } : item
        );
        
        return { items: updatedItems };
      }),
      
      setTableNumber: (tableNumber) => set({ tableNumber }),
      
      setOrderComment: (comment) => set({ comment }),
      
      setUrgent: (isUrgent) => set({ isUrgent }),
      
      setGroupOrder: (isGroupOrder) => set({ isGroupOrder }),
      
      setReservationCode: (reservationCode) => set({ reservationCode }),
      
      clearCart: () => set({ 
        items: [], 
        totalItems: 0, 
        totalPrice: 0,
        tableNumber: undefined,
        comment: undefined,
        isUrgent: false,
        isGroupOrder: false,
        reservationCode: undefined
      }),
    }),
    {
      name: 'restaurant-cart',
    }
  )
);

export default useCartStore; 