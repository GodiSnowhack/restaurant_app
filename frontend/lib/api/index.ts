// Импорты необходимых API модулей
import { api, API_URL, getAuthToken, clearAuthTokens, isTokenExpired, retryRequest, checkConnection, isMobileDevice, fetchWithTimeout, getAuthHeaders } from './core';
import { authApi } from './auth';
import { menuApi } from './menu';
import type { Category, Dish } from '@/types';
import waiterApi from './waiter';
import { settingsApi } from './settings';
import { reservationsApi, Reservation } from './reservations';
import adminApi from './admin-api';
import { usersApi, UserData } from './users-api';
import {
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  UserProfile,
  FileUploadResponse,
  DashboardStats,
  Order,
  OrderItem,
  WorkingHours,
  WorkingHoursItem,
  RestaurantTable
} from './types';

// Определения типов для аналитики
export interface FinancialMetrics {
  totalRevenue: number;
  averageCheck: number;
  salesByPeriod: Array<{date: string; revenue: number}>;
  [key: string]: any;
}

export interface MenuMetrics {
  popularItems: Array<{name: string; count: number; revenue: number}>;
  categorySales: Array<{category: string; count: number; revenue: number}>;
  [key: string]: any;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  customersByAgeGroup: Array<{ageGroup: string; count: number}>;
  [key: string]: any;
}

export interface OperationalMetrics {
  averageServiceTime: number;
  peakHours: Array<{hour: number; count: number}>;
  tableUtilization: number;
  [key: string]: any;
}

export interface PredictiveMetrics {
  forecastRevenue: number;
  forecastOrders: number;
  nextWeekForecast: Array<{date: string; revenue: number; orders: number}>;
  [key: string]: any;
}

// Создаем заглушку для analyticsApi
const analyticsApi = {
  getFinancialMetrics: async () => ({
    totalRevenue: 348000,
    averageCheck: 2500,
    salesByPeriod: [
      {date: "2023-10-01", revenue: 12000},
      {date: "2023-10-02", revenue: 15000},
      {date: "2023-10-03", revenue: 18000}
    ]
  } as FinancialMetrics),
  
  getMenuMetrics: async () => ({
    popularItems: [
      {name: "Стейк рибай", count: 45, revenue: 67500},
      {name: "Карбонара", count: 38, revenue: 38000},
      {name: "Тирамису", count: 56, revenue: 28000}
    ],
    categorySales: [
      {category: "Горячие блюда", count: 145, revenue: 217500},
      {category: "Десерты", count: 98, revenue: 49000}
    ]
  } as MenuMetrics),
  
  getCustomerMetrics: async () => ({
    totalCustomers: 250,
    newCustomers: 45,
    returningCustomers: 205,
    customersByAgeGroup: [
      {ageGroup: "18-24", count: 45},
      {ageGroup: "25-34", count: 85},
      {ageGroup: "35-44", count: 65}
    ]
  } as CustomerMetrics),
  
  getOperationalMetrics: async () => ({
    averageServiceTime: 25,
    peakHours: [
      {hour: 12, count: 25},
      {hour: 13, count: 32},
      {hour: 19, count: 40}
    ],
    tableUtilization: 75
  } as OperationalMetrics),
  
  getPredictiveMetrics: async () => ({
    forecastRevenue: 129000,
    forecastOrders: 18000,
    nextWeekForecast: [
      {date: "2023-10-15", revenue: 18000, orders: 72},
      {date: "2023-10-16", revenue: 15000, orders: 60},
      {date: "2023-10-17", revenue: 21000, orders: 84}
    ]
  } as PredictiveMetrics),
  
  getDashboardStats: async () => ({}),
  getTopDishes: async () => ([]),
  getSalesStatistics: async () => ([]),
  getRevenueByCategory: async () => ([])
};

// Функция-заглушка для генерации кода официанта
const generateWaiterCode = async (orderId: number) => {
  console.log('Функция generateWaiterCode была перемещена в другой модуль');
  return { success: false, message: 'Функция перемещена. Обновите импорты.' };
};

// Функция-заглушка для назначения официанта
const assignOrderByCode = async (code: string) => {
  console.log('Функция assignOrderByCode была перемещена в другой модуль');
  return { success: false, message: 'Функция перемещена. Обновите импорты.' };
};

// Функция-заглушка для назначения официанта к заказу
const assignWaiterToOrder = async (code: string) => {
  return assignOrderByCode(code);
};

// API версия
export const API_VERSION = 'v1.0.0';

// Экспорты
export { 
  api, 
  API_URL, 
  authApi,
  menuApi,
  waiterApi,
  settingsApi,
  reservationsApi,
  adminApi,
  usersApi,
  analyticsApi,
  getAuthToken, 
  clearAuthTokens, 
  isTokenExpired,
  retryRequest,
  checkConnection,
  isMobileDevice,
  fetchWithTimeout,
  getAuthHeaders,
  assignOrderByCode,
  assignWaiterToOrder,
  generateWaiterCode
};

// Экспорт типов
export type {
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  UserProfile,
  FileUploadResponse,
  DashboardStats,
  Category,
  Dish,
  Order,
  OrderItem,
  Reservation,
  WorkingHours,
  WorkingHoursItem,
  RestaurantTable,
  UserData
};

// Единая точка доступа к API
export default {
  auth: authApi,
  menu: menuApi,
  waiter: waiterApi, 
  settings: settingsApi,
  reservations: reservationsApi,
  admin: adminApi,
  users: usersApi,
  analytics: analyticsApi,
  version: API_VERSION
}; 