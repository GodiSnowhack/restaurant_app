import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosHeaders } from 'axios';
// Импортируем модуль API бронирований
import { reservationsApi } from './api/reservations-api';
// Импортируем API для заказов и админ-панели
import { ordersApi } from './api/orders';
import adminApi from './api/admin-api';
// Импортируем список публичных маршрутов
import { PUBLIC_ROUTES } from '../pages/_app';
import { usersApi } from './api/users-api';
import { getWaiterRating, getWaiterReviews } from './api/waiter-api';
import { settingsApi } from '@/lib/api/settings-api';
// Импортируем menuApi из правильного файла
import { menuApi } from './api/menu';

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
  // Используем URL из переменной окружения, если он задан
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Для production всегда используем основной URL
  return 'https://backend-production-1a78.up.railway.app/api/v1';
};

const baseURL = getApiBaseUrl();
// Используем baseURL как API_URL для унификации
const API_URL = baseURL;

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true, // Включаем отправку куки для поддержки авторизации
  timeout: 60000, // Увеличиваем таймаут для мобильных устройств до 60 секунд
  maxRedirects: 5, // Максимальное количество редиректов
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
  
  try {
    const localToken = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');
    
    // Если есть токен в localStorage, используем его, иначе из sessionStorage
    if (localToken) {
      return localToken;
    } else if (sessionToken) {
      // Если токен есть только в sessionStorage, копируем его в localStorage
      try {
        localStorage.setItem('token', sessionToken);
      } catch (e) {
        console.error('Не удалось скопировать токен из sessionStorage в localStorage:', e);
      }
      return sessionToken;
    }
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
  }
  
  return null;
};

// Interceptor для добавления токена в заголовки
api.interceptors.request.use(
  async (config: ExtendedAxiosRequestConfig) => {
    const token = getAuthToken();
    
    // Проверяем, есть ли токен
    if (token) {
      // Инициализируем заголовки, если их нет
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      
      // Добавляем токен в заголовок авторизации без проверки истечения срока
      config.headers.Authorization = `Bearer ${token}`;
      
      // Также пробуем добавить ID пользователя из токена
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const { sub } = JSON.parse(jsonPayload);
        if (sub) {
          config.headers['X-User-ID'] = sub;
        }
      } catch (e) {
        console.error('Ошибка при добавлении ID пользователя из токена:', e);
      }
    }
    
    // Проверяем, является ли запрос регистрацией
    if (config.url === '/auth/register' && config.method === 'post') {
      // Если это запрос на регистрацию, проверяем, что роль установлена как 'guest'
      if (config.data && typeof config.data === 'object') {
        // Если роль не указана или указана как 'user', устанавливаем её как 'guest'
        if (!config.data.role || config.data.role === 'user') {
          config.data.role = 'guest';
          console.log('API Interceptor: Установлена роль "guest" для запроса регистрации');
        }
      }
    }
    
    // Добавляем интерцептор для логирования запросов
    console.log(`[API] Отправка ${config.method?.toUpperCase()} запроса к ${config.url}`);
    
    return config;
  },
  (error: AxiosError) => {
    console.error('[API] Ошибка при формировании запроса:', error);
    return Promise.reject(error);
  }
);

