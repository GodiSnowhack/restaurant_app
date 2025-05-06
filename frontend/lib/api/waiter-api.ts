/**
 * API для работы с функциями официанта
 */

import { Order } from './types';
import { demoWaiterOrders } from '../demo-data/waiter-orders';

// Функция для получения информации о пользователе из localStorage
const getUserInfo = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Проверяем информацию из localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    
    // Альтернативные источники информации о пользователе
    const userProfileStr = localStorage.getItem('user_profile');
    if (userProfileStr) {
      return JSON.parse(userProfileStr);
    }
    
    return null;
  } catch (e) {
    console.error('Ошибка при получении информации о пользователе:', e);
    return null;
  }
};

// Получение токена авторизации
const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  
  return localStorage.getItem('token') || null;
};

// Проверка, нужно ли использовать демо-данные
const shouldUseDemoData = () => {
  if (typeof window === 'undefined') return true;
  
  // Проверяем настройки использования демо-данных
  const useDemoData = localStorage.getItem('use_demo_data');
  
  // Если явно установлено использование демо-данных или отсутствует бэкенд
  return useDemoData === 'true' || 
         process.env.NEXT_PUBLIC_USE_DEMO_DATA === 'true' || 
         !process.env.NEXT_PUBLIC_API_URL;
};

/**
 * API для работы с заказами официантов
 */
