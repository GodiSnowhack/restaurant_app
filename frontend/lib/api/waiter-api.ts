/**
 * API для работы с функциями официанта
 */

import { Order } from './types';
import { demoWaiterOrders } from '../demo-data/waiter-orders';
import { api } from '../api';

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
         !api.defaults.baseURL;
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
      
      // Получаем информацию о пользователе
      const userInfo = getUserInfo();
      const token = getAuthToken();

      console.log(`waiterApi.getWaiterOrders - Информация о пользователе:`, userInfo);

      if (!userInfo || !token) {
        console.error('waiterApi.getWaiterOrders - Отсутствуют данные пользователя или токен авторизации');
        throw new Error('Необходима авторизация');
      }

      // Получаем ID пользователя и его роль
      let userId = userInfo.id;
      let userRole = userInfo.role;
      
      // Логируем полученные данные для отладки
      console.log(`waiterApi.getWaiterOrders - ID пользователя: ${userId}, роль: ${userRole}`);
      
      if (!userId) {
        console.error('waiterApi.getWaiterOrders - Не удалось определить ID пользователя');
        throw new Error('Не удалось определить ID пользователя');
      }

      // Формируем URL запроса к API
      const apiUrl = '/api/v1/waiter/orders';
      
      console.log(`waiterApi.getWaiterOrders - Отправка запроса на: ${apiUrl}`);

      // Формируем заголовки с явным указанием роли и ID
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Role': userRole,
        'X-User-ID': userId ? String(userId) : ''
      };

      // Выполняем запрос через axios instance
      const response = await api.get(apiUrl, { headers });

      if (response.status !== 200) {
        console.error(`waiterApi.getWaiterOrders - Ошибка ${response.status}`);
        throw new Error(`Ошибка запроса: ${response.status}`);
      }

      const data = response.data;
      console.log(`waiterApi.getWaiterOrders - Получено заказов: ${Array.isArray(data) ? data.length : 'не массив'}`);
      
      if (!Array.isArray(data)) {
        console.warn('waiterApi.getWaiterOrders - Получены данные не в формате массива:', data);
        return data && typeof data === 'object' ? [data] : [];
      }
      
      return data;
    } catch (error) {
      console.error('waiterApi.getWaiterOrders - Критическая ошибка:', error);
      throw error;
    }
  },

  /**
   * Привязка заказа к официанту по коду
   * @param orderCode Код заказа
   * @returns Результат привязки
   */
  assignOrderByCode: async (orderCode: string): Promise<{
    success: boolean;
    order_id?: number;
    message: string;
  }> => {
    try {
      // Проверяем, нужно ли использовать демо-данные
      if (shouldUseDemoData()) {
        return {
          success: true,
          order_id: 12345,
          message: 'Заказ успешно привязан (демо-режим)'
        };
      }

      const token = getEnhancedToken();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await api.post('/waiter/assign-order-by-code', { code: orderCode });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при привязке заказа по коду:', error);
      throw error;
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
      
      // Отправляем запрос
      const response = await api.patch(`/waiter/orders/${orderId}/status`, { status });
      
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
      
      // Отправляем запрос
      const response = await api.post(`/waiter/orders/${orderId}/confirm-payment`);
      
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
      
      // Отправляем запрос
      const response = await api.post(`/waiter/orders/${orderId}/complete`);
      
      console.log(`waiterApi.completeOrder - Заказ успешно завершен`);
      return true;
    } catch (error: any) {
      console.error(`waiterApi.completeOrder - Критическая ошибка:`, error);
      return false;
    }
  },

  /**
   * Генерация кода официанта
   * @returns Результат генерации кода
   */
  generateWaiterCode: async (): Promise<{
    success: boolean;
    code?: string;
    expiresAt?: Date;
    message?: string;
  }> => {
    try {
      // Проверяем, нужно ли использовать демо-данные
      if (shouldUseDemoData()) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
        return {
          success: true,
          code,
          expiresAt,
          message: 'Код успешно сгенерирован (демо-режим)'
        };
      }

      const token = getEnhancedToken();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await api.post('/waiter/generate-code');
      return {
        success: true,
        ...response.data
      };
    } catch (error: any) {
      console.error('Ошибка при генерации кода:', error);
      return {
        success: false,
        message: error.message || 'Произошла ошибка при генерации кода'
      };
    }
  },

  /**
   * Привязка официанта к заказу по коду
   * @param orderId ID заказа
   * @param waiterCode Код официанта
   * @returns Результат привязки
   */
  assignWaiterToOrder: async (orderId: number, waiterCode: string): Promise<{
    success: boolean;
    message: string;
    waiterId?: string;
  }> => {
    try {
      // Проверяем, нужно ли использовать демо-данные
      if (shouldUseDemoData()) {
        return {
          success: true,
          waiterId: '12345',
          message: 'Официант успешно привязан к заказу (демо-режим)'
        };
      }

      const token = getEnhancedToken();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await api.post(`/waiter/orders/${orderId}/assign-waiter`, { code: waiterCode });
      return {
        success: true,
        ...response.data
      };
    } catch (error: any) {
      console.error('Ошибка при привязке официанта:', error);
      return {
        success: false,
        message: error.message || 'Произошла ошибка при привязке официанта'
      };
    }
  }
};

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

interface WaiterRating {
  rating: number;
  count: number;
}

interface WaiterReview {
  id: number;
  user_name: string;
  service_rating: number;
  comment?: string;
  created_at: string;
}

export const getWaiterRating = async (waiterId: number): Promise<WaiterRating> => {
  try {
    const response = await api.get(`/waiter/${waiterId}/rating`);
    return response.data;
  } catch (error) {
    console.error('Error fetching waiter rating:', error);
    return { rating: 0, count: 0 };
  }
};

export const getWaiterReviews = async (waiterId: number): Promise<WaiterReview[]> => {
  try {
    const response = await api.get(`/waiter/${waiterId}/reviews`);
    return response.data;
  } catch (error) {
    console.error('Error fetching waiter reviews:', error);
    return [];
  }
};
