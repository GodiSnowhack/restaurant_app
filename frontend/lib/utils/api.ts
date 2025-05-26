/**
 * Утилита для обработки API URL
 * Гарантирует использование HTTPS для production URL
 */
export const getSecureApiUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  let baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    baseUrl = isProduction 
      ? 'https://backend-production-1a78.up.railway.app/api/v1'
      : 'http://localhost:8000/api/v1';
  }

  // Гарантируем HTTPS для production URL
  if (isProduction && baseUrl.startsWith('http://')) {
    baseUrl = baseUrl.replace('http://', 'https://');
  }

  return baseUrl;
};

// Получение базового URL для фронтенда
export const getFrontendUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  let baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

  if (!baseUrl) {
    baseUrl = isProduction
      ? 'https://frontend-production-8eb6.up.railway.app'
      : 'http://localhost:3000';
  }

  // Гарантируем HTTPS для production URL
  if (isProduction && baseUrl.startsWith('http://')) {
    baseUrl = baseUrl.replace('http://', 'https://');
  }

  return baseUrl;
};

// Проверка, является ли URL безопасным (HTTPS)
export const isSecureUrl = (url: string): boolean => {
  if (process.env.NODE_ENV !== 'production') {
    return true; // В режиме разработки разрешаем HTTP
  }
  return url.startsWith('https://');
};

// Преобразование URL в безопасный (HTTPS)
export const ensureSecureUrl = (url: string): string => {
  if (!isSecureUrl(url) && process.env.NODE_ENV === 'production') {
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