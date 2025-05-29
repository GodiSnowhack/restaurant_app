import { api } from './core';
import { Order, AssignOrderResponse, PaymentStatus } from './types';
import { getDefaultApiUrl } from '../../src/config/defaults';
import axios from 'axios';

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

// Вспомогательная функция для получения токена из localStorage с обработкой ошибок
const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    console.error('Ошибка при получении токена из localStorage:', error);
    return null;
  }
};

// Вспомогательная функция для получения данных из JWT токена
const extractUserDataFromToken = (token: string): { id?: string, role?: string } => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const { sub, role } = JSON.parse(jsonPayload);
    return { id: sub, role };
  } catch (error) {
    console.error('Ошибка при извлечении данных из токена:', error);
    return {};
  }
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
      // Проверяем режим демо-данных
      let isDemoMode = false;
      try {
        isDemoMode = localStorage.getItem('admin_use_demo_data') === 'true';
        console.log('API: Режим демо-данных', isDemoMode ? 'включен' : 'отключен');
      } catch (e) {
        console.error('API: Ошибка при проверке режима демо-данных:', e);
      }
      
      // Возвращаем демо-данные, если режим включен
      if (isDemoMode) {
        console.log('API: Возвращаем демо-данные заказов');
        return getDemoOrders(params?.status);
      }
      
      // Получаем токен авторизации
      const token = getAuthToken();
      if (!token) {
        console.error('API: Отсутствует токен авторизации. Возвращаем пустой список заказов.');
        return [];
      }
      
      // Форматируем даты для вывода в лог
      const startDateStr = params?.start_date ? new Date(params.start_date).toLocaleDateString() : 'не указана';
      const endDateStr = params?.end_date ? new Date(params.end_date).toLocaleDateString() : 'не указана';
      console.log(`API: Запрос заказов с ${startDateStr} по ${endDateStr}`);
      
      // Получаем данные пользователя из токена
      const userData = extractUserDataFromToken(token);
      console.log('API: Данные пользователя из токена:', userData);
      
      // Собираем параметры запроса
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.user_id) queryParams.append('user_id', params.user_id.toString());
      if (params?.start_date) queryParams.append('start_date', params.start_date);
      if (params?.end_date) queryParams.append('end_date', params.end_date);
      
      // Формируем URL для запроса через API-прокси
      let url = '/api/orders';
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      console.log(`API: Выполняем запрос заказов по URL: ${url}`);
      
      // Настраиваем заголовки запроса
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Добавляем дополнительные заголовки для идентификации пользователя
      if (userData.id) headers['X-User-ID'] = userData.id;
      if (userData.role) headers['X-User-Role'] = userData.role;
      
      // Выполняем запрос с максимальной отказоустойчивостью
      const maxRetries = 3;
      let lastError = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Отправляем запрос с таймаутом 10 секунд
          const response = await fetch(url, {
            method: 'GET',
            headers,
            credentials: 'include',
            cache: 'no-cache', // Отключаем кэширование
            signal: AbortSignal.timeout(10000) // 10 секунд таймаут
          });
          
          // Если статус не успешный, пробуем другой метод
          if (!response.ok) {
            console.warn(`API: Ошибка при получении заказов (попытка ${attempt + 1}/${maxRetries}): ${response.status} ${response.statusText}`);
            
            if (response.status === 401 || response.status === 403) {
              console.error('API: Ошибка авторизации при получении заказов');
              return [];
            }
            
            // На последней попытке возвращаем демо-данные при ошибке
            if (attempt === maxRetries - 1) {
              console.warn('API: Не удалось получить данные с сервера, возвращаем демо-данные');
              return getDemoOrders(params?.status);
            }
            
            // Ждем перед следующей попыткой (экспоненциальная выдержка)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }
          
          // Обрабатываем успешный ответ
          const data = await response.json();
          console.log(`API: Успешно получены данные заказов (${Array.isArray(data) ? data.length : 0} записей)`);
          
          // Проверяем структуру данных
          if (!Array.isArray(data)) {
            console.warn('API: Получены некорректные данные (не массив):', data);
            return [];
          }
          
          // Нормализуем данные заказов
          const normalizedOrders = data.map(order => ({
            ...order,
            // Убеждаемся, что важные поля имеют значения по умолчанию
            id: order.id || 0,
            status: order.status || 'pending',
            payment_status: order.payment_status || 'pending',
            total_amount: typeof order.total_amount === 'number' ? order.total_amount : 
                        (typeof order.total_amount === 'string' ? parseFloat(order.total_amount) : 0),
            total_price: typeof order.total_price === 'number' ? order.total_price : 
                        (typeof order.total_price === 'string' ? parseFloat(order.total_price) : 0),
            created_at: order.created_at || new Date().toISOString(),
            items: Array.isArray(order.items) ? order.items : []
          }));
          
          return normalizedOrders;
        } catch (error) {
          lastError = error;
          console.error(`API: Ошибка при получении заказов (попытка ${attempt + 1}/${maxRetries}):`, error);
          
          // Ждем перед следующей попыткой
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
      
      // Если все попытки не удались, возвращаем демо-данные
      console.warn('API: Все попытки получения заказов не удались, возвращаем демо-данные');
      return getDemoOrders(params?.status);
    } catch (error) {
      console.error('API: Критическая ошибка при получении заказов:', error);
      return getDemoOrders(params?.status);
    }
  },
  
  // Получение заказа по ID
  getOrderById: async (id: number): Promise<Order | null> => {
    try {
      console.log(`API: Запрос заказа #${id}`);
      
      // Проверяем режим демо-данных
      let isDemoMode = false;
      try {
        isDemoMode = localStorage.getItem('admin_use_demo_data') === 'true';
      } catch (e) {
        console.error('API: Ошибка при проверке режима демо-данных:', e);
      }
      
      // Возвращаем демо-данные, если режим включен
      if (isDemoMode) {
        const demoOrders = getDemoOrders();
        const demoOrder = demoOrders.find(order => order.id === id);
        if (demoOrder) {
          return demoOrder;
        }
      }
      
      // Получаем токен для запроса
      const token = getAuthToken();
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
      
      // Отправляем запрос через основной API
      const response = await api.post('/orders', order);
      console.log('API: Заказ успешно создан через API, ID:', response.data.id);
      return response.data;
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
  
  // Обновление статуса оплаты заказа
  updateOrderPaymentStatus: async (id: number, status: PaymentStatus): Promise<Order> => {
    try {
      const response = await api.put(`/orders/${id}/payment-status`, { payment_status: status });
      console.log(`API: Статус оплаты заказа ${id} успешно обновлен на ${status}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обновлении статуса оплаты заказа ${id}:`, error);
      throw error;
    }
  },
  
  // Назначение заказа официанту
  assignOrder: async (orderId: number, waiterId: number): Promise<AssignOrderResponse> => {
    try {
      const response = await api.post(`/orders/${orderId}/assign`, { waiter_id: waiterId });
      console.log(`API: Заказ ${orderId} успешно назначен официанту ${waiterId}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при назначении заказа ${orderId} официанту ${waiterId}:`, error);
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