import { getDefaultApiUrl, getDefaultFrontendUrl } from '../../src/config/defaults';

/**
 * Утилита для обработки API URL
 * Гарантирует использование HTTPS для всех URL
 */
export const getSecureApiUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || getDefaultApiUrl();
  return ensureSecureUrl(baseUrl);
};

// Получение базового URL для фронтенда
export const getFrontendUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || getDefaultFrontendUrl();
  return ensureSecureUrl(baseUrl);
};

// Проверка, является ли URL безопасным (HTTPS)
export const isSecureUrl = (url: string): boolean => {
  return url.startsWith('https://');
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