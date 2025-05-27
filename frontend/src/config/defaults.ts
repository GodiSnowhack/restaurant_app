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
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Добавляем /api/v1, если его нет
  if (!baseUrl.endsWith('/api/v1')) {
    return `${baseUrl}/api/v1`;
  }
  return baseUrl;
};

// Базовые URL для разных окружений
export const DEFAULT_URLS = {
  development: {
    api: 'http://localhost:8000/api/v1',
    frontend: 'http://localhost:3000'
  },
  production: {
    api: formatApiUrl(process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app'),
    frontend: process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://frontend-production-8eb6.up.railway.app'
  }
};

// Получение базового URL API
export const getDefaultApiUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? DEFAULT_URLS.production.api : DEFAULT_URLS.development.api;
};

// Получение базового URL фронтенда
export const getDefaultFrontendUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? DEFAULT_URLS.production.frontend : DEFAULT_URLS.development.frontend;
}; 