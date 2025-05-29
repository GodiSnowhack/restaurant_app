import React, { useCallback, useEffect, useState } from 'react';
import { ordersApi } from '../lib/api/orders';
import { Order } from '../lib/api/types';

// Расширенный интерфейс для контекста заказов
interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchOrders: (startDate?: string, endDate?: string) => Promise<void>;
  fetchOrdersByStatus: (status: string, startDate?: string, endDate?: string) => Promise<void>;
  getOrderById: (id: number) => Order | undefined;
  refreshOrders: () => Promise<void>;
  clearOrders: () => void;
  lastUpdated: Date | null;
}

// Создаем контекст с дефолтными значениями
const OrdersContext = React.createContext<OrdersContextType>({
  orders: [],
  loading: true,
  error: null,
  fetchOrders: async () => {},
  fetchOrdersByStatus: async () => {},
  getOrderById: () => undefined,
  refreshOrders: async () => {},
  clearOrders: () => {},
  lastUpdated: null
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentDateRange, setCurrentDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getCurrentDate()
  });

  // Функция для загрузки заказов
  const fetchOrders = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    
    // Сохраняем текущий диапазон дат
    const newStartDate = startDate || getDefaultStartDate();
    const newEndDate = endDate || getCurrentDate();
    
    setCurrentDateRange({
      startDate: newStartDate,
      endDate: newEndDate
    });
    
    // Принудительно отключаем демо-режим перед запросом
    try {
      localStorage.removeItem('force_demo_data');
      console.log('OrdersContext: Демо-режим отключен');
    } catch (e) {
      console.error('OrdersContext: Ошибка при отключении демо-режима:', e);
    }
    
    try {
      console.log(`OrdersContext: Загрузка заказов с ${newStartDate} по ${newEndDate}`);
      const orderData = await ordersApi.getAllOrders({
        start_date: newStartDate,
        end_date: newEndDate
      });
      
      if (Array.isArray(orderData)) {
        // Проверяем и нормализуем данные заказов
        const normalizedOrders = orderData.map(order => ({
          ...order,
          // Убеждаемся, что важные поля имеют значения по умолчанию
          id: order.id || 0,
          status: order.status || 'pending',
          payment_status: order.payment_status || 'pending',
          payment_method: order.payment_method || 'card',
          total_amount: typeof order.total_amount === 'number' ? order.total_amount : 
                       (typeof order.total_amount === 'string' ? parseFloat(order.total_amount) : 0),
          created_at: order.created_at || new Date().toISOString(),
          // Нормализуем массив товаров
          items: Array.isArray(order.items) ? order.items.map(item => ({
            dish_id: item.dish_id || 0,
            quantity: item.quantity || 1,
            price: typeof item.price === 'number' ? item.price : 
                  (typeof item.price === 'string' ? parseFloat(item.price) : 0),
            name: item.name || item.dish_name || 'Неизвестное блюдо',
            special_instructions: item.special_instructions || ''
          })) : []
        }));
        
        console.log(`OrdersContext: Получено ${normalizedOrders.length} заказов`);
        setOrders(normalizedOrders);
        setLastUpdated(new Date());
      } else {
        console.warn('OrdersContext: Получены некорректные данные (не массив)');
        setOrders([]);
      }
      
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
      console.log(`OrdersContext: Загрузка заказов со статусом "${status}"`);
      const orderData = await ordersApi.getAllOrders({
        start_date: startDate || currentDateRange.startDate, 
        end_date: endDate || currentDateRange.endDate,
        status: status
      });
      
      // Фильтруем заказы по статусу (учитываем верхний и нижний регистр)
      const lowerStatus = status.toLowerCase();
      const filteredOrders = orderData.filter(order => 
        order.status?.toLowerCase() === lowerStatus
      );
      
      console.log(`OrdersContext: Получено ${filteredOrders.length} заказов со статусом "${status}"`);
      setOrders(filteredOrders);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке заказов');
      console.error('OrdersContext: Ошибка при загрузке заказов по статусу:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDateRange]);

  // Функция для обновления текущих заказов
  const refreshOrders = useCallback(async () => {
    console.log('OrdersContext: Обновление списка заказов');
    return fetchOrders(currentDateRange.startDate, currentDateRange.endDate);
  }, [fetchOrders, currentDateRange]);

  // Функция для очистки списка заказов
  const clearOrders = useCallback(() => {
    console.log('OrdersContext: Очистка списка заказов');
    setOrders([]);
    setLastUpdated(null);
  }, []);

  // Функция для получения заказа по ID
  const getOrderById = useCallback((id: number): Order | undefined => {
    return orders.find(order => order.id === id);
  }, [orders]);

  // Загружаем заказы при первом рендере
  useEffect(() => {
    fetchOrders();
    
    // Настраиваем автоматическое обновление каждые 2 минуты
    const interval = setInterval(() => {
      console.log('OrdersContext: Автоматическое обновление заказов');
      refreshOrders();
    }, 2 * 60 * 1000); // 2 минуты
    
    // Очищаем интервал при размонтировании компонента
    return () => clearInterval(interval);
  }, [fetchOrders, refreshOrders]);

  // Значение контекста
  const contextValue: OrdersContextType = {
    orders,
    loading,
    error,
    fetchOrders,
    fetchOrdersByStatus,
    getOrderById,
    refreshOrders,
    clearOrders,
    lastUpdated
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