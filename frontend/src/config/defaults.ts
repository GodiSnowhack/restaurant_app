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

/**
 * Возвращает базовый URL API
 * @returns строка с базовым URL API
 */
export function getDefaultApiUrl(): string {
  // Сначала пробуем получить URL из переменных окружения
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) {
    let url = process.env.NEXT_PUBLIC_API_URL;
    // В production всегда https
    if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    // Убираем слеш в конце, если он есть
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
  
  // Затем проверяем window (в браузере)
  if (typeof window !== 'undefined' && (window as any).API_URL) {
    let url = (window as any).API_URL;
    // В production всегда https
    if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    // Убираем слеш в конце, если он есть
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }
  
  // Определяем URL по умолчанию в зависимости от окружения
  const isProduction = process.env.NODE_ENV === 'production';
  const defaultUrl = isProduction 
    ? 'https://backend-production-1a78.up.railway.app/api/v1' 
    : 'http://localhost:8000/api/v1';
  
  // Убираем слеш в конце, если он есть
  return defaultUrl.endsWith('/') ? defaultUrl.slice(0, -1) : defaultUrl;
}

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