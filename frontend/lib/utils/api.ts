import { getDefaultApiUrl, getDefaultFrontendUrl } from '../../src/config/defaults';

/**
 * Возвращает безопасный URL для API запросов
 */
export const getSecureApiUrl = (): string => {
  // Принудительно используем HTTPS URL
  return 'https://backend-production-1a78.up.railway.app/api/v1';
};

/**
 * Создает базовый URL для API запросов
 */
export const createApiUrl = (endpoint: string): string => {
  const baseUrl = getSecureApiUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  return url;
};

/**
 * Проверяет, является ли URL безопасным (HTTPS)
 */
export const isSecureUrl = (url: string): boolean => {
  return url.startsWith('https://');
};

// Получение базового URL для фронтенда
export const getFrontendUrl = (): string => {
  return 'https://frontend-production-8eb6.up.railway.app';
};

// Преобразование URL в безопасный (HTTPS)
export const ensureSecureUrl = (url: string): string => {
  if (!isSecureUrl(url)) {
    return url.replace('http://', 'https://');
  }
  return url;
};

// Получение полного URL API с учетом окружения
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getSecureApiUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  return url;
}; 