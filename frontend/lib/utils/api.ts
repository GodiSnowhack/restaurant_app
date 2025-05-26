import { getDefaultApiUrl, getDefaultFrontendUrl } from '../../src/config/defaults';

/**
 * Возвращает безопасный URL для API запросов
 */
export const getSecureApiUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
  // Убеждаемся, что URL использует HTTPS
  return apiUrl.replace('http://', 'https://');
};

/**
 * Создает базовый URL для API запросов
 */
export const createApiUrl = (endpoint: string) => {
  const baseUrl = getSecureApiUrl();
  return `${baseUrl}${endpoint}`;
};

/**
 * Проверяет, является ли URL безопасным (HTTPS)
 */
export const isSecureUrl = (url: string) => {
  return url.startsWith('https://');
};

// Получение базового URL для фронтенда
export const getFrontendUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || getDefaultFrontendUrl();
  return ensureSecureUrl(baseUrl);
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
  return ensureSecureUrl(url);
}; 