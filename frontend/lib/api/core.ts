import axios, { AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// Функция для определения правильного baseURL для API
export const getApiBaseUrl = () => {
  // Используем URL из переменной окружения, если он задан
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Если мы на клиенте, используем относительный URL для проксирования через Next.js
  if (typeof window !== 'undefined') {
    return 'http://localhost:8000';
  }
  
  // Для SSR используем прямой URL к бэкенду
  return 'http://localhost:8000';
};

const baseURL = getApiBaseUrl();
// Используем baseURL как API_URL для унификации
export const API_URL = baseURL;

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true, // Включаем отправку куки для поддержки авторизации
  timeout: 60000, // Увеличиваем таймаут для мобильных устройств до 60 секунд
  maxRedirects: 5, // Максимальное количество редиректов
});

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
export const isTokenExpired = (token: string): boolean => {
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
    return false; // Если ошибка при декодировании, считаем что токен не истёк
  }
};

// Функция получения токена из любого доступного хранилища
export const getAuthToken = (): string | null => {
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

// Обновление функции logout для очистки обоих хранилищ
export const clearAuthTokens = () => {
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

// Interceptor для добавления токена в заголовки
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    
    if (token) {
      // Добавляем токен в заголовки
      config.headers.Authorization = `Bearer ${token}`;
      
      try {
        // Добавляем информацию о пользователе из localStorage
        const userInfo = localStorage.getItem('user');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          config.headers['X-User-ID'] = user.id;
          config.headers['X-User-Role'] = user.role;
          config.headers['X-Is-Admin'] = user.role === 'admin' ? 'true' : 'false';
        }
      } catch (e) {
        console.error('Ошибка при добавлении информации пользователя в заголовки:', e);
      }
    }
    
    // Добавляем CORS заголовки
    config.headers['Access-Control-Allow-Credentials'] = 'true';
    config.headers['Access-Control-Allow-Origin'] = window.location.origin;
    
    return config;
  },
  (error) => {
    console.error('Ошибка запроса API:', error);
    return Promise.reject(error);
  }
);

