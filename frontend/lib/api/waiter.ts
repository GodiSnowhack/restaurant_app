import { api } from './core';
import { Order } from './types';

// Функция для выполнения запроса с повторными попытками
const fetchWithRetry = async (url: string, options: any = {}, maxRetries = 2): Promise<any> => {
  let lastError;
  
  // Устанавливаем таймаут по умолчанию, если не передан
  const requestOptions = {
    ...options,
    timeout: options.timeout || 10000 // 10 секунд по умолчанию
  };
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`fetchWithRetry - Попытка ${attempt + 1}/${maxRetries} для URL: ${url}`);
      return await api.get(url, requestOptions);
    } catch (error: any) {
      lastError = error;
      
      // Если это последняя попытка или это не ошибка таймаута/сети, не пытаемся снова
      const isTimeoutOrNetworkError = 
        error.code === 'ECONNABORTED' || 
        error.message?.includes('timeout') || 
        error.message?.includes('Network Error');
      
      if (attempt >= maxRetries - 1 || !isTimeoutOrNetworkError) {
        console.warn(`fetchWithRetry - Не удалось выполнить запрос после ${attempt + 1} попыток:`, error);
        throw error;
      }
      
      // Увеличиваем задержку с каждой попыткой (экспоненциально)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`fetchWithRetry - Повторная попытка через ${delay}мс...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// API функции для официантов
const waiterApi = {
  // Получение всех заказов, назначенных на официанта
  getWaiterOrders: async (): Promise<Order[]> => {
    try {
      console.log('API getWaiterOrders - Начало запроса');
      
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('API getWaiterOrders - Отсутствует токен авторизации');
        throw new Error('Необходима авторизация');
      }

      // Получаем информацию о пользователе из localStorage
      const userInfo = localStorage.getItem('user');
      let userRole = 'unknown';
      let userId = null;

      if (userInfo) {
        try {
          const user = JSON.parse(userInfo);
          userRole = user.role || 'unknown';
          userId = user.id;
          console.log(`API getWaiterOrders - Информация о пользователе: роль=${userRole}, ID=${userId}`);
        } catch (e) {
          console.error('API getWaiterOrders - Ошибка при парсинге данных пользователя:', e);
        }
      }

      // Делаем запрос к API
      const response = await api.get('/api/v1/waiter/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Role': userRole,
          'X-User-ID': userId ? String(userId) : '',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`API getWaiterOrders - Получено ${response.data.length} заказов`);
        return response.data;
      }

      console.warn('API getWaiterOrders - Получены некорректные данные:', response.data);
      return [];
    } catch (error: any) {
      console.error('API getWaiterOrders - Ошибка при получении заказов:', error);
      throw error;
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
      const response = await api.put(`/api/v1/waiter/orders/${orderId}`, { status });
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
  },

  // Принятие заказа официантом
  takeOrder: async (orderId: number): Promise<boolean> => {
    try {
      const response = await api.post(`/waiter/orders/${orderId}/take`);
      return response.status === 200;
    } catch (error) {
      console.error('API takeOrder - Ошибка при принятии заказа:', error);
      throw error;
    }
  },

  // Завершение заказа
  completeOrder: async (orderId: number): Promise<boolean> => {
    try {
      const response = await api.post(`/waiter/orders/${orderId}/complete`);
      return response.status === 200;
    } catch (error) {
      console.error('API completeOrder - Ошибка при завершении заказа:', error);
      throw error;
    }
  }
};

export default waiterApi; 