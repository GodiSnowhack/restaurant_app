import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosHeaders } from 'axios';
import jwt from 'jsonwebtoken';
import { getSecureApiUrl, initializeApi } from '../utils/api';

// Отключаем демо-данные при инициализации
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('force_demo_data');
    localStorage.removeItem('admin_use_demo_data');
    console.log('API Core: Демо-режим отключен при инициализации');
  } catch (e) {
    console.error('API Core: Ошибка при отключении демо-режима:', e);
  }
}

// Создаем экземпляр axios с базовой конфигурацией
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1', // Всегда используем HTTPS
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true,
  maxRedirects: 5, // Разрешаем ограниченное количество перенаправлений
  validateStatus: function (status) {
    return status < 400; // Принимаем только успешные статусы
  }
});

// Фиксируем URL, чтобы избежать проблем с дублированием /api/
(function fixApiBaseUrl() {
  let baseURL = api.defaults.baseURL;
  if (baseURL) {
    // Исправляем дублирование /api/
    if (baseURL.includes('/api/v1/api/')) {
    console.log('[API Core] Обнаружено дублирование /api/ в baseURL, исправляем...');
    baseURL = baseURL.replace('/api/v1/api/', '/api/v1/');
    }
    
    // Проверка на другие возможные дублирования
    if (baseURL.includes('/api/v1/api/v1/')) {
      console.log('[API Core] Обнаружено дублирование /api/v1/ в baseURL, исправляем...');
      baseURL = baseURL.replace('/api/v1/api/v1/', '/api/v1/');
    }
    
    // Очищаем любые другие дублирования api/v1
    const basePattern = /\/api\/v1(\/api\/v1)+/g;
    if (basePattern.test(baseURL)) {
      console.log('[API Core] Обнаружены множественные дублирования в baseURL, исправляем...');
      baseURL = baseURL.replace(basePattern, '/api/v1');
    }
    
    api.defaults.baseURL = baseURL;
  }
  console.log('[API Core] Используется baseURL:', api.defaults.baseURL);
})();

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
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch (e) {
    console.error('[API] Ошибка при проверке токена:', e);
    return true;
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
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_profile');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_role');
};

// Расширяем тип конфигурации axios
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Перехватчик для добавления токена авторизации
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Проверяем URL на дублирование /api/
    if (config.url) {
      // Исправляем дублирование /api/v1/api/
      if (config.url.includes('/api/v1/api/')) {
      console.log('[API Interceptor] Обнаружено дублирование /api/ в URL, исправляем...');
      config.url = config.url.replace('/api/v1/api/', '/api/v1/');
      }
      
      // Проверка на другие возможные дублирования
      if (config.url.includes('/api/v1/api/v1/')) {
        console.log('[API Interceptor] Обнаружено дублирование /api/v1/ в URL, исправляем...');
        config.url = config.url.replace('/api/v1/api/v1/', '/api/v1/');
      }
      
      // Очищаем любые другие дублирования api/v1
      const urlPattern = /\/api\/v1(\/api\/v1)+/g;
      if (urlPattern.test(config.url)) {
        console.log('[API Interceptor] Обнаружены множественные дублирования в URL, исправляем...');
        config.url = config.url.replace(urlPattern, '/api/v1');
      }
    }
    
    // Получаем токен из всех возможных источников
    const token = getAuthTokenFromAllSources();
    
    if (token) {
      console.log('API Interceptor: Добавляем токен в заголовки');
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.Authorization = `Bearer ${token}`;
      
      // Добавляем дополнительные заголовки для авторизации
      try {
        const userId = localStorage.getItem('user_id');
        const userRole = localStorage.getItem('user_role');
        
        if (userId && userRole) {
          config.headers['X-User-ID'] = userId;
          config.headers['X-User-Role'] = userRole;
          console.log('API Interceptor: Добавлены пользовательские заголовки:', {
            userId,
            role: userRole
          });
        }
      } catch (e) {
        console.error('API Interceptor: Ошибка при добавлении пользовательских заголовков:', e);
      }
    } else {
      console.warn('API Interceptor: Токен не найден');
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('API Interceptor: Ошибка в перехватчике запроса:', error);
    return Promise.reject(error);
  }
);

