import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosHeaders } from 'axios';
import jwt from 'jsonwebtoken';
import { getSecureApiUrl } from '../utils/api';

// Создаем экземпляр axios с базовой конфигурацией
export const api = axios.create({
  baseURL: 'https://backend-production-1a78.up.railway.app/api/v1',
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Функция получения токена
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

// Очистка токенов при выходе
export const clearAuthTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user_profile');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_role');
};

// Перехватчик для добавления токена авторизации
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Перехватчик для обработки ответов
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // Если 401, выходим из системы
    if (error.response?.status === 401) {
      clearAuthTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

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