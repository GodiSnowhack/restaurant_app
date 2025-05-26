import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosHeaders } from 'axios';
// Импортируем модуль API бронирований
import { reservationsApi } from './api/reservations-api';
// Импортируем API для заказов и админ-панели
import { ordersApi } from './api/orders';
import adminApi from './api/admin-api';
// Импортируем список публичных маршрутов
import { PUBLIC_ROUTES } from '../pages/_app';
import { getWaiterRating, getWaiterReviews } from './api/waiter-api';
import { settingsApi } from '@/lib/api/settings-api';
// Импортируем menuApi из правильного файла
import { menuApi } from './api/menu';
import { getSecureApiUrl, ensureSecureUrl } from './utils/api';

// Интерфейс для типа пользователя
export interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  orders_count?: number;
  reservations_count?: number;
}

// Функция для определения правильного baseURL для API
export const getApiBaseUrl = () => {
  const baseUrl = getSecureApiUrl();
  return baseUrl.startsWith('https://') ? baseUrl : baseUrl.replace('http://', 'https://');
};

const baseURL = getApiBaseUrl();
const API_URL = baseURL;

// Создаем axios инстанс с настройками
export const api = axios.create({
  baseURL: 'https://backend-production-1a78.up.railway.app/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Forwarded-Proto': 'https'
  },
  withCredentials: true,
  timeout: 30000,
  maxRedirects: 0
});

// Добавляем интерфейс для расширенной конфигурации
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean;
}

// Функция повторных попыток для критически важных API-вызовов
export const retryRequest = async <T>(apiCall: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      console.log(`Попытка ${i + 1} из ${maxRetries} не удалась:`, error);
      lastError = error;
      
      // Ожидаем перед следующей попыткой с увеличением времени ожидания (экспоненциальная выдержка)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};

// Проверка, не истёк ли токен
const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const { exp } = JSON.parse(jsonPayload);
    const expired = Date.now() >= exp * 1000;
    
    return expired;
  } catch (e) {
    console.error('Ошибка при декодировании токена:', e);
    return true; // Если ошибка при декодировании, считаем что токен истёк для безопасности
  }
};

// Функция получения токена из любого доступного хранилища
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
};

// Interceptor для запросов
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token) {
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor для ответов
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// API функции для аутентификации
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        sessionStorage.setItem('token', response.data.access_token);
      }
      return response.data;
    } catch (error) {
      console.error('Ошибка при входе:', error);
      throw error;
    }
  },

  register: async (data: any) => {
    try {
      const response = await api.post('/auth/register', data);
      return response.data;
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user_profile');
  },

  getProfile: async () => {
    try {
      // Проверяем наличие кэшированного профиля
      const cachedProfile = localStorage.getItem('user_profile');
      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }

      const response = await api.get('/users/me');
      const profile = response.data;

      // Кэшируем профиль
      if (profile) {
        localStorage.setItem('user_profile', JSON.stringify(profile));
      }

      return profile;
    } catch (error) {
      console.error('Ошибка при получении профиля:', error);
      
      // В случае ошибки пробуем использовать кэшированный профиль
      const cachedProfile = localStorage.getItem('user_profile');
      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }
      
      throw error;
    }
  }
};

// Улучшенная функция для определения мобильного устройства
export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Проверка на мобильное устройство по User-Agent
  const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i;
  const userAgent = navigator.userAgent || '';
  
  // Дополнительная проверка через mediaQuery для лучшего определения
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;
  
  console.log('Проверка устройства:', {
    userAgent,
    isMobileByUA: mobileRegex.test(userAgent),
    isTouchDevice,
    isSmallScreen,
    innerWidth: window.innerWidth
  });
  
  return mobileRegex.test(userAgent) || (isTouchDevice && isSmallScreen);
};

// Улучшенная функция для проверки соединения
export const checkConnection = async (
  options?: { silent?: boolean; url?: string }
): Promise<{ isOnline: boolean; pingTime?: number; error?: string }> => {
  const url = options?.url || '/api/ping';
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    
    if (!response.ok) {
    return { 
        isOnline: false,
        error: `Ошибка соединения: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    const pingTime = Date.now() - startTime;
    
    if (data?.status === 'ok') {
      return { isOnline: true, pingTime };
    } else {
      return {
        isOnline: false,
        error: 'Неверный ответ от сервера',
    };
    }
  } catch (error: any) {
    if (!options?.silent) {
    console.error('Ошибка при проверке соединения:', error);
    }
    
    return { 
      isOnline: false, 
      error: error.message || 'Не удалось подключиться к серверу',
    };
  }
};

// Определения для admin-api.ts
export class ApiError extends Error {
  status: number;
  
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export const handleApiResponse = async (response: Response) => {
    if (!response.ok) {
      const errorText = await response.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorJson.message || 'Ошибка запроса';
    } catch {
      errorMessage = errorText || `Ошибка HTTP: ${response.status}`;
    }
    throw new ApiError(response.status, errorMessage);
  }
  return await response.json();
};

export const getBaseApiOptions = (method: string, body?: any) => {
  const options: RequestInit = {
    method,
        headers: {
          'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    credentials: 'include' // Для поддержки авторизации с помощью куки
  };

  // Добавляем токен авторизации, если он есть
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    options.headers = {
      ...options.headers,
          'Authorization': `Bearer ${token}`
    };
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
};

export {  settingsApi};

export const getOrderReviewStatus = async (orderId: number): Promise<any> => {
  try {
    const response = await api.get(`/reviews/order/${orderId}/status`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting order review status:', error);
    throw error;
  }
};

export const createOrderReview = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/reviews/order', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating order review:', error);
    throw error;
  }
};

export const createServiceReview = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/reviews/service', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating service review:', error);
    throw error;
  }
};

export const createCombinedReview = async (data: any): Promise<any> => {
  try {
    const response = await api.post('/reviews/combined', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating combined review:', error);
    throw error;
  }
};

// API для работы с пользователями
export const usersApi = {
  getUsers: async () => {
    try {
      const response = await api.get('/users');
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении списка пользователей:', error);
      throw error;
    }
  },

  getUser: async (id: number) => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении пользователя ${id}:`, error);
      throw error;
    }
  },

  updateUser: async (id: number, data: any) => {
    try {
      const response = await api.put(`/users/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Ошибка при обновлении пользователя ${id}:`, error);
      throw error;
    }
  },

  deleteUser: async (id: number) => {
    try {
      const response = await api.delete(`/users/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Ошибка при удалении пользователя ${id}:`, error);
      throw error;
    }
  }
};