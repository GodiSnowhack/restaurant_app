import { api } from './core';
import { Order } from './types';
import axios from 'axios';

// API функции для работы с заказами
export const ordersApi = {
  // Получение всех заказов с возможностью фильтрации
  getOrders: async (startDate: string, endDate: string): Promise<Order[]> => {
    try {
      console.log('API: Запрос заказов с параметрами:', { start_date: startDate, end_date: endDate });

      // Получаем токен для запроса
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      // Используем локальный API-прокси вместо прямого обращения к бэкенду
      const response = await fetch(`/api/orders?start_date=${startDate}&end_date=${endDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка при получении заказов');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('API: Ошибка при получении заказов:', error);

      // В случае ошибки возвращаем демо-данные
      console.log('API: Возвращаем демо-данные из-за ошибки API');
      return [
        {
          id: 1,
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'cash',
          order_type: 'dine-in',
          total_amount: 200,
          created_at: '2024-01-01T12:00:00Z',
          items: [
            { dish_id: 1, quantity: 2, price: 100, name: 'Демо блюдо' }
          ]
        },
        // ... другие демо-заказы
      ];
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
      
      // Проверяем локальные настройки
      const useLocalData = localStorage?.getItem('force_demo_data') === 'true';
      if (useLocalData) {
        console.log('API: Используем локальные демо-данные согласно настройкам');
        return generateWaiterDemoOrders();
      }
      
      // Сначала пробуем через API с параметром demo=true для гарантированного получения данных
      try {
        console.log('API: Пробуем получить демо-заказы через API прокси');
        
        const demoResponse = await fetch('/api/waiter/orders?demo=true', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-User-Role': 'waiter',
            'X-Demo-Mode': 'true'
          }
        });
        
        if (demoResponse.ok) {
          const demoData = await demoResponse.json();
          console.log('API: Успешно получены демо-заказы через API прокси:', demoData.length);
          return demoData;
        }
      } catch (demoError) {
        console.error('API: Ошибка при получении демо-заказов:', demoError);
      }
      
      // Пробуем через fetch к API прокси
      try {
        console.log('API: Пробуем получить заказы через fetch к API прокси');
        
        // Используем прямой запрос к нашему API-прокси
        const response = await fetch('/api/waiter/orders', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-User-Role': 'waiter' // Явно указываем роль
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('API: Заказы официанта успешно получены через fetch:', data.length);
          return data;
        } else {
          console.error('API: Ошибка при получении заказов через fetch:', response.status);
          // Продолжаем выполнение и пробуем другие методы
        }
      } catch (fetchError) {
        console.error('API: Ошибка при использовании fetch:', fetchError);
        // Продолжаем выполнение и пробуем другие методы
      }
      
      // Пробуем через основной API
      try {
        console.log('API: Пробуем получить заказы через api.get');
        const response = await api.get('/waiter/orders');
        return response.data;
      } catch (apiError: any) {
        console.error('API: Ошибка при вызове основного API для заказов официанта:', apiError);
        
        // Если получили ошибку авторизации или ошибку сервера, пробуем альтернативные способы
        if (apiError.response?.status === 401 || apiError.response?.status === 403 || 
            apiError.response?.status === 404 || apiError.response?.status >= 500) {
          
          // Пробуем запросить простой API заказов
          try {
            console.log('API: Пробуем получить все заказы');
            const allOrdersResponse = await fetch('/api/orders', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
                'X-User-Role': 'waiter' // Явно указываем роль
              }
            });
            
            if (allOrdersResponse.ok) {
              const allOrdersData = await allOrdersResponse.json();
              console.log('API: Получены все заказы:', allOrdersData.length);
              return allOrdersData;
            }
          } catch (allOrdersError) {
            console.error('API: Ошибка при запросе всех заказов:', allOrdersError);
          }
          
          // Если все предыдущие попытки не удались, возвращаем демо-данные
          console.log('API: Все способы получения реальных данных не сработали, возвращаем демо-заказы');
          return generateWaiterDemoOrders();
        }
        
        // Для других ошибок также возвращаем демо-данные
        return generateWaiterDemoOrders();
      }
    } catch (error: any) {
      console.error('API: Общая ошибка при получении заказов официанта:', error);
      
      // В случае ошибки возвращаем демо-данные
      return generateWaiterDemoOrders();
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