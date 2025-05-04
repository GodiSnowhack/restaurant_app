// Импорты необходимых API модулей
import { api, API_URL, getAuthToken, clearAuthTokens, isTokenExpired, retryRequest, checkConnection, isMobileDevice, fetchWithTimeout, getAuthHeaders } from './core';
import { authApi } from './auth';
import { menuApi, Category, Dish } from './menu';
import { ordersApi } from './orders';
import { waiterApi } from './waiter';
import { settingsApi } from './settings';
import { reservationsApi, Reservation } from './reservations';
import adminApi from './admin-api';
import {
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  UserProfile,
  FileUploadResponse,
  DashboardStats,
  RestaurantSettings,
  Order,
  OrderItem,
  WorkingHours,
  WorkingHoursItem,
  RestaurantTable
} from './types';
import * as utils from './utils';

// Импорты из дополнительных модулей для обратной совместимости
import { assignOrderByCode } from './waiter-api';
import waiterApiExtended from './waiter-api';

// Функции для обратной совместимости
export const assignWaiterToOrder = async (code: string) => {
  return assignOrderByCode(code);
};

// Временная заглушка для функции, которая, по-видимому, использовалась ранее
export const generateWaiterCode = async (orderId: number) => {
  console.log('Функция generateWaiterCode была перемещена в другой модуль');
  return { success: false, message: 'Функция перемещена. Обновите импорты.' };
};

// Реэкспорт основных функций и объектов из core.ts
export { 
  api, 
  API_URL, 
  getAuthToken, 
  clearAuthTokens, 
  isTokenExpired,
  retryRequest,
  checkConnection,
  isMobileDevice,
  fetchWithTimeout,
  getAuthHeaders,
  assignOrderByCode
};

// Реэкспорт API для аутентификации
export { authApi };

// Реэкспорт API для меню и блюд
export { 
  menuApi,
  type Category,
  type Dish 
};

// Реэкспорт API для заказов
export { ordersApi };

// Реэкспорт API для официантов
export { waiterApi };

// Реэкспорт API для настроек
export { settingsApi };

// Реэкспорт API для бронирований
export { 
  reservationsApi,
  type Reservation 
};

// Реэкспорт API для администратора
export { adminApi };

// Реэкспорт типов из types.ts
export {
  type LoginCredentials,
  type RegisterCredentials,
  type AuthResponse,
  type UserProfile,
  type FileUploadResponse,
  type DashboardStats,
  type RestaurantSettings,
  type Order,
  type OrderItem,
  type WorkingHours,
  type WorkingHoursItem,
  type RestaurantTable
};

// Реэкспорт вспомогательных функций
export const apiUtils = utils;

// API версия
export const API_VERSION = 'v1.0.0';

// Единая точка доступа к API
export default {
  auth: authApi,
  menu: menuApi,
  orders: ordersApi,
  waiter: waiterApi, 
  settings: settingsApi,
  reservations: reservationsApi,
  admin: adminApi,
  utils
}; 