import axios from 'axios';
import { IOrder, IOrderCreate, IOrderItem, IOrderUpdate } from '../types/order';
import { getDefaultApiUrl } from '../config/defaults';
import { formatDateToISO } from '../utils/date';

// Настройка базового axios инстанса для работы с API заказов
const ordersApi = axios.create({
  baseURL: `${getDefaultApiUrl()}`
});

// Добавляем перехватчик для установки заголовков авторизации
ordersApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (userId) {
    config.headers['X-User-ID'] = userId;
  }
  
  if (userRole) {
    config.headers['X-User-Role'] = userRole;
  }
  
  return config;
});

// API-методы для работы с заказами
export const OrdersAPI = {
  // Получить список заказов с фильтрацией
  async getOrders(params: {
    start_date?: string | Date;
    end_date?: string | Date;
    status?: string;
    user_id?: number;
  } = {}): Promise<IOrder[]> {
    console.log('API: Запрос заказов с параметрами:', params);
    
    // Форматируем даты в ISO формат, если они переданы
    const queryParams: Record<string, string | number> = {};
    
    if (params.start_date) {
      queryParams.start_date = typeof params.start_date === 'string' 
        ? params.start_date
        : formatDateToISO(params.start_date);
    }
    
    if (params.end_date) {
      queryParams.end_date = typeof params.end_date === 'string'
        ? params.end_date
        : formatDateToISO(params.end_date);
    }
    
    if (params.status) {
      queryParams.status = params.status;
    }
    
    if (params.user_id) {
      queryParams.user_id = params.user_id;
    }
    
    try {
      // Прямой запрос к API бэкенда
      const directApiUrl = `/api/v1/orders`;
      console.log(`API: Отправка запроса к: ${directApiUrl}`);
      
      const response = await ordersApi.get(directApiUrl, {
        params: queryParams,
        timeout: 15000
      });
      
      console.log('API: Получены данные заказов:', { count: response.data.length });
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении заказов:', error);
      
      // Запасной вариант - запрос к локальному API прокси
      try {
        const localApiUrl = `/api/orders`;
        console.log(`API: Пробуем локальный API прокси: ${localApiUrl}`);
        
        const localResponse = await axios.get(localApiUrl, {
          params: queryParams,
          timeout: 15000
        });
        
        console.log('API: Получены данные заказов через локальный прокси:', { count: localResponse.data.length });
        return localResponse.data;
      } catch (localError) {
        console.error('API: Ошибка при получении заказов через локальный прокси:', localError);
        throw error;
      }
    }
  },
  
  // Получить заказ по ID
  async getOrderById(id: number): Promise<IOrder> {
    try {
      const response = await ordersApi.get(`/api/v1/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении заказа с ID ${id}:`, error);
      
      // Запасной вариант - запрос к локальному API прокси
      try {
        const localResponse = await axios.get(`/api/orders/${id}`);
        return localResponse.data;
      } catch (localError) {
        console.error(`API: Ошибка при получении заказа с ID ${id} через локальный прокси:`, localError);
        throw error;
      }
    }
  },
  
  // Создать новый заказ
  async createOrder(orderData: IOrderCreate): Promise<{ id: number; message: string }> {
    try {
      const response = await ordersApi.post('/api/v1/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при создании заказа:', error);
      
      // Запасной вариант - запрос к локальному API прокси
      try {
        const localResponse = await axios.post('/api/orders', orderData);
        return localResponse.data;
      } catch (localError) {
        console.error('API: Ошибка при создании заказа через локальный прокси:', localError);
        throw error;
      }
    }
  },
  
  // Обновить заказ
  async updateOrder(id: number, orderData: IOrderUpdate): Promise<IOrder> {
    try {
      const response = await ordersApi.patch(`/api/v1/orders/${id}`, orderData);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обновлении заказа с ID ${id}:`, error);
      
      // Запасной вариант - запрос к локальному API прокси
      try {
        const localResponse = await axios.patch(`/api/orders/${id}`, orderData);
        return localResponse.data;
      } catch (localError) {
        console.error(`API: Ошибка при обновлении заказа с ID ${id} через локальный прокси:`, localError);
        throw error;
      }
    }
  },
  
  // Удалить заказ
  async deleteOrder(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await ordersApi.delete(`/api/v1/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при удалении заказа с ID ${id}:`, error);
      
      // Запасной вариант - запрос к локальному API прокси
      try {
        const localResponse = await axios.delete(`/api/orders/${id}`);
        return localResponse.data;
      } catch (localError) {
        console.error(`API: Ошибка при удалении заказа с ID ${id} через локальный прокси:`, localError);
        throw error;
      }
    }
  }
}; 