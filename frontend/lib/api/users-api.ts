import { api, getAuthHeaders, getAuthTokenFromAllSources } from './core';
import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

interface UserParams {
  role?: string;
  query?: string;
  page?: number;
  limit?: number;
  skip?: number;
}

export interface UserData {
  id?: number;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
  birthday?: string | null;
  age_group?: string | null;
  password?: string;
  created_at?: string;
  updated_at?: string;
  orders_count?: number;
  reservations_count?: number;
}

// Кэш пользователей для уменьшения числа запросов
let usersCache: UserData[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 минута

// Создаем экземпляр axios для пользовательских запросов
const usersAxios = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL?.replace('http://', 'https://') || 'https://backend-production-1a78.up.railway.app',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Получение информации о пользователе из локального хранилища
const getUserRole = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Сначала пробуем получить из localStorage/sessionStorage
    const roleFromStorage = localStorage.getItem('user_role') || sessionStorage.getItem('user_role');
    if (roleFromStorage) return roleFromStorage;
    
    // Если не нашли, попробуем извлечь из токена
    const userData = getUserDataFromToken();
    if (userData && userData.role) return userData.role;
    
    // Дефолтное значение
    return 'client';
  } catch (e) {
    console.error('Ошибка при получении роли пользователя:', e);
    return 'client';
  }
};

// Получение ID пользователя из локального хранилища или из токена
const getUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Сначала пробуем получить из localStorage/sessionStorage
    const userIdFromStorage = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
    if (userIdFromStorage) return userIdFromStorage;
    
    // Если не нашли, попробуем извлечь из токена
    const userData = getUserDataFromToken();
    if (userData && userData.sub) return String(userData.sub);
    
    // Дефолтное значение
    return '1';
  } catch (e) {
    console.error('Ошибка при получении ID пользователя:', e);
    return '1';
  }
};

// Получение данных пользователя из JWT токена
const getUserDataFromToken = (): any => {
  try {
    const token = getAuthTokenFromAllSources();
    if (!token) return null;
    
    // Декодируем JWT токен
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    // Парсим данные и возвращаем
    const userData = JSON.parse(jsonPayload);
    console.log('Данные извлечены из токена:', userData);
    return userData;
  } catch (e) {
    console.error('Ошибка при декодировании токена:', e);
    return null;
  }
};

// Добавляем перехватчик для авторизации
usersAxios.interceptors.request.use((config) => {
  // Получаем токен из всех возможных источников
  const token = getAuthTokenFromAllSources();
  
  // Добавляем заголовок авторизации, если токен есть
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
    
    // Добавляем информацию о пользователе в заголовки
    const role = getUserRole();
    const userId = getUserId();
    
    if (role) config.headers['X-User-Role'] = role;
    if (userId) config.headers['X-User-ID'] = userId;
    
    console.log(`Добавлены заголовки авторизации: токен, роль=${role}, id=${userId}`);
  } else {
    console.warn('Токен авторизации не найден');
  }
  
  return config;
}, (error) => {
  console.error('Ошибка при настройке запроса:', error);
  return Promise.reject(error);
});