// Добавляем обработчик ответов для централизованной обработки ошибок
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API] Получен ответ от ${response.config.url}:`, response.status);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as ExtendedAxiosRequestConfig;
    
    // Если это повторный запрос после обновления токена, не пытаемся обновить токен снова
    if (config._isRetry) {
      return Promise.reject(error);
    }
    
    // Если у нас ошибка авторизации (401), попробуем обновить токен
    if (error.response && error.response.status === 401 && config) {
      console.log('API: Получена ошибка 401, пробуем обновить токен');
      
      // Предотвращаем частое обновление токена
      const tokenRefreshKey = 'token_refresh_attempt_timestamp';
      const lastRefreshAttempt = localStorage.getItem(tokenRefreshKey);
      
      if (lastRefreshAttempt) {
        const timeSinceLastRefresh = Date.now() - parseInt(lastRefreshAttempt);
        if (timeSinceLastRefresh < 10000) { // 10 секунд
          console.log(`API: Предотвращение цикла обновления токена (прошло ${Math.round(timeSinceLastRefresh/1000)}с)`);
          // Перенаправляем на страницу входа
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/auth/login';
          }
          return Promise.reject(error);
        }
      }
      
      // Сохраняем временную метку попытки обновления токена
      localStorage.setItem(tokenRefreshKey, Date.now().toString());
      
      try {
        // Пробуем обновить токен
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          // Если нет refresh токена, перенаправляем на страницу входа
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/auth/login';
          }
          return Promise.reject(error);
        }

        console.log('API: Отправляем запрос на обновление токена');
        
        // Отправляем запрос на обновление токена
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          
          if (tokenData.access_token) {
            console.log('API: Токен успешно обновлен, повторяем исходный запрос');
            
            // Сохраняем новый токен
            localStorage.setItem('token', tokenData.access_token);
            
            // Сохраняем новый refresh_token, если он есть
            if (tokenData.refresh_token) {
              localStorage.setItem('refresh_token', tokenData.refresh_token);
            }
            
            // Обновляем заголовок Authorization
            if (config.headers instanceof AxiosHeaders) {
              config.headers.Authorization = `Bearer ${tokenData.access_token}`;
            }
            
            // Помечаем запрос как повторный
            config._isRetry = true;
            
            // Повторяем исходный запрос с новым токеном
            return api(config);
          }
        }
        
        // Если не удалось обновить токен, перенаправляем на страницу входа
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.location.href = '/auth/login';
        }
      } catch (refreshError) {
        console.error('API: Ошибка при обновлении токена:', refreshError);
        // Перенаправляем на страницу входа
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.location.href = '/auth/login';
        }
      }
    }
    
    // Добавляем интерцептор для логирования ответов
    console.error(`[API] Ошибка при запросе к ${error.config?.url}:`, error.response?.status);
    
    // Для всех остальных ошибок просто возвращаем reject
    return Promise.reject(error);
  }
);

// Функция для очистки данных авторизации
const clearAuth = () => {
  console.log('API: Очистка данных авторизации');
  
  try {
    // Сохраняем копии для диагностики
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (token || refreshToken) {
      localStorage.setItem('last_cleared_token', token || '');
      localStorage.setItem('last_cleared_refresh_token', refreshToken || '');
      localStorage.setItem('auth_cleared_timestamp', Date.now().toString());
    }
    
    // Удаляем токены
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    
    // Также сбрасываем состояние
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  } catch (e) {
    console.error('API: Ошибка при очистке данных авторизации:', e);
  }
};

// Типы для API запросов
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  birthday?: string; // в формате YYYY-MM-DD
  age_group?: string; // 'child', 'teenager', 'young', 'adult', 'middle', 'senior'
  created_at: string;
  updated_at: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileUrl: string;
  filename: string;
  originalFilename: string;
  message?: string;
}

export interface DashboardStats {
  ordersToday: number;
  ordersTotal: number;
  revenue: number;
  reservationsToday: number;
  users: number;
  dishes: number;
}

export interface WorkingHoursItem {
  open: string;
  close: string;
  is_closed: boolean;
}

export interface WorkingHours {
  monday: WorkingHoursItem;
  tuesday: WorkingHoursItem;
  wednesday: WorkingHoursItem;
  thursday: WorkingHoursItem;
  friday: WorkingHoursItem;
  saturday: WorkingHoursItem;
  sunday: WorkingHoursItem;
}

export interface RestaurantTable {
  id?: number;
  number: number;
  capacity: number;
  status?: string;
}

export interface RestaurantSettings {
  restaurant_name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  working_hours: WorkingHours;
  currency: string;
  currency_symbol: string;
  tax_percentage: number;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  table_reservation_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  privacy_policy: string;
  terms_of_service: string;
  tables: RestaurantTable[];
}

export interface OrderItem {
  dish_id: number;
  quantity: number;
  price: number;
  name: string;
  special_instructions?: string;
}

export interface Order {
  id?: number;
  user_id?: number;
  waiter_id?: number;
  table_number?: number;
  status: string;
  payment_status: string;
  payment_method: string;
  order_type: string;
  items: OrderItem[];
  total_amount: number;
  special_instructions?: string;
  created_at?: string;
  updated_at?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_address?: string;
}

// Обновление функции logout для очистки обоих хранилищ
const clearAuthTokens = () => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('auth_timestamp');
    localStorage.removeItem('auth_method');
    localStorage.removeItem('user_profile');
  } catch (e) {
    console.error('Ошибка при очистке токенов:', e);
  }
};

// API функции для аутентификации
export const authApi = {
  login: async (credentials: LoginCredentials) => {
    try {
      console.log('API login - Отправка запроса через прокси');
      
      // Добавляем user-agent для отладки
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
      console.log('API login - User Agent:', userAgent);
      
      // Определяем, является ли устройство мобильным
      const isMobile = /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
      console.log('API login - Мобильное устройство:', isMobile);
      
      // Специальная обработка для мобильных устройств - используем прямой запрос к API
      if (isMobile) {
        try {
          console.log('API login - Используем прямой запрос для мобильного устройства');
          
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
          const loginUrl = `${apiUrl}/auth/login`;
          
          console.log('API login - URL для мобильного:', loginUrl);
          
          // Формируем данные для запроса
          const formData = new URLSearchParams();
          formData.append('username', credentials.email);
          formData.append('password', credentials.password);
          
          try {
            console.log('API login - Отправка запроса к:', loginUrl);
            
            // Проверяем подключение к сети
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              throw new Error('Нет подключения к интернету');
            }
            
            // Пробуем через XMLHttpRequest для мобильных устройств (более надежно)
            const xhr = new XMLHttpRequest();
            xhr.open('POST', loginUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.setRequestHeader('User-Agent', userAgent);
            xhr.setRequestHeader('X-User-Agent', userAgent);
            xhr.setRequestHeader('Accept', 'application/json');
            
            // Создаем Promise для обработки XMLHttpRequest
            const mobileData = await new Promise<any>((resolve, reject) => {
              xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                  } catch (e) {
                    reject(new Error('Неверный формат ответа'));
                  }
                } else {
                  reject(new Error(`Ошибка авторизации: ${xhr.status}`));
                }
              };
              
              xhr.onerror = function() {
                reject(new Error('Ошибка сети при авторизации'));
              };
              
              xhr.ontimeout = function() {
                reject(new Error('Таймаут авторизации'));
              };
              
              xhr.timeout = 30000; // 30 секунд таймаут
              xhr.send(formData.toString());
            });
            
            if (mobileData.access_token) {
              console.log('API login - Успешно получен токен через прямой запрос');
              localStorage.setItem('token', mobileData.access_token);
              localStorage.setItem('auth_timestamp', Date.now().toString());
              localStorage.setItem('auth_method', 'direct_mobile');
              
              // Также сохраним в sessionStorage для надежности
              sessionStorage.setItem('token', mobileData.access_token);
              
              return { access_token: mobileData.access_token, token_type: 'bearer' };
            } else {
              console.error('API login - Отсутствует токен в ответе прямого запроса');
              throw new Error('Не удалось получить токен авторизации');
            }
          } catch (mobileError: any) {
            console.error('API login - Ошибка в XMLHttpRequest:', mobileError);
            
            // Пробуем через fetch как запасной вариант
            console.log('API login - Пробуем fetch на мобильном устройстве');
            
            const mobileResponse = await fetch(loginUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': userAgent,
                'X-User-Agent': userAgent,
                'Accept': 'application/json',
              },
              body: formData.toString()
            });
            
            console.log('API login - Прямой fetch, статус:', mobileResponse.status);
            
            if (!mobileResponse.ok) {
              const errorText = await mobileResponse.text();
              console.error('API login - Ошибка прямого fetch запроса:', errorText);
              throw new Error(`Ошибка авторизации: ${mobileResponse.status}`);
            }
            
            const mobileData = await mobileResponse.json();
            
            if (mobileData.access_token) {
              console.log('API login - Успешно получен токен через fetch');
              localStorage.setItem('token', mobileData.access_token);
              localStorage.setItem('auth_timestamp', Date.now().toString());
              localStorage.setItem('auth_method', 'direct_mobile_fetch');
              
              // Также сохраним в sessionStorage для надежности
              sessionStorage.setItem('token', mobileData.access_token);
              
              return { access_token: mobileData.access_token, token_type: 'bearer' };
            } else {
              console.error('API login - Отсутствует токен в ответе fetch');
              throw new Error('Не удалось получить токен авторизации');
            }
          }
        } catch (mobileError: any) {
          console.error('API login - Все попытки на мобильном устройстве не удались:', mobileError);
          
          // Запишем всю доступную информацию для отладки
          try {
            localStorage.setItem('mobile_auth_error', JSON.stringify({
              message: mobileError.message,
              stack: mobileError.stack?.slice(0, 500),
              timestamp: new Date().toISOString(),
              online: navigator.onLine,
              userAgent: navigator.userAgent
            }));
          } catch (e) {
            console.error('Не удалось сохранить ошибку:', e);
          }
          
          // Продолжаем с обычным запросом через прокси как последняя попытка
          console.log('API login - Продолжаем с обычным запросом через прокси');
        }
      }
      
      // Используем fetch с дополнительными опциями для мобильных устройств
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Agent': userAgent,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // Важно для обработки cookies
        mode: 'cors', // Разрешаем CORS запросы
        cache: 'no-cache',
        redirect: 'follow',
      });
      
      console.log('API login - Получен ответ со статусом:', response.status);
      
      // Проверяем на ошибки HTTP
      if (!response.ok) {
        let errorMessage = 'Ошибка авторизации';
        
        try {
        const errorData = await response.json();
          errorMessage = errorData.message || `Ошибка авторизации: ${response.status}`;
          console.error('API login - Ошибка авторизации:', errorData);
        } catch (e) {
          console.error('API login - Не удалось прочитать ответ с ошибкой:', e);
        }
        
        throw new Error(errorMessage);
      }
      
      // Безопасно пробуем прочитать тело ответа
      let data;
      try {
        data = await response.json();
        console.log('API login - Успешно получены данные');
      } catch (e) {
        console.error('API login - Ошибка при чтении ответа:', e);
        throw new Error('Невозможно обработать ответ сервера');
      }
      
      // Сохраняем токен в localStorage (дублируем из cookie для доступа на клиенте)
      if (data.token) {
        try {
        localStorage.setItem('token', data.token);
        console.log('API login - Токен сохранен в localStorage');
          
          // Добавляем временную метку для обновления состояния
          localStorage.setItem('auth_timestamp', Date.now().toString());
          localStorage.setItem('auth_method', 'proxy');
          
          // Дополнительно сохраняем токен в sessionStorage для надежности на мобильных устройствах
          sessionStorage.setItem('token', data.token);
        } catch (e) {
          console.error('API login - Не удалось сохранить токен в localStorage:', e);
        }
      } else {
        console.warn('API login - Токен отсутствует в ответе');
      }
      
      return { access_token: data.token, token_type: 'bearer' };
    } catch (error: any) {
      console.error('API login - Ошибка:', error);
      
      // Записываем ошибку в localStorage для отладки на мобильных устройствах
      try {
        localStorage.setItem('last_auth_error', JSON.stringify({
          message: error.message,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        console.error('Не удалось сохранить ошибку в localStorage:', e);
      }
      
      throw error;
    }
  },
  
  register: async (credentials: RegisterCredentials) => {
    console.log('API: Отправляем запрос на регистрацию с данными:', {
      ...credentials,
      password: '********' // Маскируем пароль в логах
    });
    try {
      // Попробуем сначала через прямой прокси - самый надежный вариант
      try {
        console.log('API: Отправка запроса через прямой прокси /api/auth/register-direct');
        const directResponse = await fetch('/api/auth/register-direct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });
        
        const data = await directResponse.json();
        
        if (!directResponse.ok) {
          console.error('API: Ошибка при регистрации через прямой прокси:', data);
          throw new Error(data.detail || 'Ошибка при регистрации');
        }
        
        console.log('API: Получен ответ от прямого прокси:', data);
        return data;
      } catch (directError) {
        console.error('API: Ошибка при регистрации через прямой прокси:', directError);
        
        // Если прямой прокси не сработал, пробуем через обычный прокси
        try {
          console.log('API: Пробуем обычный прокси /api/auth/register');
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            console.error('API: Ошибка при регистрации через обычный прокси:', data);
            throw new Error(data.detail || 'Ошибка при регистрации');
          }
          
          console.log('API: Получен ответ от обычного прокси:', data);
          return data;
        } catch (primaryError) {
          console.error('API: Ошибка при регистрации через обычный прокси:', primaryError);
          
          // Если и обычный прокси не сработал, перепробуем оставшиеся варианты
          // Резервный прокси и прямой запрос к бэкенду
          try {
            console.log('API: Пробуем резервный прокси-эндпоинт /api/v1/auth/register');
            const fallbackResponse = await fetch('/api/v1/auth/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(credentials),
            });
            
            const fallbackData = await fallbackResponse.json();
            
            if (!fallbackResponse.ok) {
              console.error('API: Ошибка при регистрации через резервный прокси:', fallbackData);
              throw new Error(fallbackData.detail || 'Ошибка при регистрации');
            }
            
            console.log('API: Получен ответ от резервного прокси:', fallbackData);
            return fallbackData;
          } catch (fallbackError: any) {
            console.error('API: Ошибка при использовании резервного прокси:', fallbackError);
            
            // Последняя попытка - прямой вызов к бэкенду (может не сработать из-за CORS)
            console.log('API: Последняя попытка - прямой вызов к бэкенду');
            try {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
              const directResponse = await fetch(`${apiUrl}/auth/register`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
              });
              
              const directData = await directResponse.json();
              
              if (!directResponse.ok) {
                console.error('API: Ошибка при прямом вызове бэкенда:', directData);
                throw new Error(directData.detail || 'Ошибка при регистрации');
              }
              
              console.log('API: Прямой вызов бэкенда успешен:', directData);
              return directData;
            } catch (directError: any) {
              console.error('API: Все попытки регистрации завершились неудачей:', directError);
              throw directError || fallbackError || primaryError || directError;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('API: Критическая ошибка при регистрации:', error);
      throw new Error(error.message || 'Произошла непредвиденная ошибка при регистрации пользователя');
    }
  },
  
  logout: () => {
    clearAuthTokens();
  },
  
  getProfile: async () => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Токен авторизации не найден');
    }
    
    // Проверяем, работаем ли на клиенте
    const isClient = typeof window !== 'undefined';
    
    // Получаем сохраненный профиль для использования в случае ошибок
    let cachedProfile: UserProfile | null = null;
    
    if (isClient) {
      try {
        const profileJson = localStorage.getItem('user_profile');
        if (profileJson) {
          cachedProfile = JSON.parse(profileJson);
          console.log('API - Найден кэшированный профиль:', cachedProfile?.role || 'unknown');
        }
      } catch (e) {
        console.error('API - Ошибка при чтении кэшированного профиля:', e);
      }
    }
    
    // Проверяем подключение к сети
    if (isClient && typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('API - Нет подключения к сети, возвращаем кэшированный профиль');
      if (cachedProfile) {
        return cachedProfile;
      }
      throw new Error('Отсутствует подключение к интернету');
    }
    
    // Сохраняем информацию о запросе
    const diagnosticInfo = {
      timestamp: new Date().toISOString(),
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      tokenExists: !!token,
      tokenLength: token?.length || 0
    };
    
    if (isClient) {
      try {
        localStorage.setItem('last_profile_request', JSON.stringify(diagnosticInfo));
      } catch (e) {
        console.error('API - Не удалось сохранить диагностику запроса:', e);
      }
    }
    
    // Определяем, является ли устройство мобильным
    const isMobile = isClient && typeof navigator !== 'undefined' && 
      /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);

    // Для мобильных устройств сначала пробуем использовать кэшированный профиль
    if (isMobile && cachedProfile) {
      console.log('API - Мобильное устройство использует кэшированный профиль');
      
      // Выполняем проверку профиля в фоне, чтобы обновить кэш, но не блокировать UI
      setTimeout(() => {
        console.log('API - Фоновое обновление профиля для мобильного устройства');
        api.get<UserProfile>('/users/me')
          .then(response => {
            try {
              localStorage.setItem('user_profile', JSON.stringify(response.data));
              localStorage.setItem('user_role', response.data.role);
              console.log('API - Профиль обновлен в фоне');
            } catch (e) {
              console.error('API - Ошибка при обновлении профиля в фоне:', e);
            }
          })
          .catch(e => console.error('API - Ошибка фонового обновления профиля:', e));
      }, 100);
      
      return cachedProfile;
    }
    
    // Попытка получить профиль через axios
    try {
      console.log('API - Запрос профиля с помощью axios');
    const response = await api.get<UserProfile>('/users/me');
      const profile = response.data;
      
      // Кэшируем профиль
      if (isClient && profile) {
        try {
          localStorage.setItem('user_profile', JSON.stringify(profile));
          localStorage.setItem('user_role', profile.role);
          console.log('API - Профиль сохранен в localStorage, роль:', profile.role);
        } catch (e) {
          console.error('API - Ошибка при сохранении профиля:', e);
        }
      }
      
      return profile;
    } catch (axiosError) {
      console.error('API - Ошибка axios при получении профиля:', axiosError);
      
      // Проверяем, является ли ошибка сетевой
      const isNetworkError = isClient && 
        ((axiosError as any)?.message === 'Network Error' || 
        (axiosError as any)?.code === 'ECONNABORTED' ||
        (axiosError as any)?.name === 'AbortError');
      
      // Если ошибка сети, пробуем прямой fetch
      if (isNetworkError) {
        console.log('API - Пробуем прямой fetch запрос из-за ошибки сети');
        
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
          
          // Проверяем валидность URL
          let validApiUrl = apiUrl;
          try {
            // Проверяем, что URL правильно сформирован
            new URL(apiUrl);
          } catch (urlError) {
            console.error('API - Неверный формат API URL, используем резервный URL:', urlError);
            // Если URL некорректен, используем резервный
            validApiUrl = 'http://localhost:8000/api/v1';
            
            // Записываем информацию об ошибке
            if (isClient) {
              try {
                localStorage.setItem('api_url_error', JSON.stringify({
                  originalUrl: apiUrl,
                  fallbackUrl: validApiUrl,
                  error: String(urlError),
                  timestamp: new Date().toISOString()
                }));
              } catch (e) {
                console.error('Не удалось записать ошибку URL:', e);
              }
            }
          }
          
          // Полный URL для запроса
          const requestUrl = `${validApiUrl}/users/me`;
          console.log('API - Используем URL для запроса:', requestUrl);
          
          // Добавляем обработку таймаута для fetch запроса
          const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
            // Проверяем подключение перед запросом
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              throw new Error('Нет подключения к интернету');
            }
            
            const controller = new AbortController();
            const id = setTimeout(() => {
              console.log(`API - Таймаут запроса к ${url} превышен (${timeout}ms)`);
              controller.abort();
            }, timeout);
            
            try {
              console.log(`API - Начинаем fetch запрос к ${url}`);
              const startTime = Date.now();
              
              // Добавляем проверку на случай, если URL неверный
              if (!url || !url.startsWith('http')) {
                throw new Error(`Неверный URL: ${url}`);
              }
              
              const response = await fetch(url, {
                ...options,
                signal: controller.signal
              });
              
              const duration = Date.now() - startTime;
              console.log(`API - Fetch запрос завершен за ${duration}ms, статус: ${response.status}`);
              
              clearTimeout(id);
              return response;
            } catch (err) {
              clearTimeout(id);
              console.error(`API - Ошибка fetch: ${err instanceof Error ? err.message : String(err)}`);
              
              // Записываем диагностическую информацию
              if (isClient) {
                try {
                  const diagnosticInfo = {
                    timestamp: new Date().toISOString(),
                    url,
                    errorType: err instanceof Error ? err.name : typeof err,
                    errorMessage: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack?.slice(0, 500) : null,
                    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                    connectionType: typeof navigator !== 'undefined' && 'connection' in navigator 
                      ? (navigator as any).connection?.type || 'unknown' 
                      : 'not_supported'
                  };
                  
                  localStorage.setItem('fetch_error_info', JSON.stringify(diagnosticInfo));
                  console.log('API - Сохранена диагностическая информация об ошибке fetch');
                } catch (storageError) {
                  console.error('API - Не удалось сохранить диагностику:', storageError);
                }
              }
              
              // Если есть кэш, возвращаем его вместо ошибки
              if (cachedProfile) {
                console.log('API - Возвращаем кэшированный профиль из-за ошибки fetch');
                // Не выбрасываем ошибку, используем кэшированные данные
                throw new Error(`Ошибка запроса: ${err instanceof Error ? err.message : String(err)}. Используем кэшированные данные.`);
              }
              
              throw err;
            }
          };
          
          // Резервный механизм - если основной запрос не удастся, пробуем GET запрос без лишних заголовков
          try {
            console.log('API - Отправка прямого запроса к:', `${requestUrl}`);
            const response = await fetchWithTimeout(requestUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              cache: 'no-cache',
              credentials: 'omit' // Отключаем cookies для прямого запроса
            }, 30000); // 30 секунд таймаут
            
            if (!response.ok) {
              // Если не прошла авторизация, но мы имеем кэшированный профиль, возвращаем его
              if (response.status === 401 && cachedProfile) {
                console.log('API - Неавторизованный запрос, возвращаем кэшированный профиль');
                return cachedProfile;
              }
              
              throw new Error(`HTTP ошибка! Статус: ${response.status}`);
            }
            
            const profile = await response.json();
            
            // Кэшируем профиль
            if (profile) {
              try {
                localStorage.setItem('user_profile', JSON.stringify(profile));
                localStorage.setItem('user_role', profile.role);
                console.log('API - Профиль сохранен после прямого запроса, роль:', profile.role);
              } catch (e) {
                console.error('API - Ошибка при сохранении профиля:', e);
              }
            }
            
            return profile;
          } catch (mainFetchError) {
            console.error('API - Ошибка основного fetch запроса:', mainFetchError);
            
            // Пробуем XMLHttpRequest как резервный вариант для мобильных устройств
            if (isMobile) {
              console.log('API - Пробуем XMLHttpRequest на мобильном устройстве');
              
              const xhrProfile = await new Promise<UserProfile>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', requestUrl, true);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Accept', 'application/json');
                
                xhr.onload = function() {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                      const profile = JSON.parse(xhr.responseText);
                      resolve(profile);
                    } catch (e) {
                      if (cachedProfile) resolve(cachedProfile);
                      else reject(new Error('Ошибка формата данных профиля'));
                    }
                  } else {
                    if (xhr.status === 401 && cachedProfile) {
                      resolve(cachedProfile);
                    } else {
                      reject(new Error(`HTTP ошибка: ${xhr.status}`));
                    }
                  }
                };
                
                xhr.onerror = function() {
                  if (cachedProfile) resolve(cachedProfile);
                  else reject(new Error('Ошибка сети при получении профиля'));
                };
                
                xhr.ontimeout = function() {
                  if (cachedProfile) resolve(cachedProfile);
                  else reject(new Error('Таймаут получения профиля'));
                };
                
                xhr.timeout = 20000; // 20 секунд таймаут
                xhr.send();
              });
              
              // Сохраняем профиль в кэш, если получили через XMLHttpRequest
              try {
                localStorage.setItem('user_profile', JSON.stringify(xhrProfile));
                localStorage.setItem('user_role', xhrProfile.role);
                console.log('API - Профиль сохранен после XMLHttpRequest, роль:', xhrProfile.role);
              } catch (e) {
                console.error('API - Ошибка при сохранении профиля после XMLHttpRequest:', e);
              }
              
              return xhrProfile;
            }
            
            // Простой запрос с минимумом заголовков как последний вариант
            console.log('API - Пробуем простой запрос как последний вариант');
            const simpleResponse = await fetch(requestUrl, { 
              headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            if (!simpleResponse.ok) {
              if (simpleResponse.status === 401 && cachedProfile) {
                return cachedProfile;
              }
              throw new Error(`Простой запрос не удался! Статус: ${simpleResponse.status}`);
            }
            
            const simpleProfile = await simpleResponse.json();
            
            // Кэшируем профиль
            if (simpleProfile) {
              try {
                localStorage.setItem('user_profile', JSON.stringify(simpleProfile));
                localStorage.setItem('user_role', simpleProfile.role);
              } catch (e) {
                console.error('API - Ошибка при сохранении профиля:', e);
              }
            }
            
            return simpleProfile;
          }
        } catch (fetchError) {
          console.error('API - Все попытки fetch не удались:', fetchError);
          
          // Если мы имеем кэшированный профиль, возвращаем его как запасной вариант
          if (cachedProfile) {
            console.log('API - Возвращаем кэшированный профиль после всех ошибок сети');
            return cachedProfile;
          }
          
          throw fetchError;
        }
      }
      
      // Если это не ошибка сети или прямой запрос не удался
      // и мы имеем кэшированный профиль, возвращаем его как запасной вариант
      if (cachedProfile) {
        console.log('API - Возвращаем кэшированный профиль после ошибки axios');
        return cachedProfile;
      }
      
      // В противном случае пробрасываем ошибку дальше
      throw axiosError;
    }
  },
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

export {  usersApi,  settingsApi};

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