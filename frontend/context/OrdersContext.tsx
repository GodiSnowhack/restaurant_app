import React, { useCallback, useEffect, useState } from 'react';
import { ordersApi } from '../lib/api/orders';
import { Order } from '../lib/api/types';

// Интерфейс для контекста заказов
interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchOrders: (startDate?: string, endDate?: string) => Promise<void>;
  fetchOrdersByStatus: (status: string, startDate?: string, endDate?: string) => Promise<void>;
}

// Создаем контекст с дефолтными значениями
const OrdersContext = React.createContext<OrdersContextType>({
  orders: [],
  loading: true,
  error: null,
  fetchOrders: async () => {},
  fetchOrdersByStatus: async () => {}
});

// Функция для получения текущей даты в формате ISO
const getCurrentDate = (): string => {
  return new Date().toISOString();
};

// Функция для получения даты недельной давности в формате ISO
const getDefaultStartDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
};

// Провайдер контекста заказов
export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Функция для загрузки заказов
  const fetchOrders = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    
    // Принудительно отключаем демо-режим перед запросом
    try {
      localStorage.removeItem('force_demo_data');
      console.log('OrdersContext: Демо-режим отключен');
    } catch (e) {
      console.error('OrdersContext: Ошибка при отключении демо-режима:', e);
    }
    
    try {
      const orderData = await ordersApi.getOrders(
        startDate || getDefaultStartDate(), 
        endDate || getCurrentDate()
      );
      setOrders(orderData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке заказов');
      console.error('OrdersContext: Ошибка при загрузке заказов:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Функция для загрузки заказов по статусу
  const fetchOrdersByStatus = useCallback(async (status: string, startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const orderData = await ordersApi.getOrders(
        startDate || getDefaultStartDate(), 
        endDate || getCurrentDate()
      );
      
      // Фильтруем заказы по статусу
      const filteredOrders = orderData.filter(order => order.status === status);
      setOrders(filteredOrders);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке заказов');
      console.error('OrdersContext: Ошибка при загрузке заказов по статусу:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загружаем заказы при первом рендере
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Значение контекста
  const contextValue: OrdersContextType = {
    orders,
    loading,
    error,
    fetchOrders,
    fetchOrdersByStatus
  };

  return (
    <OrdersContext.Provider value={contextValue}>
      {children}
    </OrdersContext.Provider>
  );
};

// Хук для использования контекста заказов
export const useOrders = (): OrdersContextType => {
  const context = React.useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
};

export default OrdersContext; 