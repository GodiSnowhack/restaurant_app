import { api } from './core';
import { Order, AssignOrderResponse, PaymentStatus } from './types';

// Функция для создания тестовых данных заказов
const getDemoOrders = (status?: string): Order[] => {
  // Базовый список заказов для тестирования
  const demoOrders: Order[] = [
    {
      id: 1001,
      user_id: 1,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method: 'cash',
      order_type: 'dine_in',
      table_number: 5,
      total_amount: 3500,
      total_price: 3500,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      customer_name: 'Иван Петров',
      customer_phone: '+7 (999) 123-45-67',
      is_urgent: true,
      order_code: 'ORD-1001',
      items: [
        {
          id: 1,
          dish_id: 101,
          name: 'Борщ',
          quantity: 2,
          price: 500,
          total_price: 1000,
          special_instructions: 'Без сметаны'
        },
        {
          id: 2,
          dish_id: 102,
          name: 'Стейк Рибай',
          quantity: 1,
          price: 2500,
          total_price: 2500
        }
      ]
    },
    {
      id: 1002,
      user_id: 2,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'card',
      order_type: 'delivery',
      total_amount: 1800,
      total_price: 1800,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
      customer_name: 'Анна Сидорова',
      customer_phone: '+7 (999) 987-65-43',
      delivery_address: 'ул. Ленина, д. 10, кв. 5',
      order_code: 'ORD-1002',
      items: [
        {
          id: 3,
          dish_id: 103,
          name: 'Пицца Маргарита',
          quantity: 1,
          price: 800,
          total_price: 800
        },
        {
          id: 4,
          dish_id: 104,
          name: 'Тирамису',
          quantity: 2,
          price: 500,
          total_price: 1000
        }
      ]
    },
    {
      id: 1003,
      user_id: 1,
      status: 'processing',
      payment_status: 'unpaid',
      payment_method: 'cash',
      order_type: 'pickup',
      total_amount: 2200,
      total_price: 2200,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      customer_name: 'Иван Петров',
      customer_phone: '+7 (999) 123-45-67',
      order_code: 'ORD-1003',
      items: [
        {
          id: 5,
          dish_id: 105,
          name: 'Суши-сет "Филадельфия"',
          quantity: 1,
          price: 1500,
          total_price: 1500
        },
        {
          id: 6,
          dish_id: 106,
          name: 'Мисо-суп',
          quantity: 2,
          price: 350,
          total_price: 700
        }
      ]
    }
  ];

  // Если указан статус, фильтруем заказы
  if (status) {
    return demoOrders.filter(order => order.status === status);
  }

  return demoOrders;
};

// API функции для работы с заказами
export const ordersApi = {
  // Получение всех заказов с возможностью фильтрации
  getAllOrders: async (params?: { 
    status?: string, 
    user_id?: number, 
    start_date?: string, 
    end_date?: string 
  }): Promise<Order[]> => {
    try {
      // Проверяем демо-режим
      const isDemoMode = localStorage.getItem('admin_use_demo_data') === 'true';
      if (isDemoMode) {
        console.log('Режим демо-данных включен');
        return getDemoOrders(params?.status);
      }
      
      console.log('Режим демо-данных отключен');
      
      // Формируем параметры запроса
      let url = '/api/orders';
      const queryParams: string[] = [];
      
      if (params) {
        if (params.status) queryParams.push(`status=${params.status}`);
        if (params.user_id) queryParams.push(`user_id=${params.user_id}`);
        if (params.start_date) queryParams.push(`start_date=${params.start_date}`);
        if (params.end_date) queryParams.push(`end_date=${params.end_date}`);
      }
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      // Принудительно запрашиваем демо-данные через параметр
      url += url.includes('?') ? '&force_demo=true' : '?force_demo=true';

      // Получаем токен для авторизации
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Отсутствует токен авторизации');
        return getDemoOrders(params?.status);
      }
      
      // Формируем заголовки запроса с добавлением токена
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      console.log(`Запрос заказов с параметрами:`, params);
      console.log(`URL запроса: ${url}`);
      
      // Делаем запрос к API через прокси с коротким таймаутом
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include',
          signal: AbortSignal.timeout(5000) // 5 секунд таймаут
        });
        
        // Даже при ошибке ответа пытаемся получить данные
        const data = await response.json().catch(() => []);
        
        // Проверяем, есть ли данные
        if (Array.isArray(data) && data.length > 0) {
          console.log('Получены данные с сервера, количество:', data.length);
          return data;
        } else {
          console.log('Сервер вернул пустой массив или некорректные данные, возвращаем демо-данные');
          return getDemoOrders(params?.status);
        }
      } catch (fetchError) {
        console.error('Ошибка при запросе данных:', fetchError);
        return getDemoOrders(params?.status);
      }
    } catch (error: any) {
      console.error('Общая ошибка при получении заказов:', error);
      return getDemoOrders(params?.status);
    }
  },
  
  // Получение заказов, назначенных текущему официанту
  getWaiterOrders: async (): Promise<Order[]> => {
    try {
      console.log('API: Запрос заказов для текущего официанта');
      
      // Получаем токен для авторизации
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('API: Отсутствует токен авторизации');
        return [];
      }
      
      // Пробуем через API-прокси
      try {
        const response = await fetch('/api/waiter/orders', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-User-Role': 'waiter'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (apiError: any) {
        console.error('API: Ошибка при запросе заказов официанта:', apiError.message);
        
        // Если прокси недоступен, используем основной API
        try {
          const apiResponse = await api.get('/waiter/orders', {
            headers: {
              'X-User-Role': 'waiter'
            }
          });
          return apiResponse.data || [];
        } catch (error) {
          console.error('API: Все попытки получить заказы официанта не удались');
          return [];
        }
      }
    } catch (error: any) {
      console.error('API: Общая ошибка при получении заказов официанта:', error);
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

      // Отправляем запрос через локальный API-прокси
      const response = await fetch(`/api/orders/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      // Если ответ не успешный, возвращаем null
      if (!response.ok) {
        console.error(`API: Ошибка при получении заказа ${id}: ${response.status}`);
        return null;
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
      console.log('API: Создание заказа с данными:', order);
      
      // Получаем токен для запроса
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }
      
      // Пробуем сначала через локальный API-прокси
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(order)
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API: Заказ успешно создан через API-прокси, ID:', data.id);
        return data;
      } catch (proxyError: any) {
        console.error('API: Ошибка при создании заказа через API-прокси:', proxyError.message);
        console.log('API: Пробуем создать заказ через основной API...');
        
        // Если прокси не сработал, пробуем через основной API
        const response = await api.post('/orders', order);
        console.log('API: Заказ успешно создан через основной API, ID:', response.data.id);
        return response.data;
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

      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          message: data.message || 'Не удалось привязать заказ'
        };
      }

      return {
        success: true,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        message: data.message || 'Заказ успешно привязан'
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

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || `Ошибка при обновлении статуса оплаты заказа ${id}`);
      }

      return data;
    } catch (error: any) {
      console.error(`API: Ошибка при обновлении статуса оплаты заказа ${id}:`, error);
      throw error;
    }
  }
};

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