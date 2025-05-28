import { getDefaultApiUrl } from '../../src/config/defaults';

/**
 * Возвращает безопасный URL для API запросов
 * Всегда предпочитаем использовать внутренние прокси-эндпоинты
 */
export const getSecureApiUrl = (): string => {
  // В браузере всегда используем внутренние прокси-эндпоинты
  if (typeof window !== 'undefined') {
    return '/api';
  } 
  
  // На сервере также используем внутренние прокси-эндпоинты
  // или полный URL из переменных окружения если это необходимо для SSR
  return '/api';
};

/**
 * Создает безопасный URL для API запросов через внутренние прокси
 */
export const createApiUrl = (endpoint: string): string => {
  const baseUrl = getSecureApiUrl();
  
  // Для эндпоинтов аутентификации и профиля используем специальные прокси-маршруты
  if (endpoint.includes('users/me') || endpoint.includes('profile')) {
    return '/api/profile';
  }
  
  // Для списка пользователей
  if (endpoint === '/users' || endpoint.startsWith('/users?')) {
    return '/api/users';
  }
  
  // Для категорий меню
  if (endpoint.includes('menu/categories')) {
    return '/api/menu/categories';
  }
  
  // Для блюд меню
  if (endpoint.includes('menu/dishes')) {
    return '/api/menu/dishes';
  }
  
  // Для настроек
  if (endpoint.includes('settings')) {
    return '/api/settings';
  }
  
  // Для аналитики
  if (endpoint.startsWith('analytics/') || endpoint.startsWith('/analytics/')) {
    const analyticsEndpoint = endpoint.replace(/^\/?(analytics\/)?/, '');
    return `/api/analytics/${analyticsEndpoint}`;
  }
  
  // Для прямых запросов к аналитике
  if (endpoint === 'menu' || endpoint === '/menu' || 
      endpoint === 'financial' || endpoint === '/financial' ||
      endpoint === 'customers' || endpoint === '/customers' ||
      endpoint === 'operational' || endpoint === '/operational' ||
      endpoint === 'predictive' || endpoint === '/predictive' ||
      endpoint === 'dashboard' || endpoint === '/dashboard') {
    return `/api/analytics/${endpoint.replace(/^\//, '')}`;
  }
  
  // Для общего случая
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  return url;
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
 * Всегда предпочитаем использовать внутренние прокси-эндпоинты
 */
export const getApiUrl = (endpoint: string): string => {
  return createApiUrl(endpoint);
};

// Функция для инициализации API
export function initializeApi() {
  // Отключаем демо-данные при инициализации
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('force_demo_data');
    }
  } catch (e) {
    console.error('Ошибка при очистке настроек демо-данных:', e);
  }
  
  // Основная инициализация API
  // ... существующий код ...
} 