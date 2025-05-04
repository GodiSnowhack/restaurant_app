/**
 * API для работы с функциями официанта
 */

import { Order } from '../api';

// Функция для получения информации о пользователе
const getUserInfo = (): { role: string, id?: number | null } => {
  try {
    // Сначала пытаемся получить токен и извлечь из него информацию
    const token = getAuthToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = parts[1];
          // Правильно декодируем base64url формат токена
          const decodedPayload = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
          
          const tokenData = JSON.parse(decodedPayload);
          
          // Если в токене есть ID пользователя, считаем это главным источником
          if (tokenData.sub) {
            // Если в токене есть поле role, используем его
            if (tokenData.role) {
              // Приводим роль к нижнему регистру для единообразия
              const normalizedRole = String(tokenData.role).toLowerCase();
              // Проверяем, содержит ли роль слово "admin" или явно указана как "admin"
              const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('admin');
              return {
                role: isAdmin ? 'admin' : normalizedRole,
                id: parseInt(tokenData.sub)
              };
            }
            
            // Если пользователь с ID 1, то по умолчанию считаем его админом
            if (tokenData.sub === 1 || tokenData.sub === "1") {
              return { 
                role: 'admin', 
                id: 1 
              };
            }
            
            // Для остальных пользователей с ID в токене устанавливаем роль waiter
            return { 
              role: 'waiter', 
              id: parseInt(tokenData.sub) 
            };
          }
        }
      } catch (tokenError) {
        console.warn('getUserInfo - Ошибка декодирования токена:', tokenError);
      }
    }
    
    // Проверяем localStorage на наличие данных пользователя
    const localUserStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (localUserStr) {
      try {
        const localUser = JSON.parse(localUserStr);
        if (localUser && localUser.role) {
          // Проверяем, является ли пользователь админом
          const normalizedRole = String(localUser.role).toLowerCase();
          const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('admin');
          return { 
            role: isAdmin ? 'admin' : normalizedRole,
            id: localUser.id || null
          };
        }
      } catch (parseError) {
        console.warn('getUserInfo - Ошибка при парсинге данных из localStorage:', parseError);
      }
    }
    
    // Если не получилось, пробуем из sessionStorage
    const sessionUserStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null;
    if (sessionUserStr) {
      try {
        const sessionUser = JSON.parse(sessionUserStr);
        if (sessionUser && sessionUser.role) {
          const normalizedRole = String(sessionUser.role).toLowerCase();
          const isAdmin = normalizedRole === 'admin' || normalizedRole.includes('admin');
          return { 
            role: isAdmin ? 'admin' : normalizedRole,
            id: sessionUser.id || null
          };
        }
      } catch (parseError) {
        console.warn('getUserInfo - Ошибка при парсинге данных из sessionStorage:', parseError);
      }
    }

    // Если есть какой-то токен, но из него не удалось получить роль, 
    // предполагаем что это официант (для работы приложения)
    if (token) {
      return { role: 'waiter', id: null };
    }
  } catch (e) {
    console.error('Ошибка при получении информации о пользователе:', e);
  }
  
  console.warn('getUserInfo - Не удалось получить данные пользователя, возвращаем unknown');
  return { role: 'unknown', id: null };
};

// Получение токена авторизации
const getAuthToken = (): string | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
    return null;
  }
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
        return [];
      }

      // Получаем ID пользователя и его роль
      let userId = userInfo.id;
      let userRole = userInfo.role;
      
      // Логируем полученные данные для отладки
      console.log(`waiterApi.getWaiterOrders - ID пользователя: ${userId}, роль: ${userRole}`);
      
      if (!userId) {
        console.error('waiterApi.getWaiterOrders - Не удалось определить ID пользователя');
        return [];
      }

      // Определяем роль администратора
      const isAdmin = userRole === 'admin';
      console.log(`waiterApi.getWaiterOrders - Итоговая роль: ${userRole}, ID: ${userId}, isAdmin: ${isAdmin}`);

      // Формируем URL запроса
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

      // Выполняем запрос
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers,
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`waiterApi.getWaiterOrders - Ошибка ${response.status}: ${errorText}`);
        throw new Error(`Ошибка запроса: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log(`waiterApi.getWaiterOrders - Получено заказов: ${Array.isArray(data) ? data.length : 'не массив'}`);
      
      if (!Array.isArray(data)) {
        console.warn('waiterApi.getWaiterOrders - Получены данные не в формате массива:', data);
        return data && typeof data === 'object' ? [data] : [];
      }
      
      return data;
    } catch (error) {
      console.error('waiterApi.getWaiterOrders - Критическая ошибка:', error);
      return [];
    }
  },

  /**
   * Привязка заказа к официанту по коду заказа
   * @param orderCode Код заказа
   * @returns Информация о результате привязки
   */
  assignOrder: async (orderCode: string): Promise<{
    success: boolean; 
    order_id?: number; 
    message: string;
    status?: string;
    waiter_id?: number;
  }> => {
    console.log('waiterApi.assignOrder - Начало привязки заказа с кодом:', orderCode);
    
    // Получаем информацию о пользователе и токен
    const userInfo = getUserInfo();
    const token = getAuthToken();
    
    if (!userInfo || !userInfo.id || !token) {
      console.error('waiterApi.assignOrder - Недостаточно данных для привязки заказа');
      throw new Error('Для привязки заказа необходимо авторизоваться');
    }
    
    console.log('waiterApi.assignOrder - Данные пользователя:', {
      id: userInfo.id,
      role: userInfo.role
    });
    
    // Используем каскадный подход с несколькими методами привязки
    try {
      // Формируем URL для экстренной привязки
      const apiUrl = `/api/waiter/emergency-assign`;
      
      console.log(`waiterApi.assignOrder - Отправка запроса на привязку на ${apiUrl}`);
      
      // Отправляем запрос на привязку
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_code: orderCode,
          waiter_id: userInfo.id
        })
      });
      
      // Обрабатываем ответ
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`waiterApi.assignOrder - Ошибка при привязке: ${errorText}`);
        throw new Error(`Не удалось привязать заказ: ${errorText}`);
      }
      
      // Парсим JSON ответа
      const responseData = await response.json();
      console.log(`waiterApi.assignOrder - Ответ сервера:`, responseData);
      
      // Проверяем успешность привязки
      if (!responseData.success) {
        console.error(`waiterApi.assignOrder - Сервер вернул ошибку:`, responseData.message);
        throw new Error(responseData.message || 'Не удалось привязать заказ');
      }
      
      // Формируем ответ
      return {
        success: true,
        order_id: responseData.order_id,
        message: responseData.message || 'Заказ успешно привязан к официанту',
        status: responseData.status || 'CONFIRMED',
        waiter_id: userInfo.id
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