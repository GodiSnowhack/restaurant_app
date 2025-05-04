import { api } from './core';
import { Order } from './types';

// API функции для официантов
export const waiterApi = {
  // Получение всех заказов, назначенных на официанта
  getWaiterOrders: async (): Promise<Order[]> => {
    try {
      console.log('API getWaiterOrders - Начало запроса');
      
      // Получаем информацию о пользователе
      let userRole = 'unknown';
      let userId = null;
      try {
        const userInfo = localStorage.getItem('user');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          userRole = user.role || 'unknown';
          userId = user.id;
          console.log(`API getWaiterOrders - Роль пользователя: ${userRole}, ID: ${userId}`);
        }
      } catch (e) {
        console.error('API getWaiterOrders - Ошибка при получении информации о пользователе:', e);
      }
      
      // Проверяем роль пользователя
      if (userRole !== 'waiter' && userRole !== 'admin') {
        console.error('API getWaiterOrders - Доступ запрещен: пользователь не является официантом или администратором');
        throw new Error('Доступ запрещен: пользователь не является официантом');
      }
      
      // Получаем заказы
      const response = await api.get('/waiter/orders');
      console.log(`API getWaiterOrders - Получено заказов: ${response.data.length}`);
      return response.data;
    } catch (error) {
      console.error('API getWaiterOrders - Критическая ошибка:', error);
      return [];
    }
  },
  
  // Обновление статуса заказа официантом
  updateOrder: async (orderId: number, status: string): Promise<Order> => {
    try {
      console.log(`API updateWaiterOrder - Обновление заказа ${orderId} до статуса "${status}"`);
      
      // Проверяем правильность статуса
      const validStatuses = ['confirmed', 'in_progress', 'ready', 'delivered', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        console.error(`API updateWaiterOrder - Неверный статус: ${status}`);
        throw new Error(`Неверный статус заказа: ${status}`);
      }
      
      // Обновляем статус заказа
      const response = await api.put(`/waiter/orders/${orderId}`, { status });
      console.log(`API updateWaiterOrder - Заказ ${orderId} успешно обновлен до статуса "${status}"`);
      return response.data;
    } catch (error) {
      console.error(`API updateWaiterOrder - Ошибка при обновлении заказа ${orderId}:`, error);
      throw error;
    }
  },
  
  // Назначение заказа на официанта
  assignOrder: async (orderId: number, waiterId?: number): Promise<Order> => {
    try {
      console.log(`API assignOrder - Назначение заказа ${orderId} официанту ${waiterId || 'текущему'}`);
      
      // Если ID официанта не указан, используем ID текущего пользователя
      let actualWaiterId = waiterId;
      if (!actualWaiterId) {
        try {
          const userInfo = localStorage.getItem('user');
          if (userInfo) {
            const user = JSON.parse(userInfo);
            actualWaiterId = user.id;
            console.log(`API assignOrder - Используем ID текущего пользователя: ${actualWaiterId}`);
          }
        } catch (e) {
          console.error('API assignOrder - Ошибка при получении информации о пользователе:', e);
        }
      }
      
      // Проверяем, что ID официанта указан
      if (!actualWaiterId) {
        console.error('API assignOrder - ID официанта не указан');
        throw new Error('ID официанта не указан');
      }
      
      // Назначаем заказ на официанта
      const response = await api.post(`/waiter/orders/${orderId}/assign`, { waiter_id: actualWaiterId });
      console.log(`API assignOrder - Заказ ${orderId} успешно назначен официанту ${actualWaiterId}`);
      return response.data;
    } catch (error) {
      console.error(`API assignOrder - Ошибка при назначении заказа ${orderId}:`, error);
      throw error;
    }
  },
  
  // Добавление позиции к заказу
  addItemToOrder: async (orderId: number, item: any): Promise<Order> => {
    try {
      console.log(`API addItemToOrder - Добавление позиции к заказу ${orderId}:`, item);
      
      // Проверяем наличие обязательных полей
      if (!item.dish_id || !item.quantity) {
        console.error('API addItemToOrder - Отсутствуют обязательные поля позиции');
        throw new Error('Отсутствуют обязательные поля позиции (dish_id, quantity)');
      }
      
      // Добавляем позицию к заказу
      const response = await api.post(`/waiter/orders/${orderId}/items`, item);
      console.log(`API addItemToOrder - Позиция успешно добавлена к заказу ${orderId}`);
      return response.data;
    } catch (error) {
      console.error(`API addItemToOrder - Ошибка при добавлении позиции к заказу ${orderId}:`, error);
      throw error;
    }
  },
  
  // Удаление позиции из заказа
  removeItemFromOrder: async (orderId: number, itemId: number): Promise<Order> => {
    try {
      console.log(`API removeItemFromOrder - Удаление позиции ${itemId} из заказа ${orderId}`);
      
      // Удаляем позицию из заказа
      const response = await api.delete(`/waiter/orders/${orderId}/items/${itemId}`);
      console.log(`API removeItemFromOrder - Позиция ${itemId} успешно удалена из заказа ${orderId}`);
      return response.data;
    } catch (error) {
      console.error(`API removeItemFromOrder - Ошибка при удалении позиции ${itemId} из заказа ${orderId}:`, error);
      throw error;
    }
  },
  
  // Обновление количества позиции в заказе
  updateItemQuantity: async (orderId: number, itemId: number, quantity: number): Promise<Order> => {
    try {
      console.log(`API updateItemQuantity - Обновление количества позиции ${itemId} в заказе ${orderId} до ${quantity}`);
      
      // Проверяем корректность количества
      if (quantity <= 0) {
        console.error(`API updateItemQuantity - Неверное количество: ${quantity}`);
        throw new Error('Количество должно быть больше 0');
      }
      
      // Обновляем количество позиции
      const response = await api.put(`/waiter/orders/${orderId}/items/${itemId}`, { quantity });
      console.log(`API updateItemQuantity - Количество позиции ${itemId} в заказе ${orderId} успешно обновлено до ${quantity}`);
      return response.data;
    } catch (error) {
      console.error(`API updateItemQuantity - Ошибка при обновлении количества позиции ${itemId} в заказе ${orderId}:`, error);
      throw error;
    }
  },
  
  // Добавление комментария к заказу
  addOrderComment: async (orderId: number, comment: string): Promise<Order> => {
    try {
      console.log(`API addOrderComment - Добавление комментария к заказу ${orderId}`);
      
      // Добавляем комментарий к заказу
      const response = await api.post(`/waiter/orders/${orderId}/comments`, { comment });
      console.log(`API addOrderComment - Комментарий успешно добавлен к заказу ${orderId}`);
      return response.data;
    } catch (error) {
      console.error(`API addOrderComment - Ошибка при добавлении комментария к заказу ${orderId}:`, error);
      throw error;
    }
  },
  
  // Получение доступных столиков
  getAvailableTables: async (): Promise<any[]> => {
    try {
      console.log('API getAvailableTables - Получение доступных столиков');
      
      // Получаем доступные столики
      const response = await api.get('/waiter/tables/available');
      console.log(`API getAvailableTables - Получено доступных столиков: ${response.data.length}`);
      return response.data;
    } catch (error) {
      console.error('API getAvailableTables - Ошибка при получении доступных столиков:', error);
      return [];
    }
  },
  
  // Изменение статуса столика (занят/свободен)
  updateTableStatus: async (tableId: number, status: string): Promise<any> => {
    try {
      console.log(`API updateTableStatus - Обновление статуса столика ${tableId} до "${status}"`);
      
      // Проверяем правильность статуса
      const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
      if (!validStatuses.includes(status)) {
        console.error(`API updateTableStatus - Неверный статус: ${status}`);
        throw new Error(`Неверный статус столика: ${status}`);
      }
      
      // Обновляем статус столика
      const response = await api.put(`/waiter/tables/${tableId}`, { status });
      console.log(`API updateTableStatus - Статус столика ${tableId} успешно обновлен до "${status}"`);
      return response.data;
    } catch (error) {
      console.error(`API updateTableStatus - Ошибка при обновлении статуса столика ${tableId}:`, error);
      throw error;
    }
  },
  
  // Создание нового заказа официантом
  createOrder: async (orderData: any): Promise<Order> => {
    try {
      console.log('API createWaiterOrder - Создание нового заказа:', orderData);
      
      // Проверяем наличие обязательных полей
      if (!orderData.table_number || !orderData.items || orderData.items.length === 0) {
        console.error('API createWaiterOrder - Отсутствуют обязательные поля заказа');
        throw new Error('Отсутствуют обязательные поля заказа (table_number, items)');
      }
      
      // Создаем новый заказ
      const response = await api.post('/waiter/orders', orderData);
      console.log(`API createWaiterOrder - Заказ успешно создан, ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error('API createWaiterOrder - Ошибка при создании заказа:', error);
      throw error;
    }
  }
}; 