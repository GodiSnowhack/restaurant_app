import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WaiterCode {
  code: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  orderId?: number;
  customerName?: string;
}

interface WaiterCodesState {
  codes: WaiterCode[];
  addCode: (code: string, expiresAt: Date) => void;
  markCodeAsUsed: (code: string, orderId: number, customerName?: string) => void;
  removeCode: (code: string) => void;
  clearExpiredCodes: () => void;
  getValidCodes: () => WaiterCode[];
}

const useWaiterCodesStore = create<WaiterCodesState>()(
  persist(
    (set, get) => ({
      codes: [],
      
      // Добавление нового кода в хранилище
      addCode: (code: string, expiresAt: Date) => {
        set((state) => ({
          codes: [
            {
              code,
              createdAt: new Date(),
              expiresAt: new Date(expiresAt),
              used: false
            },
            ...state.codes
          ]
        }));
      },
      
      // Отметка кода как использованного
      markCodeAsUsed: (code: string, orderId: number, customerName?: string) => {
        set((state) => ({
          codes: state.codes.map((item) => 
            item.code === code 
              ? { ...item, used: true, orderId, customerName }
              : item
          )
        }));
      },
      
      // Удаление кода из хранилища
      removeCode: (code: string) => {
        set((state) => ({
          codes: state.codes.filter((item) => item.code !== code)
        }));
      },
      
      // Очистка просроченных кодов
      clearExpiredCodes: () => {
        const now = new Date();
        set((state) => ({
          codes: state.codes.filter((item) => new Date(item.expiresAt) > now)
        }));
      },
      
      // Получение действительных (не просроченных) кодов
      getValidCodes: () => {
        const now = new Date();
        return get().codes.filter((item) => new Date(item.expiresAt) > now);
      }
    }),
    {
      name: 'waiter-codes-storage',
      version: 1,
    }
  )
);

export default useWaiterCodesStore; 