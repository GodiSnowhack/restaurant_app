import { ensureSecureUrl } from '../../lib/utils/api';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_FRONTEND_URL?: string;
    }
  }
}

// Функция для обработки базового URL API
const formatApiUrl = (url: string): string => {
  // Убираем слеш в конце, если он есть
  let baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // В production всегда используем HTTPS, если URL начинается с http://
  if (process.env.NODE_ENV === 'production' && baseUrl.startsWith('http://')) {
    baseUrl = baseUrl.replace('http://', 'https://');
  }
  
  return baseUrl;
};

// Базовые URL для разных окружений
export const DEFAULT_URLS = {
  development: {
    // Для локальной разработки 
    api: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
    frontend: 'http://localhost:3000',
    orders: 'http://localhost:8000/api/v1/orders/'
  },
  production: {
    // Используем точный URL из переменной среды Railway
    api: process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1',
    frontend: process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://frontend-production-8eb6.up.railway.app',
    orders: 'https://backend-production-1a78.up.railway.app/api/v1/orders/'
  }
};

// Получение базового URL API
export const getDefaultApiUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  let apiUrl = isProduction ? DEFAULT_URLS.production.api : DEFAULT_URLS.development.api;
  
  // Убедимся, что URL для production всегда HTTPS
  if (isProduction && apiUrl.startsWith('http://')) {
    apiUrl = apiUrl.replace('http://', 'https://');
  }
  
  // Убедимся, что URL не содержит двойной /api
  if (apiUrl.includes('/api/v1/api/')) {
    apiUrl = apiUrl.replace('/api/v1/api/', '/api/v1/');
  }
  
  // Проверка на другие возможные дублирования
  if (apiUrl.includes('/api/v1/api/v1/')) {
    apiUrl = apiUrl.replace('/api/v1/api/v1/', '/api/v1/');
  }

  // Очищаем любые другие дублирования api/v1
  const basePattern = /\/api\/v1(\/api\/v1)+/g;
  apiUrl = apiUrl.replace(basePattern, '/api/v1');
  
  // Нормализация URL: убираем конечные слеши
  return apiUrl.replace(/\/+$/, '');
};

// Получение базового URL фронтенда
export const getDefaultFrontendUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = isProduction ? DEFAULT_URLS.production.frontend : DEFAULT_URLS.development.frontend;
  // Убедимся, что URL для production всегда HTTPS
  if (isProduction && frontendUrl.startsWith('http://')) {
    return frontendUrl.replace('http://', 'https://');
  }
  return frontendUrl;
};

// Получение URL API для заказов
export const getOrdersApiUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  const ordersUrl = isProduction ? DEFAULT_URLS.production.orders : DEFAULT_URLS.development.orders;
  // Убедимся, что URL заканчивается на слеш, чтобы избежать редиректов
  return ordersUrl.endsWith('/') ? ordersUrl : ordersUrl + '/';
}; 