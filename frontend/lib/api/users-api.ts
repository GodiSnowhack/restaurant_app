import { api, getAuthHeaders, getAuthTokenFromAllSources } from './core';
import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { getSecureApiUrl } from '../utils/api';

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
let usersCache: UserData[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 минута

// Создаем экземпляр axios для пользовательских запросов
const usersAxios = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1',
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
usersAxios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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
        usersCache = [];
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
      
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.error('Отсутствует токен авторизации');
        return [];
      }
      
      // Получаем роль пользователя
      const userRole = getUserRole();
      if (userRole !== 'admin') {
        console.error('Недостаточно прав для просмотра списка пользователей');
        return [];
      }

      // Строим параметры запроса
      const queryParams = new URLSearchParams();
      if (params.role) queryParams.append('role', params.role);
      if (params.query) queryParams.append('search', params.query);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.skip) queryParams.append('offset', params.skip.toString());

      // Проверяем кэш
      const now = Date.now();
      if (usersCache && (now - lastFetchTime < CACHE_TTL)) {
        console.log('Возвращаем пользователей из кэша');
        return usersCache;
      }

      try {
        console.log('Отправка запроса на получение пользователей...');
        
        // Формируем URL с учетом параметров
        const url = `${getSecureApiUrl()}/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        console.log('URL запроса:', url);
        
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-User-Role': userRole,
            'X-User-ID': getUserId() || '1',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.data) {
          console.error('Получен пустой ответ от сервера');
          return [];
        }

        // Преобразуем данные в нужный формат
        const users = Array.isArray(response.data) ? response.data : response.data.items || [];
        console.log(`Получено ${users.length} пользователей`);
        
        // Обновляем кэш
        usersCache = users.map((user: any) => ({
          id: user.id,
          full_name: user.full_name || user.name || 'Без имени',
          email: user.email,
          phone: user.phone || null,
          role: user.role || 'client',
          is_active: user.is_active ?? true,
          created_at: user.created_at || new Date().toISOString(),
          updated_at: user.updated_at || new Date().toISOString(),
          birthday: user.birthday || null,
          age_group: user.age_group || null,
          orders_count: user.orders_count || 0,
          reservations_count: user.reservations_count || 0
        }));
        lastFetchTime = now;
        
        return usersCache;
      } catch (error: any) {
        console.error('Ошибка при получении списка пользователей:', error);
        
        // Если сервер недоступен или другая ошибка - возвращаем моковые данные
        if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
          console.log('Сервер недоступен, используем моковые данные');
          return this.getMockUsers();
        }
        
        throw error;
      }
    } catch (error: any) {
      console.error('Ошибка при обработке запроса пользователей:', error);
      return [];
    }
  },
  
  // Получаем мок-данные пользователей для тестирования интерфейса
  getMockUsers(): UserData[] {
    console.log('Генерация мок-данных пользователей');
    
    return [
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
        age_group: null,
        orders_count: 0,
        reservations_count: 0
      },
      {
        id: 2,
        full_name: 'Иван Петров',
        email: 'ivan@example.com',
        phone: '+7 (999) 234-56-78',
        role: 'client',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        birthday: '1990-01-01',
        age_group: 'MIDDLE',
        orders_count: 5,
        reservations_count: 3
      },
      {
        id: 3,
        full_name: 'Мария Сидорова',
        email: 'maria@example.com',
        phone: '+7 (999) 345-67-89',
        role: 'waiter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        birthday: '1995-05-15',
        age_group: 'YOUNG',
        orders_count: 150,
        reservations_count: 0
      },
      {
        id: 4,
        full_name: 'Алексей Николаев',
        email: 'alex@example.com',
        phone: '+7 (999) 456-78-90',
        role: 'client',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: false,
        birthday: '1975-12-31',
        age_group: 'OLD',
        orders_count: 2,
        reservations_count: 1
      }
    ];
  },

  // Получение пользователя по ID
  async getUserById(userId: number): Promise<UserData> {
    try {
      const url = `${getSecureApiUrl()}/users/${userId}`;
      const response = await axios.get(url, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при получении пользователя #${userId}:`, error);
      throw new Error(`Не удалось получить данные пользователя: ${error.message}`);
    }
  },

  // Обновление данных пользователя
  async updateUser(userId: number, userData: Partial<UserData>): Promise<UserData> {
    try {
      const url = `${getSecureApiUrl()}/users/${userId}`;
      const response = await axios.put(url, userData, {
        headers: getAuthHeaders()
      });
      
      // Инвалидируем кэш после обновления
      usersCache = [];
      lastFetchTime = 0;
      
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при обновлении пользователя #${userId}:`, error);
      throw new Error(`Не удалось обновить данные пользователя: ${error.message}`);
    }
  },

  // Удаление пользователя
  async deleteUser(userId: number): Promise<boolean> {
    try {
      const url = `${getSecureApiUrl()}/users/${userId}`;
      await axios.delete(url, {
        headers: getAuthHeaders()
      });
      
      // Инвалидируем кэш после удаления
      usersCache = [];
      lastFetchTime = 0;
      
      return true;
    } catch (error: any) {
      console.error(`Ошибка при удалении пользователя #${userId}:`, error);
      throw new Error(`Не удалось удалить пользователя: ${error.message}`);
    }
  },

  // Создание нового пользователя
  async createUser(userData: UserData): Promise<UserData> {
    try {
      const url = `${getSecureApiUrl()}/users`;
      const response = await axios.post(url, userData, {
        headers: getAuthHeaders()
      });
      
      // Инвалидируем кэш после создания
      usersCache = [];
      lastFetchTime = 0;
      
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при создании пользователя:', error);
      throw new Error(`Не удалось создать пользователя: ${error.message}`);
    }
  },

  // Обновление статуса пользователя
  async toggleUserStatus(userId: number, isActive: boolean): Promise<UserData> {
    try {
      console.log(`Обновление статуса пользователя ${userId} на ${isActive}`);
      const response = await usersAxios.patch(`/users/${userId}/status`, {
        is_active: isActive
      });
      
      // Инвалидируем кэш после обновления
      usersCache = [];
      lastFetchTime = 0;
      
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при обновлении статуса пользователя:', error);
      throw new Error(`Не удалось обновить статус пользователя: ${error.message}`);
    }
  },

  // Очистка кэша
  clearCache() {
    usersCache = [];
    lastFetchTime = 0;
    console.log('Кэш пользователей очищен');
  }
}; 