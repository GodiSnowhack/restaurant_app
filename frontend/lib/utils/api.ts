import { getDefaultApiUrl } from '../../src/config/defaults';

/**
 * Возвращает безопасный URL для API запросов
 */
export const getSecureApiUrl = (): string => {
  // Проверяем, запущено ли приложение в браузере или на сервере
  const isBrowser = typeof window !== 'undefined';
  
  if (isBrowser) {
    // В браузере используем относительные URL для внутренних прокси-эндпоинтов
    return '/api';
  } else {
    // На сервере используем полный URL из переменных окружения
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';
    return ensureSecureUrl(baseUrl);
  }
};

/**
 * Создает безопасный URL для API запросов
 */
export const createApiUrl = (endpoint: string): string => {
  const baseUrl = getSecureApiUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  return ensureSecureUrl(url);
};

/**
 * Проверяет, является ли URL безопасным (HTTPS)
 */
export const isSecureUrl = (url: string): boolean => {
  // Для относительных URL (начинающихся с /) считаем их безопасными
  if (url.startsWith('/')) {
    return true;
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Преобразует URL в безопасный (HTTPS)
 */
export const ensureSecureUrl = (url: string): string => {
  // Для относительных URL (начинающихся с /) не меняем их
  if (url.startsWith('/')) {
    return url;
  }
  
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      urlObj.protocol = 'https:';
    }
    return urlObj.toString();
  } catch {
    // Если не удалось распарсить URL, просто заменяем протокол
    return url.replace(/^http:\/\//i, 'https://');
  }
};

/**
 * Получение базового URL для фронтенда
 */
export const getFrontendUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://frontend-production-8eb6.up.railway.app';
  return ensureSecureUrl(url);
};

/**
 * Получение полного URL API с учетом окружения
 */
export const getApiUrl = (endpoint: string): string => {
  return createApiUrl(endpoint);
}; 