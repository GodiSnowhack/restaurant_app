import { ensureSecureUrl } from '../../lib/utils/api';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_FRONTEND_URL?: string;
    }
  }
}

// Базовые URL для разных окружений
export const DEFAULT_URLS = {
  development: {
    api: 'http://localhost:8000/api/v1',
    frontend: 'http://localhost:3000'
  },
  production: {
    api: process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1',
    frontend: process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://frontend-production-8eb6.up.railway.app'
  }
};

// Получение базового URL API
export const getDefaultApiUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? DEFAULT_URLS.production.api : DEFAULT_URLS.development.api;
  return ensureSecureUrl(baseUrl);
};

// Получение базового URL фронтенда
export const getDefaultFrontendUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? DEFAULT_URLS.production.frontend : DEFAULT_URLS.development.frontend;
  return ensureSecureUrl(baseUrl);
}; 