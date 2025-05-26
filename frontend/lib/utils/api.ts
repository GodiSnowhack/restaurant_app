/**
 * Утилита для обработки API URL
 * Гарантирует использование HTTPS для production URL
 */
export const getSecureApiUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return 'https://backend-production-1a78.up.railway.app/api/v1';
  }
  
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
};

// Получение базового URL для фронтенда
export const getFrontendUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return 'https://frontend-production-8eb6.up.railway.app';
  }
  
  return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
};

// Проверка, является ли URL безопасным (HTTPS)
export const isSecureUrl = (url: string): boolean => {
  return url.startsWith('https://');
};

// Преобразование URL в безопасный (HTTPS)
export const ensureSecureUrl = (url: string): string => {
  if (!isSecureUrl(url) && process.env.NODE_ENV === 'production') {
    return url.replace('http://', 'https://');
  }
  return url;
}; 