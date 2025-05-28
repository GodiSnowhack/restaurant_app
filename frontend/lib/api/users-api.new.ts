import { api, getAuthHeaders, getAuthTokenFromAllSources } from './core';
import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { getSecureApiUrl, createApiUrl } from '../utils/api';
import { getDefaultApiUrl } from '../../src/config/defaults';

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
  baseURL: getDefaultApiUrl(), // Используем полный URL до бэкенда вместо относительного пути
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000 // 10 секунд таймаут
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
      
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.error('Отсутствует токен авторизации');
        return this.getMockUsers();
      }
      
      // Получаем роль пользователя
      const userRole = getUserRole();
      if (userRole !== 'admin') {
        console.error('Недостаточно прав для просмотра списка пользователей');
        return this.getMockUsers();
      }

      // Строим параметры запроса
      const queryParams = new URLSearchParams();
      if (params.role) queryParams.append('role', params.role);
      if (params.query) queryParams.append('search', params.query);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.skip) queryParams.append('offset', params.skip.toString());

      // В режиме разработки используем моковые данные
      if (process.env.NODE_ENV === 'development') {
        console.log('Используем моковые данные в режиме разработки');
        return this.getMockUsers();
      }

      // Проверяем, есть ли данные в кэше и не устарели ли они
      const now = Date.now();
      if (usersCache && (now - lastFetchTime < CACHE_TTL)) {
        console.log('Возвращаем данные из кэша');
        return usersCache;
      }

      try {
        console.log('Отправка запроса на получение пользователей...');
        
        // Стратегия 1: Используем Next.js API роут для прокси запроса
        try {
          console.log('Пробуем получить данные через Next.js API роут');
          const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': token
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            if (Array.isArray(data) && data.length > 0) {
              console.log('Получены данные через Next.js API роут');
              
              // Форматируем и кэшируем результат
              const formattedUsers = data.map((user: any) => ({
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
              
              // Обновляем кэш
              usersCache = formattedUsers;
              lastFetchTime = now;
              
              return formattedUsers;
            }
          } else {
            console.warn('Не удалось получить данные через Next.js API роут', response.status);
          }
        } catch (apiRouteError) {
          console.error('Ошибка при запросе через Next.js API роут:', apiRouteError);
        }
        
        // Стратегия 2: Пробуем прямой запрос к API бэкенда
        try {
          console.log('Пробуем прямой запрос к API бэкенда');
          const apiUrl = `${getDefaultApiUrl()}/users/`;
          
          const response = await axios.get(apiUrl, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            timeout: 8000,
            maxRedirects: 5
          });
          
          if (response.status < 400 && response.data) {
            console.log('Получены данные через прямой запрос к API');
            
            // Обрабатываем различные форматы ответа
            let users: any[] = [];
            
            if (Array.isArray(response.data)) {
              users = response.data;
            } else if (response.data && typeof response.data === 'object') {
              users = response.data.items || response.data.users || response.data.data || [];
            }
            
            if (Array.isArray(users) && users.length > 0) {
              // Форматируем и кэшируем результат
              const formattedUsers = users.map((user: any) => ({
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
              
              // Обновляем кэш
              usersCache = formattedUsers;
              lastFetchTime = now;
              
              return formattedUsers;
            }
          }
        } catch (directApiError) {
          console.error('Ошибка при прямом запросе к API:', directApiError);
        }
        
        // Стратегия 3: Используем моковые данные в случае ошибок
        console.log('Все стратегии запроса данных не сработали, используем моковые данные');
        return this.getMockUsers();
        
      } catch (error: any) {
        console.error('Ошибка при получении списка пользователей:', error);
        console.log('Сервер недоступен, используем моковые данные');
        return this.getMockUsers();
      }
    } catch (error: any) {
      console.error('Критическая ошибка при получении пользователей:', error);
      return this.getMockUsers();
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
      const token = getAuthTokenFromAllSources();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const apiUrl = `${getDefaultApiUrl()}/users/${userId}/`;
      console.log(`Запрос пользователя по ID ${userId}, URL: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      const userData = response.data;
      console.log(`Получены данные пользователя #${userId}:`, userData);
      
      return {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name || userData.name || '',
        phone: userData.phone || null,
        role: userData.role || 'client',
        is_active: userData.is_active ?? true,
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString(),
        birthday: userData.birthday || null,
        age_group: userData.age_group || null,
        orders_count: userData.orders_count || 0,
        reservations_count: userData.reservations_count || 0
      };
    } catch (error: any) {
      console.error(`Ошибка при получении пользователя #${userId}:`, error);
      throw new Error(`Не удалось получить данные пользователя: ${error.message}`);
    }
  },

  // Обновление пользователя
  async updateUser(userId: number, userData: Partial<UserData>): Promise<UserData> {
    try {
      const token = getAuthTokenFromAllSources();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const apiUrl = `${getDefaultApiUrl()}/users/${userId}/`;
      console.log(`Обновление пользователя #${userId}, URL: ${apiUrl}`);
      
      const response = await axios.put(apiUrl, userData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      console.log(`Пользователь #${userId} успешно обновлен:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при обновлении пользователя #${userId}:`, error);
      throw new Error(`Не удалось обновить пользователя: ${error.message}`);
    }
  },

  // Удаление пользователя
  async deleteUser(userId: number): Promise<boolean> {
    try {
      const token = getAuthTokenFromAllSources();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const apiUrl = `${getDefaultApiUrl()}/users/${userId}/`;
      console.log(`Удаление пользователя #${userId}, URL: ${apiUrl}`);
      
      await axios.delete(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      // Инвалидируем кэш после удаления
      usersCache = null;
      lastFetchTime = 0;
      
      console.log(`Пользователь #${userId} успешно удален`);
      return true;
    } catch (error: any) {
      console.error(`Ошибка при удалении пользователя #${userId}:`, error);
      throw new Error(`Не удалось удалить пользователя: ${error.message}`);
    }
  },

  // Создание нового пользователя
  async createUser(userData: UserData): Promise<UserData> {
    try {
      const token = getAuthTokenFromAllSources();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const apiUrl = `${getDefaultApiUrl()}/users/`;
      console.log(`Создание нового пользователя, URL: ${apiUrl}`);
      
      const response = await axios.post(apiUrl, userData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      // Инвалидируем кэш после создания
      usersCache = null;
      lastFetchTime = 0;
      
      console.log(`Новый пользователь успешно создан:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при создании пользователя:', error);
      throw new Error(`Не удалось создать пользователя: ${error.message}`);
    }
  },

  // Обновление статуса пользователя
  async toggleUserStatus(userId: number, isActive: boolean): Promise<UserData> {
    try {
      const token = getAuthTokenFromAllSources();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const apiUrl = `${getDefaultApiUrl()}/users/${userId}/status/`;
      console.log(`Обновление статуса пользователя ${userId} на ${isActive}, URL: ${apiUrl}`);
      
      const response = await axios.patch(apiUrl, { is_active: isActive }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      // Инвалидируем кэш после обновления
      usersCache = null;
      lastFetchTime = 0;
      
      console.log(`Статус пользователя #${userId} успешно обновлен:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при обновлении статуса пользователя:', error);
      throw new Error(`Не удалось обновить статус пользователя: ${error.message}`);
    }
  },

  // Очистка кэша
  clearCache() {
    usersCache = null;
    lastFetchTime = 0;
    console.log('Кэш пользователей очищен');
  }
}; 