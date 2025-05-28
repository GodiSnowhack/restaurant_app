import { api } from './core';
import { Order, AssignOrderResponse, PaymentStatus } from './types';
import axios from 'axios';

// API функции для работы с заказами
export const ordersApi = {
  // Получение всех заказов с возможностью фильтрации
  getOrders: async (startDate: string, endDate: string): Promise<Order[]> => {
    console.log('API: Запрос заказов с параметрами:', { start_date: startDate, end_date: endDate });
    
    // Принудительно отключаем демо-режим
    try {
      localStorage.removeItem('force_demo_data');
      localStorage.removeItem('admin_use_demo_data');
      console.log('API: Демо-режим отключен');
    } catch (e) {
      console.error('API: Ошибка при отключении демо-режима:', e);
    }
    
    // Получаем токен для запроса
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('API: Отсутствует токен авторизации');
      return [];
    }
    
    // Создаем объект AbortController для возможности отмены запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд таймаут
    
    try {
      // Формируем URL для запроса с корректным кодированием параметров
      const queryParams = new URLSearchParams();
      queryParams.append('start_date', startDate);
      queryParams.append('end_date', endDate);
      
      // Сначала пробуем запрос через локальный API-прокси
      const url = `/api/orders?${queryParams.toString()}`;
      console.log('API: Отправка запроса к:', url);
      
      // Делаем запрос через fetch с возможностью отмены
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      
      // Очищаем таймер после получения ответа
      clearTimeout(timeoutId);
      
      // Проверяем статус ответа
      if (!response.ok) {
        console.warn(`API: Ошибка при запросе: ${response.status} ${response.statusText}`);
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      
      // Получаем данные ответа
      const data = await response.json();
      console.log('API: Получены данные заказов:', { count: Array.isArray(data) ? data.length : 'не массив' });
      
      // Проверяем валидность данных и конвертируем объект в массив, если это необходимо
      let ordersArray = data;
      
      // Если сервер вернул объект с сообщением, но не массив, пробуем альтернативный запрос
      if (!Array.isArray(data)) {
        console.warn('API: Получены некорректные данные (не массив). Пробуем прямой запрос к API');
        
        try {
          // Прямой запрос к API
          const baseApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
          const directResponse = await fetch(`${baseApiUrl}/orders?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
          });
          
          if (!directResponse.ok) {
            throw new Error(`Ошибка HTTP при прямом запросе: ${directResponse.status}`);
          }
          
          const directData = await directResponse.json();
          
          if (Array.isArray(directData)) {
            console.log('API: Получены данные через прямой запрос:', { count: directData.length });
            ordersArray = directData;
          } else if (directData && typeof directData === 'object' && directData.items && Array.isArray(directData.items)) {
            console.log('API: Получены данные в формате { items: [] }:', { count: directData.items.length });
            ordersArray = directData.items;
          } else {
            throw new Error('Некорректный формат данных при прямом запросе');
          }
        } catch (directError) {
          console.error('API: Ошибка при прямом запросе к API:', directError);
          
          // Если прямой запрос тоже не удался, используем запрос через API с указанием нужных заголовков
          try {
            const apiResponse = await api.get('/orders/', {
              params: { start_date: startDate, end_date: endDate },
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-User-Role': 'admin',
                'X-User-ID': localStorage.getItem('user_id') || '1'
              },
              timeout: 10000
            });
            
            if (Array.isArray(apiResponse.data)) {
              console.log('API: Получены данные через axios:', { count: apiResponse.data.length });
              ordersArray = apiResponse.data;
            } else if (apiResponse.data && typeof apiResponse.data === 'object' && 
                      apiResponse.data.items && Array.isArray(apiResponse.data.items)) {
              console.log('API: Получены данные через axios в формате { items: [] }:', { count: apiResponse.data.items.length });
              ordersArray = apiResponse.data.items;
            } else {
              console.warn('API: Некорректный формат данных при запросе через axios');
              return [];
            }
          } catch (apiError) {
            console.error('API: Все попытки получить заказы не удались');
            return [];
          }
        }
      }
      
      // Нормализуем полученные данные
      const normalizedOrders = ordersArray.map((order: any) => ({
        ...order,
        // Убеждаемся, что обязательные поля имеют значения
        id: order.id || 0,
        status: order.status || 'pending',
        payment_status: order.payment_status || 'pending',
        payment_method: order.payment_method || 'cash',
        total_amount: typeof order.total_amount === 'number' ? order.total_amount : 
                     (typeof order.total_amount === 'string' ? parseFloat(order.total_amount) : 0),
        created_at: order.created_at || new Date().toISOString(),
        // Обрабатываем массив товаров
        items: Array.isArray(order.items) ? order.items.map((item: any) => ({
          dish_id: item.dish_id || 0,
          quantity: item.quantity || 1,
          price: typeof item.price === 'number' ? item.price : 
                (typeof item.price === 'string' ? parseFloat(item.price) : 0),
          name: item.name || item.dish_name || 'Неизвестное блюдо'
        })) : []
      }));
      
      console.log('API: Нормализованные заказы:', { count: normalizedOrders.length });
      return normalizedOrders;
    } catch (error: any) {
      // Очищаем таймер в случае ошибки
      clearTimeout(timeoutId);
      
      // Если ошибка связана с отменой запроса, логируем специальное сообщение
      if (error.name === 'AbortError') {
        console.warn('API: Запрос заказов был отменен из-за таймаута');
        return [];
      }
      
      console.error('API: Ошибка при запросе заказов:', error.message);
      return [];
    }
  },
  
  // Получение заказов, назначенных текущему официанту
  getWaiterOrders: async (): Promise<Order[]> => {
    try {
      console.log('API: Запрос заказов для текущего официанта');
      
      // Получаем токен для авторизации
      const getToken = () => {
        try {
          if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('token');
          }
          return null;
        } catch (e) {
          console.error('API: Ошибка при получении токена:', e);
          return null;
        }
      };
      
      const token = getToken();
      
      // Пробуем через основной API
      try {
        console.log('API: Пробуем получить заказы через api.get');
        const response = await api.get('/waiter/orders', {
          headers: {
            'X-User-Role': 'waiter'
          }
        });
        return response.data;
      } catch (apiError: any) {
        console.error('API: Ошибка при вызове основного API для заказов официанта:', apiError);
        return [];
      }
    } catch (error: any) {
      console.error('API: Общая ошибка при получении заказов официанта:', error);
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
      console.log(`API: Запрос заказа #${id}`);
      
      // Получаем токен для запроса
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      // Используем локальный API-прокси вместо прямого обращения к бэкенду
      const response = await fetch(`/api/orders/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Ошибка при получении заказа ${id}`);
      }

      const data = await response.json();
      console.log(`API: Получены данные заказа #${id}:`, data);
      return data;
    } catch (error: any) {
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
  },

  // Привязка заказа к официанту по коду
  assignOrderByCode: async (code: string): Promise<AssignOrderResponse> => {
    try {
      console.log('API: Привязка заказа по коду:', code);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await fetch('/api/waiter/orders/bind', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-Role': 'waiter'
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: error.message || 'Не удалось привязать заказ'
        };
      }

      const data = await response.json();
      return {
        success: true,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        message: 'Заказ успешно привязан'
      };
    } catch (error: any) {
      console.error('API: Ошибка при привязке заказа:', error);
      return {
        success: false,
        message: error.message || 'Произошла ошибка при привязке заказа'
      };
    }
  },

  // Обновление статуса оплаты заказа
  updateOrderPaymentStatus: async (id: number, status: PaymentStatus): Promise<{ success: boolean; order: Order }> => {
    try {
      console.log(`API: Обновление статуса оплаты заказа ${id} на ${status}`);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await fetch(`/api/orders/${id}/payment-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-User-Role': 'waiter'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Ошибка при обновлении статуса оплаты заказа ${id}`);
      }

      const data = await response.json();
      return {
        success: true,
        order: data
      };
    } catch (error: any) {
      console.error(`API: Ошибка при обновлении статуса оплаты заказа ${id}:`, error);
      throw error;
    }
  },

  // Принудительное отключение демо-данных
  disableDemoData: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('force_demo_data');
        console.log('API: Демо-режим отключен');
      }
    } catch (e) {
      console.error('API: Ошибка при отключении демо-режима:', e);
    }
  },

  // Получение демо-данных заказов
  getDemoOrders: () => {
    console.warn('API: Функция getDemoOrders устарела и будет удалена в следующей версии');
    return [];
  }
};

