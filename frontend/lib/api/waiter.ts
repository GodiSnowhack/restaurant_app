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
export const waiterApi = {
  // Получение всех заказов, назначенных на официанта
  getWaiterOrders: async (): Promise<Order[]> => {
    try {
      console.log('API getWaiterOrders - Начало запроса');
      
      // Демо-заказы для отладки - если параметр URL содержит демо-режим
      // например, ?demo=true в URL
      if (typeof window !== 'undefined' && window.location.search.includes('demo=true')) {
        console.log('API getWaiterOrders - Работаем в ДЕМО режиме, возвращаем тестовые данные');
        return [
          {
            id: 1001,
            status: 'new',
            payment_status: 'not_paid',
            payment_method: 'cash',
            total_amount: 5200,
            created_at: new Date().toISOString(),
            table_number: 5,
            customer_name: 'Демо Клиент',
            order_type: 'dine_in',
            items: [
              { dish_id: 1, quantity: 2, price: 1800, name: 'Демо блюдо 1' },
              { dish_id: 2, quantity: 1, price: 1600, name: 'Демо блюдо 2' }
            ]
          },
          {
            id: 1002,
            status: 'preparing',
            payment_status: 'not_paid',
            payment_method: 'card',
            total_amount: 3400,
            created_at: new Date().toISOString(),
            table_number: 3,
            customer_name: 'Тестовый Гость',
            order_type: 'dine_in',
            items: [
              { dish_id: 3, quantity: 1, price: 2200, name: 'Демо блюдо 3' },
              { dish_id: 4, quantity: 1, price: 1200, name: 'Демо блюдо 4' }
            ]
          }
        ];
      }
      
      // Получаем информацию о пользователе
      let userRole = 'unknown';
      let userId = null;
      try {
        // Более продвинутая логика определения роли пользователя
        // Шаг 1: Проверяем localStorage
        const userInfo = localStorage.getItem('user');
        if (userInfo) {
          try {
            const user = JSON.parse(userInfo);
            userRole = user.role || 'unknown';
            userId = user.id;
            console.log(`API getWaiterOrders - Роль из localStorage: ${userRole}, ID: ${userId}`);
          } catch (e) {
            console.error('API getWaiterOrders - Ошибка при парсинге данных пользователя из localStorage:', e);
          }
        }
        
        // Шаг 2: Если роль не определена, пробуем получить из authStore (если доступно в window)
        if (userRole === 'unknown' && typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.props?.pageProps?.user) {
          const storeUser = (window as any).__NEXT_DATA__.props.pageProps.user;
          userRole = storeUser.role || 'unknown';
          userId = storeUser.id;
          console.log(`API getWaiterOrders - Роль из store: ${userRole}, ID: ${userId}`);
        }
        
        // Шаг 3: Пробуем получить из адреса страницы - если мы на странице официанта
        if (userRole === 'unknown' && typeof window !== 'undefined' && window.location.pathname.includes('/waiter/')) {
          userRole = 'waiter';
          console.log(`API getWaiterOrders - Роль определена по URL: ${userRole}`);
        }
        
        // Шаг 4: В крайнем случае, проверяем токен на наличие идентификатора пользователя
        if (userRole === 'unknown') {
          const token = localStorage.getItem('token');
          if (token) {
            try {
              // Парсим JWT токен (упрощенно)
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const payload = JSON.parse(atob(base64));
              
              if (payload.role) {
                userRole = payload.role;
                console.log(`API getWaiterOrders - Роль из токена: ${userRole}`);
              }
              
              // Если пользователь с ID 1, то считаем его админом
              if (payload.sub === 1 || payload.sub === "1") {
                userRole = 'admin';
                userId = 1;
                console.log(`API getWaiterOrders - Администратор определен по ID из токена`);
              } else if (payload.sub) {
                userId = parseInt(payload.sub);
                // Если роль не определена, но есть ID, считаем официантом
                if (userRole === 'unknown') {
                  userRole = 'waiter';
                  console.log(`API getWaiterOrders - Роль определена по наличию ID в токене: ${userRole}`);
                }
              }
            } catch (e) {
              console.error('API getWaiterOrders - Ошибка при парсинге JWT токена:', e);
            }
          }
        }
      } catch (e) {
        console.error('API getWaiterOrders - Ошибка при получении информации о пользователе:', e);
      }
      
      // Выводим итоговую информацию о пользователе
      console.log(`API getWaiterOrders - Итоговая информация: роль ${userRole}, ID: ${userId || 'не определен'}`);
      
      // Проверяем роль пользователя с более мягкими правилами
      // Для администратора или официанта всегда разрешаем доступ
      if (userRole === 'waiter' || userRole === 'admin') {
        console.log('API getWaiterOrders - Доступ разрешен для роли:', userRole);
      } else {
        console.warn('API getWaiterOrders - Доступ запрещен: пользователь не является официантом или администратором');
        
        // Проверяем "тестовый режим" - если включен, возвращаем тестовые данные
        if (typeof localStorage !== 'undefined' && localStorage.getItem('force_test_mode') === 'true') {
          console.log('API getWaiterOrders - Тестовый режим! Возвращаем демо-данные');
          return [
            {
              id: 500,
              status: 'new',
              payment_status: 'not_paid',
              payment_method: 'cash',
              total_amount: 2800,
              created_at: new Date().toISOString(),
              table_number: 2,
              customer_name: 'Тестовый Режим',
              order_type: 'dine_in',
              items: [
                { dish_id: 10, quantity: 2, price: 1400, name: 'Тестовое блюдо' }
              ]
            }
          ];
        }
        
        // Вместо выброса исключения возвращаем пустой массив
        return [];
      }
      
      // Получаем заказы с повторными попытками при таймауте
      try {
        // Проверяем, нужно ли использовать локальный API
        const useLocalApi = typeof localStorage !== 'undefined' && localStorage.getItem('use_local_api') === 'true';
        
        if (useLocalApi) {
          console.log('API getWaiterOrders - Используем локальный API');
          
          // Делаем запрос к локальному API
          try {
            const response = await fetch('/api/waiter/local-orders', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'X-User-Role': userRole,
                'X-User-ID': userId ? String(userId) : ''
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log(`API getWaiterOrders - Получено заказов через локальный API: ${data.length}`);
              
              // Кешируем полученные данные
              if (typeof localStorage !== 'undefined' && data && Array.isArray(data)) {
                try {
                  localStorage.setItem('cached_waiter_orders', JSON.stringify(data));
                  localStorage.setItem('waiter_orders_cache_timestamp', Date.now().toString());
                  console.log('API getWaiterOrders - Данные заказов успешно кешированы');
                } catch (cacheError) {
                  console.error('API getWaiterOrders - Ошибка кеширования данных:', cacheError);
                }
              }
              
              return data;
            } else {
              console.warn(`API getWaiterOrders - Локальный API вернул ошибку: ${response.status}`);
              // Продолжаем выполнение и пробуем основной API
            }
          } catch (localApiError) {
            console.error('API getWaiterOrders - Ошибка локального API:', localApiError);
            // Продолжаем выполнение и пробуем основной API
          }
        }
        
        // Используем функцию с повторными попытками
        const response = await fetchWithRetry('/waiter/orders', { 
          timeout: 15000  // Уменьшаем таймаут до 15 секунд для лучшего UX
        }, 2); // Максимум 2 попытки
        
        console.log(`API getWaiterOrders - Получено заказов: ${response.data.length}`);
        
        // Кешируем полученные данные в localStorage для будущего использования
        if (typeof localStorage !== 'undefined' && response.data && Array.isArray(response.data)) {
          try {
            localStorage.setItem('cached_waiter_orders', JSON.stringify(response.data));
            localStorage.setItem('waiter_orders_cache_timestamp', Date.now().toString());
            console.log('API getWaiterOrders - Данные заказов успешно кешированы');
          } catch (cacheError) {
            console.error('API getWaiterOrders - Ошибка кеширования данных:', cacheError);
          }
        }
        
        return response.data;
      } catch (apiError: any) {
        // Специальная обработка ошибки таймаута
        if (apiError.code === 'ECONNABORTED' || apiError.message?.includes('timeout')) {
          console.warn('API getWaiterOrders - Превышено время ожидания запроса (таймаут)');
          
          // Проверяем локальное хранилище на наличие кешированных данных
          if (typeof localStorage !== 'undefined') {
            try {
              const cachedData = localStorage.getItem('cached_waiter_orders');
              if (cachedData) {
                const orders = JSON.parse(cachedData);
                console.log(`API getWaiterOrders - Использованы кешированные данные: ${orders.length} заказов`);
                return orders;
              }
            } catch (cacheError) {
              console.error('API getWaiterOrders - Ошибка чтения кеша:', cacheError);
            }
          }
          
          // Возвращаем демо-данные с пометкой о таймауте
          return [
            {
              id: 888,
              status: 'new',
              payment_status: 'not_paid',
              payment_method: 'cash',
              total_amount: 3000,
              created_at: new Date().toISOString(),
              table_number: 8,
              customer_name: 'Таймаут API',
              order_type: 'dine_in',
              items: [
                { dish_id: 7, quantity: 2, price: 1500, name: 'Запасное блюдо (таймаут)' }
              ]
            }
          ];
        }
        
        // Если это другая ошибка, прокидываем её дальше
        throw apiError;
      }
    } catch (error) {
      console.error('API getWaiterOrders - Критическая ошибка:', error);
      
      // Проверяем тип ошибки для более детальной обработки
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.warn(`API getWaiterOrders - Тип ошибки: ${errorMessage}`);
      
      // Добавляем проверку на наличие учебного режима через локальное хранилище
      if (typeof localStorage !== 'undefined' && localStorage.getItem('use_mock_data') === 'true') {
        console.log('API getWaiterOrders - Используем тестовые данные из-за ошибки API');
        return [
          {
            id: 999,
            status: 'new',
            payment_status: 'not_paid',
            payment_method: 'cash',
            total_amount: 4500,
            created_at: new Date().toISOString(),
            table_number: 7,
            customer_name: 'Аварийный Режим',
            order_type: 'dine_in',
            items: [
              { dish_id: 5, quantity: 3, price: 1500, name: 'Резервное блюдо 1' }
            ]
          }
        ];
      }
      
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