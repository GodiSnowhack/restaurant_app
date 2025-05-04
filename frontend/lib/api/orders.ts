import { api } from './core';
import { Order } from './types';

// API функции для работы с заказами
export const ordersApi = {
  // Получение всех заказов
  getOrders: async (): Promise<Order[]> => {
    try {
      const response = await api.get('/orders');
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении заказов:', error);
      return [];
    }
  },
  
  // Получение заказов пользователя
  getUserOrders: async (userId?: number): Promise<Order[]> => {
    try {
      // Если ID пользователя не указан, используем /me для текущего пользователя
      const endpoint = userId ? `/users/${userId}/orders` : '/users/me/orders';
      
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении заказов пользователя:', error);
      return [];
    }
  },
  
  // Получение заказа по ID
  getOrderById: async (id: number): Promise<Order | null> => {
    try {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении заказа ${id}:`, error);
      return null;
    }
  },
  
  // Создание нового заказа
  createOrder: async (order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<Order> => {
    try {
      console.log('API: Создание заказа с данными:', {
        ...order,
        items: order.items.map(item => ({
          ...item,
          name: item.name,
          price: item.price
        }))
      });
      
      // Сначала пробуем через прямой API
      try {
        const response = await api.post('/orders', order);
        console.log('API: Заказ успешно создан через API, ID:', response.data.id);
        return response.data;
      } catch (apiError) {
        console.error('API: Ошибка при создании заказа через API:', apiError);
        
        // Пробуем через fetch
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(order)
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API: Заказ успешно создан через fetch, ID:', data.id);
        return data;
      }
    } catch (error) {
      console.error('API: Ошибка при создании заказа:', error);
      throw error;
    }
  },
  
  // Обновление заказа
  updateOrder: async (id: number, orderData: Partial<Order>): Promise<Order> => {
    try {
      const response = await api.put(`/orders/${id}`, orderData);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обновлении заказа ${id}:`, error);
      throw error;
    }
  },
  
  // Отмена заказа
  cancelOrder: async (id: number, reason?: string): Promise<Order> => {
    try {
      const response = await api.post(`/orders/${id}/cancel`, { reason });
      console.log(`API: Заказ ${id} успешно отменен`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при отмене заказа ${id}:`, error);
      throw error;
    }
  },
  
  // Оплата заказа
  processPayment: async (orderId: number, paymentDetails: any): Promise<any> => {
    try {
      const response = await api.post(`/orders/${orderId}/payment`, paymentDetails);
      console.log(`API: Оплата заказа ${orderId} успешно обработана`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обработке оплаты заказа ${orderId}:`, error);
      throw error;
    }
  },
  
  // Получение статистики заказов
  getOrderStats: async (): Promise<any> => {
    try {
      const response = await api.get('/orders/stats');
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении статистики заказов:', error);
      return null;
    }
  },
  
  // Обновление статуса заказа
  updateOrderStatus: async (id: number, status: string): Promise<Order> => {
    try {
      const response = await api.put(`/orders/${id}/status`, { status });
      console.log(`API: Статус заказа ${id} успешно обновлен на ${status}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обновлении статуса заказа ${id}:`, error);
      throw error;
    }
  }
}; 