export const waiterApi = {
  /**
   * Получение списка заказов официанта
   * @returns Массив заказов
   */
  getWaiterOrders: async (): Promise<Order[]> => {
    try {
      console.log('waiterApi.getWaiterOrders - Начало запроса');
      
      // Проверяем, нужно ли использовать демо-данные
      if (shouldUseDemoData()) {
        console.log('waiterApi.getWaiterOrders - Используем демо-данные');
        return demoWaiterOrders;
      }
      
      // Получаем информацию о пользователе
      const userInfo = getUserInfo();
      const token = getAuthToken();

      console.log(`waiterApi.getWaiterOrders - Информация о пользователе:`, userInfo);

      if (!userInfo || !token) {
        console.error('waiterApi.getWaiterOrders - Отсутствуют данные пользователя или токен авторизации');
        console.log('waiterApi.getWaiterOrders - Используем демо-данные из-за отсутствия авторизации');
        return demoWaiterOrders;
      }

      // Получаем ID пользователя и его роль
      let userId = userInfo.id;
      let userRole = userInfo.role;
      
      // Логируем полученные данные для отладки
      console.log(`waiterApi.getWaiterOrders - ID пользователя: ${userId}, роль: ${userRole}`);
      
      if (!userId) {
        console.error('waiterApi.getWaiterOrders - Не удалось определить ID пользователя');
        console.log('waiterApi.getWaiterOrders - Используем демо-данные из-за отсутствия ID пользователя');
        return demoWaiterOrders;
      }

      // Пробуем сначала получить заказы через специальное API для официантов
      try {
        const apiUrl = '/api/waiter/simple-orders';
        console.log(`waiterApi.getWaiterOrders - Отправка запроса на: ${apiUrl}`);
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-Role': userRole,
          'X-User-ID': userId ? String(userId) : ''
        };
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: headers,
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`waiterApi.getWaiterOrders - Получено заказов: ${Array.isArray(data) ? data.length : 'не массив'}`);
          
          if (Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
        
        // Если не получилось или нет данных, пробуем основной API
        console.log('waiterApi.getWaiterOrders - Переход к основному API заказов...');
      } catch (error) {
        console.warn('waiterApi.getWaiterOrders - Ошибка с simple-orders API, пробуем основной API:', error);
      }

      // Формируем URL запроса к обычному API
      const apiUrl = '/api/waiter/orders';
      
      console.log(`waiterApi.getWaiterOrders - Отправка запроса на: ${apiUrl}`);

      // Формируем заголовки с явным указанием роли и ID
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Role': userRole,
        'X-User-ID': userId ? String(userId) : ''
      };

      try {
        // Выполняем запрос
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: headers,
          cache: 'no-store'
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`waiterApi.getWaiterOrders - Ошибка ${response.status}: ${errorText}`);
          
          // Если ошибка 401 (не авторизован) или 403 (доступ запрещен), возвращаем демо-данные
          if (response.status === 401 || response.status === 403) {
            console.log('waiterApi.getWaiterOrders - Ошибка авторизации, используем демо-данные');
            return demoWaiterOrders;
          }
          
          throw new Error(`Ошибка запроса: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log(`waiterApi.getWaiterOrders - Получено заказов: ${Array.isArray(data) ? data.length : 'не массив'}`);
        
        if (!Array.isArray(data)) {
          console.warn('waiterApi.getWaiterOrders - Получены данные не в формате массива:', data);
          return data && typeof data === 'object' ? [data] : demoWaiterOrders;
        }
        
        // Если массив пустой, возвращаем демо-данные
        if (data.length === 0) {
          console.log('waiterApi.getWaiterOrders - Получен пустой массив, используем демо-данные');
          return demoWaiterOrders;
        }
        
        return data;
      } catch (fetchError) {
        console.error('waiterApi.getWaiterOrders - Ошибка при выполнении запроса:', fetchError);
        console.log('waiterApi.getWaiterOrders - Используем демо-данные из-за ошибки запроса');
        return demoWaiterOrders;
      }
    } catch (error) {
      console.error('waiterApi.getWaiterOrders - Критическая ошибка:', error);
      console.log('waiterApi.getWaiterOrders - Используем демо-данные из-за критической ошибки');
      return demoWaiterOrders;
    }
  },

  /**
   * Привязка заказа к официанту по коду
   * @param orderCode Код заказа
   * @returns Результат привязки
   */
  assignOrder: async (orderCode: string): Promise<{
    success: boolean; 
    order_id?: number; 
    message: string;
    status?: string;
    waiter_id?: number;
  }> => {
    console.log('waiterApi.assignOrder - Начало привязки заказа с кодом:', orderCode);
    
    try {
      // Получаем информацию о пользователе
      const userInfo = getUserInfo();
      const token = getAuthToken();

      if (!userInfo || !token) {
        console.error('waiterApi.assignOrder - Отсутствуют данные пользователя или токен авторизации');
        throw new Error('Необходима авторизация');
      }

      // Формируем URL запроса
      const apiUrl = `/api/waiter/assign-order`;
      
      // Формируем заголовки
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Выполняем запрос
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ order_code: orderCode })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`waiterApi.assignOrder - Ошибка ${response.status}: ${errorText}`);
        throw new Error(errorText || `Ошибка запроса: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        ...data
      };
    } catch (error: any) {
      console.error(`waiterApi.assignOrder - Критическая ошибка:`, error);
      
      // Возвращаем ошибку
      return {
        success: false,
        message: error.message || 'Неизвестная ошибка при привязке заказа'
      };
    }
  },

  /**
   * Обновление статуса заказа
   * @param orderId ID заказа
   * @param status Новый статус
   * @returns Результат обновления
   */
  updateOrderStatus: async (orderId: number | string, status: string): Promise<boolean> => {
    console.log(`waiterApi.updateOrderStatus - Обновление статуса заказа ${orderId} на ${status}`);
    
    try {
      // Получаем токен для авторизации
      const token = getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      // Формируем URL для обновления статуса
      const url = `/api/waiter/orders/${orderId}/status`;
      
      // Отправляем запрос
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      
      // Обрабатываем ответ
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`waiterApi.updateOrderStatus - Ошибка: ${errorText}`);
        throw new Error(`Не удалось обновить статус: ${errorText}`);
      }
      
      console.log(`waiterApi.updateOrderStatus - Статус успешно обновлен`);
      return true;
    } catch (error: any) {
      console.error(`waiterApi.updateOrderStatus - Критическая ошибка:`, error);
      return false;
    }
  },

  /**
   * Подтверждение оплаты заказа
   * @param orderId ID заказа
   * @returns Результат операции
   */
  confirmPayment: async (orderId: number | string): Promise<boolean> => {
    console.log(`waiterApi.confirmPayment - Подтверждение оплаты заказа ${orderId}`);
    
    try {
      // Получаем токен для авторизации
      const token = getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      // Формируем URL для подтверждения оплаты
      const url = `/api/waiter/orders/${orderId}/confirm-payment`;
      
      // Отправляем запрос
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Обрабатываем ответ
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`waiterApi.confirmPayment - Ошибка: ${errorText}`);
        throw new Error(`Не удалось подтвердить оплату: ${errorText}`);
      }
      
      console.log(`waiterApi.confirmPayment - Оплата успешно подтверждена`);
      return true;
    } catch (error: any) {
      console.error(`waiterApi.confirmPayment - Критическая ошибка:`, error);
      return false;
    }
  },

  /**
   * Завершение заказа
   * @param orderId ID заказа
   * @returns Результат операции
   */
  completeOrder: async (orderId: number | string): Promise<boolean> => {
    console.log(`waiterApi.completeOrder - Завершение заказа ${orderId}`);
    
    try {
      // Получаем токен для авторизации
      const token = getAuthToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }
      
      // Формируем URL для завершения заказа
      const url = `/api/waiter/orders/${orderId}/complete`;
      
      // Отправляем запрос
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Обрабатываем ответ
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`waiterApi.completeOrder - Ошибка: ${errorText}`);
        throw new Error(`Не удалось завершить заказ: ${errorText}`);
      }
      
      console.log(`waiterApi.completeOrder - Заказ успешно завершен`);
      return true;
    } catch (error: any) {
      console.error(`waiterApi.completeOrder - Критическая ошибка:`, error);
      return false;
    }
  }
};

// Экспортируем функцию привязки заказа для обратной совместимости
export const assignOrderByCode = async (orderCode: string): Promise<any> => {
  console.log('assignOrderByCode - Вызов waiterApi.assignOrder');
  return waiterApi.assignOrder(orderCode);
};

export default waiterApi;

// Добавим функцию для получения улучшенного токена
function getEnhancedToken(): string {
  let token = null;
  
  // 1. Пробуем получить токен из localStorage
  try {
    token = localStorage.getItem('token');
    if (token) return token;
  } catch (e) {
    console.error('getEnhancedToken - Ошибка при получении токена из localStorage:', e);
  }
  
  // 2. Пробуем получить токен из sessionStorage
  try {
    token = sessionStorage.getItem('token');
    if (token) return token;
  } catch (e) {
    console.error('getEnhancedToken - Ошибка при получении токена из sessionStorage:', e);
  }
  
  // 3. Пробуем получить токен из cookie
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token' && value) {
        return value;
      }
    }
  } catch (e) {
    console.error('getEnhancedToken - Ошибка при получении токена из cookie:', e);
  }
  
  // Возвращаем пустую строку, если токен не найден
  return '';
}
