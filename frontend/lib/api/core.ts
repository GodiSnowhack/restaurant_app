import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// Функция для определения правильного baseURL для API
export const getApiBaseUrl = () => {
  // Используем URL из переменной окружения, если он задан
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Для разработки в Docker
  if (process.env.NODE_ENV === 'production') {
    return 'http://backend:8000/api/v1';
  }
  
  // Для локальной разработки
  return 'http://localhost:8000/api/v1';
};

export const API_URL = getApiBaseUrl();

// Создаем экземпляр axios с базовыми настройками
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  timeout: 30000,
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

// Интерцептор запросов
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Добавляем CORS заголовки для всех окружений
    const allowedOrigins = ['http://localhost:3000', 'http://frontend:3000'];
    const origin = typeof window !== 'undefined' ? window.location.origin : allowedOrigins[0];
    
    if (allowedOrigins.includes(origin)) {
      config.headers['Access-Control-Allow-Origin'] = origin;
      config.headers['Access-Control-Allow-Credentials'] = 'true';
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор ответов
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Если ошибка сети или таймаут, пробуем использовать кеш
    if (!error.response || error.code === 'ECONNABORTED') {
      return Promise.reject(error);
    }
    
    // Если 401, очищаем токены и перенаправляем на логин
    if (error.response?.status === 401) {
      clearAuthTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
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
  const url = options?.url || '/api/ping';  // Используем /api/ping вместо /api/v1
  const startTime = Date.now();
  
  try {
    // Сначала проверяем базовое соединение
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      // Если основной пинг не прошел, пробуем альтернативные эндпоинты
      const alternativeUrls = ['/api/categories', '/api/dishes'];
      
      for (const altUrl of alternativeUrls) {
        try {
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            cache: 'no-store'
          });
          
          if (altResponse.ok) {
            const pingTime = Date.now() - startTime;
            return { isOnline: true, pingTime };
          }
        } catch (e) {
          // Игнорируем ошибки альтернативных проверок
          console.log(`Альтернативная проверка ${altUrl} не удалась`);
        }
      }
      
      return { 
        isOnline: false,
        error: `Ошибка соединения: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    const pingTime = Date.now() - startTime;
    
    if (data?.status === 'ok' || data?.length >= 0) {
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
    
    // Пробуем альтернативные эндпоинты при ошибке
    try {
      const altResponse = await fetch('/api/categories', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      
      if (altResponse.ok) {
        const pingTime = Date.now() - startTime;
        return { isOnline: true, pingTime };
      }
    } catch (e) {
      // Игнорируем ошибку альтернативной проверки
    }
    
    return { 
      isOnline: false, 
      error: error.message || 'Не удалось подключиться к серверу',
    };
  }
}; 