// Добавим функцию для генерации демо-заказов официанта
function generateWaiterDemoOrders(): Order[] {
  return [
    {
      id: 1001,
      user_id: 1,
      waiter_id: 1,
      status: 'confirmed',
      payment_status: 'unpaid',
      payment_method: 'cash',
      order_type: 'dine-in',
      total_amount: 3200,
      total_price: 3200,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          dish_id: 2,
          quantity: 2,
          price: 1600,
          name: 'Стейк'
        }
      ],
      table_number: 3,
      customer_name: 'Иван Петров',
      customer_phone: '+7 (700) 111-22-33'
    },
    {
      id: 1002,
      user_id: 2,
      waiter_id: 1,
      status: 'preparing',
      payment_status: 'unpaid',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 1800,
      total_price: 1800,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          dish_id: 3,
          quantity: 1,
          price: 1800,
          name: 'Паста'
        }
      ],
      table_number: 7,
      customer_name: 'Мария Сидорова',
      customer_phone: '+7 (700) 222-33-44'
    }
  ];
}

// Функция для генерации демо-данных заказов для админки
function generateAdminOrdersDemoData(): Order[] {
  const now = new Date();
  
  // Генерируем дату в прошлом со случайным смещением (до 10 дней назад)
  const getRandomPastDate = () => {
    const date = new Date(now);
    const randomDaysBack = Math.floor(Math.random() * 10) + 1;
    date.setDate(date.getDate() - randomDaysBack);
    return date.toISOString();
  };
  
  // Создаем случайный набор заказов
  return [
    {
      id: 1001,
      user_id: 1,
      waiter_id: 1,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 3500,
      created_at: getRandomPastDate(),
      updated_at: getRandomPastDate(),
      items: [
        {
          dish_id: 1,
          quantity: 2,
          price: 1200,
          name: 'Стейк из говядины'
        },
        {
          dish_id: 2,
          quantity: 1,
          price: 1100,
          name: 'Паста Карбонара'
        }
      ],
      table_number: 5,
      customer_name: 'Александр Иванов',
      customer_phone: '+7 (777) 111-22-33'
    },
    {
      id: 1002,
      user_id: 2,
      waiter_id: 2,
      status: 'confirmed',
      payment_status: 'pending',
      payment_method: 'cash',
      order_type: 'dine-in',
      total_amount: 2800,
      created_at: getRandomPastDate(),
      updated_at: getRandomPastDate(),
      items: [
        {
          dish_id: 3,
          quantity: 1,
          price: 1500,
          name: 'Сёмга на гриле'
        },
        {
          dish_id: 4,
          quantity: 2,
          price: 650,
          name: 'Салат Цезарь'
        }
      ],
      table_number: 3,
      customer_name: 'Елена Петрова',
      customer_phone: '+7 (777) 222-33-44'
    },
    {
      id: 1003,
      user_id: 3,
      waiter_id: 1,
      status: 'preparing',
      payment_status: 'paid',
      payment_method: 'card',
      order_type: 'dine-in',
      total_amount: 4200,
      created_at: getRandomPastDate(),
      updated_at: getRandomPastDate(),
      items: [
        {
          dish_id: 5,
          quantity: 1,
          price: 2500,
          name: 'Стейк Рибай'
        },
        {
          dish_id: 6,
          quantity: 1,
          price: 900,
          name: 'Тирамису'
        },
        {
          dish_id: 7,
          quantity: 1,
          price: 800,
          name: 'Вино красное (бокал)'
        }
      ],
      table_number: 9,
      customer_name: 'Дмитрий Сидоров',
      customer_phone: '+7 (777) 333-44-55'
    },
    {
      id: 1004,
      user_id: 4,
      waiter_id: 3,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'card',
      order_type: 'delivery',
      total_amount: 3100,
      created_at: getRandomPastDate(),
      updated_at: getRandomPastDate(),
      items: [
        {
          dish_id: 8,
          quantity: 1,
          price: 1800,
          name: 'Пицца Маргарита'
        },
        {
          dish_id: 9,
          quantity: 1,
          price: 1300,
          name: 'Суши-сет Филадельфия'
        }
      ],
      customer_name: 'Андрей Кузнецов',
      customer_phone: '+7 (777) 444-55-66',
      delivery_address: 'ул. Абая 44, кв. 12'
    },
    {
      id: 1005,
      user_id: 5,
      waiter_id: undefined,
      status: 'cancelled',
      payment_status: 'refunded',
      payment_method: 'card',
      order_type: 'pickup',
      total_amount: 2400,
      created_at: getRandomPastDate(),
      updated_at: getRandomPastDate(),
      items: [
        {
          dish_id: 10,
          quantity: 2,
          price: 1200,
          name: 'Бургер с говядиной'
        }
      ],
      customer_name: 'Наталья Смирнова',
      customer_phone: '+7 (777) 555-66-77'
    }
  ];
}