// Перехватчик для обработки ответов
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[API] Получен ответ от ${response.config.url}:`, response.status);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as ExtendedAxiosRequestConfig;
    
    // Проверяем, является ли ошибка связанной с CORS
    const isCorsError = error.message?.includes('CORS') || 
                        error.message?.includes('cross-origin') ||
                        error.code === 'ERR_NETWORK' && error.message?.includes('blocked');
    
    if (isCorsError || error.code === 'ERR_NETWORK') {
      console.warn('[API] Обнаружена CORS/сетевая ошибка:', error.message);
      console.log('[API] Перенаправляем запрос через локальный API-прокси');
      
      // Если URL начинается с внешнего API, попробуем заменить его на локальный прокси
      if (config?.url) {
        // Определяем, нужно ли преобразовать URL
        let localProxyUrl = config.url;
        
        // Исправляем дублирование путей
        if (localProxyUrl.includes('/api/v1/api/v1/')) {
          localProxyUrl = localProxyUrl.replace('/api/v1/api/v1/', '/api/v1/');
        }
        
        // Очищаем любые другие дублирования api/v1
        const urlPattern = /\/api\/v1(\/api\/v1)+/g;
        if (urlPattern.test(localProxyUrl)) {
          localProxyUrl = localProxyUrl.replace(urlPattern, '/api/v1');
        }
        
        // Если URL содержит /api/v1/, заменяем на /api/
        if (localProxyUrl.includes('/api/v1/')) {
          localProxyUrl = localProxyUrl.replace('/api/v1/', '/api/');
        } 
        // Если URL не начинается с /api/, добавляем этот префикс
        else if (!localProxyUrl.startsWith('/api/')) {
          // Удаляем любые префиксы http(s)://domain.com
          const endpoint = localProxyUrl.replace(/^https?:\/\/[^\/]+\//, '');
          // Если endpoint уже начинается с api/, убираем его
          const cleanEndpoint = endpoint.startsWith('api/') ? endpoint.slice(4) : endpoint;
          localProxyUrl = `/api/${cleanEndpoint}`;
        }
        
        console.log(`[API] Перенаправление запроса с ${config.url} на локальный прокси ${localProxyUrl}`);
        
        try {
          // Попытка сделать запрос через локальный прокси
          return axios({
            ...config,
            url: localProxyUrl,
            baseURL: '', // Обнуляем baseURL для использования относительного пути
            headers: {
              ...config.headers,
              'X-Original-URL': config.url
            }
          });
        } catch (proxyError) {
          console.error('[API] Ошибка при использовании локального прокси:', proxyError);
        }
      }
    }
    
    // Проверяем, является ли ошибка связанной с сетью
    const isNetworkError = error.message?.includes('Network Error') || 
                           error.code === 'ERR_NETWORK' ||
                           error.code === 'ECONNABORTED' ||
                           error.code === 'ERR_TOO_MANY_REDIRECTS';
    
    if (isNetworkError) {
      console.warn('[API] Обнаружена сетевая ошибка:', error.message);
      
      // Для проблем с сетью пытаемся использовать кэшированные данные или заглушки
      if (config?.url) {
        // Возвращаем сообщение об ошибке в формате, совместимом с ожидаемым ответом
        return Promise.reject({
          ...error,
          response: {
            status: 503,
            data: { 
              message: 'Сервис временно недоступен, используйте кэшированные данные',
              error: error.message,
              useCached: true
            }
          }
        });
      }
    }
    
    console.error('[API] Ошибка в ответе:', {
      status: error.response?.status,
      url: config?.url,
      message: error.message
    });
    
    // Если ошибка 401, пробуем обновить токен
    if (error.response?.status === 401) {
      console.log('[API] Получена ошибка 401, проверяем авторизацию');
      
      try {
        // Проверяем наличие токена
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('[API] Токен отсутствует');
          clearAuthTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
          return Promise.reject(error);
        }
        
        // Проверяем валидность токена
        if (isTokenExpired(token)) {
          console.log('[API] Токен истек, выполняем выход');
          clearAuthTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
          return Promise.reject(error);
        }
        
        // Если токен валиден, но все равно получаем 401,
        // возможно, проблема с сервером. Пробуем повторить запрос
        if (config && !config._retry) {
          config._retry = true;
          return api(config);
        }
      } catch (e) {
        console.error('[API] Ошибка при обработке 401:', e);
        clearAuthTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Функция для создания нового токена
function createAccessToken(data: { sub: string | number, role: string, email: string }): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 часа
  };
  
  // Используем строку в качестве секретного ключа
  const secret = process.env.NEXT_PUBLIC_JWT_SECRET || 'your-secret-key';
  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
  
  return token;
}

// Функция для проверки, является ли текущий маршрут публичным
// Импортируем позже для избежания циклических зависимостей
let PUBLIC_ROUTES: string[] = [];
try {
  // Динамический импорт, если файл существует
  if (typeof window !== 'undefined') {
    PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/menu', '/menu/[id]', '/reservations', '/'];
  }
} catch (e) {
  PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/menu', '/menu/[id]', '/reservations', '/'];
}

export const checkIfPublicRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const path = window.location.pathname;
  
  // Проверяем прямое совпадение
  if (PUBLIC_ROUTES.includes(path)) {
    return true;
  }
  
  // Проверяем начало пути (для маршрутов с параметрами)
  if (path.startsWith('/menu/') || path.startsWith('/reservations/')) {
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
  
  // Получаем данные пользователя из токена
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': payload.sub || '',
        'X-User-Role': payload.role || ''
      };
    }
  } catch (e) {
    console.error('Ошибка при декодировании токена:', e);
  }
  
  // Если не удалось получить данные из токена, используем только Authorization
  return {
    'Authorization': `Bearer ${token}`
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