// Добавляем перехватчик ответов
usersAxios.interceptors.response.use(
  (response: AxiosResponse) => {
    // Для успешных ответов
    console.log(`Успешный ответ от ${response.config.url}:`, {
      status: response.status,
      headers: response.headers
    });
    return response;
  },
  (error: AxiosError) => {
    // Для ошибок
    if (error.response) {
      console.error(`Ошибка ${error.response.status} при запросе ${error.config?.url}:`, 
        error.response.data || error.message);
      
      // Проверка на ошибку авторизации
      if (error.response.status === 401) {
        console.warn('Ошибка авторизации! Заголовки запроса:', error.config?.headers);
        
        // Удаляем кэш пользователей при ошибке авторизации
        usersCache = null;
        lastFetchTime = 0;
      }
    } else if (error.request) {
      console.error('Ошибка сети - ответ не получен:', error.message);
    } else {
      console.error('Ошибка при настройке запроса:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// API для работы с пользователями
export const usersApi = {
  // Получение списка пользователей с фильтрацией
  async getUsers(params: UserParams = {}): Promise<UserData[]> {
    try {
      console.log('Запрос пользователей с параметрами:', params);
      
      // Проверяем, есть ли кэш и не истек ли он
      const now = Date.now();
      if (usersCache && (now - lastFetchTime < CACHE_TTL) && !params.role && !params.query) {
        console.log('Используем кэшированные данные пользователей');
        return usersCache;
      }
      
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      console.log('Токен авторизации:', token ? 'Присутствует' : 'Отсутствует');
      
      // Строим параметры запроса
      const queryParams = new URLSearchParams();
      if (params.skip) queryParams.append('skip', params.skip.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.role) queryParams.append('role', params.role);
      if (params.query) queryParams.append('query', params.query);
      
      // Получаем роль и ID пользователя
      const userRole = getUserRole();
      const userId = getUserId();
      
      try {
        // Формируем URL с учетом параметров
        const url = `/api/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        console.log('Отправка запроса на:', url);
        
        const response = await usersAxios.get(url, {
          headers: {
            ...getAuthHeaders(),
            'X-User-Role': userRole || 'client',
            'X-User-ID': userId || '1'
          }
        });
        
        if (response.data) {
          // Кэшируем результат только если нет фильтров
          if (!params.role && !params.query) {
            usersCache = response.data;
            lastFetchTime = now;
          }
          return response.data;
        }
        
        throw new Error('Пустой ответ от сервера');
      } catch (error: any) {
        console.error('Ошибка при получении пользователей:', error);
        
        // Если ошибка 404, возвращаем пустой массив
        if (error.response?.status === 404) {
          console.log('Пользователи не найдены, возвращаем пустой массив');
          return [];
        }
        
        // Если ошибка авторизации, пробуем использовать кэш
        if (error.response?.status === 401 && usersCache) {
          console.log('Ошибка авторизации, используем кэшированные данные');
          return usersCache;
        }
        
        throw new Error(`Ошибка при получении списка пользователей: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Критическая ошибка при получении пользователей:', error);
      
      // В случае критической ошибки возвращаем пустой массив
      return [];
    }
  },
  
  // Получаем мок-данные пользователей для тестирования интерфейса
  getMockUsers(): UserData[] {
    console.log('Генерация мок-данных пользователей');
    
    // Базовые пользователи, которые всегда присутствуют в мок-данных
    const baseUsers = [
      {
        id: 1,
        full_name: 'Администратор Системы',
        email: 'admin@example.com',
        phone: '+7 (999) 123-45-67',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        birthday: null,
        age_group: null
      },
      {
        id: 2,
        full_name: 'Иван Петров',
        email: 'user@example.com',
        phone: '+7 (999) 765-43-21',
        role: 'client',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        birthday: null,
        age_group: 'MIDDLE'
      },
      {
        id: 3,
        full_name: 'Официант Сергей',
        email: 'waiter@example.com',
        phone: '+7 (999) 111-22-33',
        role: 'waiter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        birthday: null,
        age_group: 'YOUNG'
      }
    ];
    
    // Генерируем дополнительных случайных пользователей
    const roles = ['admin', 'client', 'waiter'];
    const ageGroups = ['YOUNG', 'MIDDLE', 'OLD', null];
    const randomUsers = [];
    
    // Добавляем от 5 до 10 случайных пользователей
    const additionalUsersCount = Math.floor(Math.random() * 5) + 5;
    
    for (let i = 0; i < additionalUsersCount; i++) {
      const id = baseUsers.length + i + 1;
      const role = roles[Math.floor(Math.random() * roles.length)];
      const isActive = Math.random() > 0.2; // 80% шанс, что пользователь активен
      const ageGroup = ageGroups[Math.floor(Math.random() * ageGroups.length)];
      
      randomUsers.push({
        id,
        full_name: `Тестовый ${role === 'admin' ? 'Админ' : role === 'waiter' ? 'Официант' : 'Клиент'} ${id}`,
        email: `test${id}@example.com`,
        phone: `+7 (999) ${Math.floor(Math.random() * 1000) + 100}-${Math.floor(Math.random() * 100) + 10}-${Math.floor(Math.random() * 100) + 10}`,
        role,
        is_active: isActive,
        birthday: null,
        age_group: ageGroup
      });
    }
    
    return randomUsers;
  }
};