// Добавляем обработчик ответов для централизованной обработки ошибок
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const isMobile = typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    
    // Сохраняем информацию о последней ошибке для диагностики
    if (typeof window !== 'undefined') {
      try {
        const lastErrors = JSON.parse(localStorage.getItem('api_last_errors') || '[]');
        const newError = {
          timestamp: new Date().toISOString(),
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
          isMobile
        };
        
        // Сохраняем последние 5 ошибок
        lastErrors.unshift(newError);
        if (lastErrors.length > 5) lastErrors.pop();
        
        localStorage.setItem('api_last_errors', JSON.stringify(lastErrors));
      } catch (e) {
        console.error('Не удалось сохранить информацию об ошибке:', e);
      }
    }
    
    if (error.response) {
      // Сервер вернул статус отличный от 2xx
      console.error('API Response Error:', {
        message: error.message,
        status: error.response.status,
        data: error.response.data
      });
      
      // Преобразуем ошибку в строку, если это объект
      if (error.response.data && typeof error.response.data === 'object') {
        if (error.response.data.detail) {
          if (typeof error.response.data.detail === 'string') {
            error.response.data.detail = error.response.data.detail;
          } else if (Array.isArray(error.response.data.detail)) {
            error.response.data.detail = error.response.data.detail.map((err: any) => {
              if (err.loc && err.msg) {
                const field = err.loc.slice(1).join('.') || 'значение';
                return `Поле "${field}": ${err.msg}`;
              }
              return typeof err === 'string' ? err : JSON.stringify(err);
            }).join('\n');
          } else {
            error.response.data.detail = JSON.stringify(error.response.data.detail);
          }
        } else {
          error.response.data.detail = JSON.stringify(error.response.data);
        }
      }
      
      // Обрабатываем ошибку авторизации
      if (error.response.status === 401) {
        console.warn('Получена ошибка 401, возможно токен истек');
        
        // На мобильных устройствах не удаляем токен и не перенаправляем сразу,
        // чтобы дать возможность обработать ошибку и повторить запрос
        if (!isMobile) {
          // Удаляем токен только если мы не на мобильном устройстве
          localStorage.removeItem('token');
          
          // Проверяем, является ли текущий маршрут публичным
          const isPublicRoute = checkIfPublicRoute();
          
          // Если не находимся на странице авторизации И маршрут не публичный, перенаправляем
          if (typeof window !== 'undefined' && 
              window.location.pathname !== '/auth/login' && 
              !isPublicRoute) {
            console.log('Перенаправление на страницу авторизации с защищенного маршрута:', window.location.pathname);
            window.location.href = '/auth/login';
          } else {
            console.log('Получена ошибка 401 на публичном маршруте, перенаправление не требуется');
          }
        } else {
          console.log('Мобильное устройство: ошибка 401 будет обработана локально');
        }
      }
    } else if (error.request) {
      // Запрос был создан, но ответ не получен (ошибка сети)
      console.error('API Response Error:', {
        message: error.message,
        response: 'No response',
        request: 'Request was sent',
      });
      
      // Для мобильных устройств отображаем более подробную ошибку
      if (isMobile) {
        const networkDiagnostics = {
          timestamp: new Date().toISOString(),
          online: typeof navigator !== 'undefined' ? navigator.onLine : 'unknown',
          userAgent: navigator.userAgent,
          url: error.config?.url,
          method: error.config?.method
        };
        
        console.log('Мобильное устройство: диагностика сети', networkDiagnostics);
        
        try {
          localStorage.setItem('network_diagnostics', JSON.stringify(networkDiagnostics));
        } catch (e) {
          console.error('Не удалось сохранить диагностику сети:', e);
        }
        
        error.response = { 
          data: { 
            detail: `Ошибка сети: ${error.message}. Проверьте подключение к интернету и повторите попытку.` 
          } 
        };
      } else {
      error.response = { data: { detail: 'Ошибка сети. Пожалуйста, проверьте подключение к интернету.' } };
      }
    } else {
      // Произошла ошибка во время создания запроса
      console.error('API Error:', error.message);
      error.response = { data: { detail: error.message } };
    }
    
    // Дополнительное логирование для сетевых ошибок
    if (error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
      console.error('Ошибка сети или таймаут запроса', error);
      
      // Для мобильных устройств пытаемся сохранить информацию о сети
      if (isMobile && typeof navigator !== 'undefined') {
        const connectionInfo = {
          online: navigator.onLine,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: error.config?.url,
          method: error.config?.method
        };
        
        console.log('Информация о подключении:', connectionInfo);
        
        try {
          localStorage.setItem('last_connection_error', JSON.stringify(connectionInfo));
        } catch (e) {
          console.error('Не удалось сохранить информацию о подключении:', e);
        }
      }
      
      error.response = { data: { detail: 'Ошибка сети или таймаут запроса. Пожалуйста, попробуйте позже.' } };
    }
    
    return Promise.reject(error);
  }
);

// Функция для проверки, является ли текущий маршрут публичным
// Импортируем позже для избежания циклических зависимостей
let PUBLIC_ROUTES: string[] = [];
try {
  // Динамический импорт, если файл существует
  if (typeof window !== 'undefined') {
    PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/menu', '/'];
  }
} catch (e) {
  PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/menu', '/'];
}

export const checkIfPublicRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const path = window.location.pathname;
  
  // Проверяем прямое совпадение
  if (PUBLIC_ROUTES.includes(path)) {
    return true;
  }
  
  // Проверяем начало пути (для маршрутов с параметрами)
  if (path.startsWith('/menu/')) {
    return true;
  }
  
  return false;
};

// Универсальная функция для выполнения fetch с таймаутом
export const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Функция для получения токена авторизации из всех возможных источников
export const getAuthTokenFromAllSources = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Проверяем несколько мест хранения
    // 1. Сначала localStorage
    const localToken = localStorage.getItem('token');
    if (localToken) {
      return localToken;
    }
    
    // 2. Затем sessionStorage
    const sessionToken = sessionStorage.getItem('token');
    if (sessionToken) {
      return sessionToken;
    }
    
    // 3. Наконец cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token' && value) {
        return value;
      }
    }
  } catch (e) {
    console.error('Ошибка при получении токена:', e);
  }
  
  return null;
};

/**
 * Получение заголовков авторизации
 */
export const getAuthHeaders = () => {
  const token = getAuthTokenFromAllSources();
  
  if (!token) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'X-User-ID': localStorage.getItem('user_id') || '1',
    'X-User-Role': localStorage.getItem('user_role') || 'admin'
  };
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