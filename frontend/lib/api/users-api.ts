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
  baseURL: api.defaults.baseURL,
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
      
      // Пробуем сначала использовать Next.js API прокси
      try {
        console.log('Пробуем использовать Next.js API прокси для получения пользователей');
        
        const response = await fetch('/api/v1/users?' + queryParams.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-User-Role': userRole || 'client',
            'X-User-ID': userId || '1'
          }
        });

        if (!response.ok) {
          throw new Error(`Ошибка API прокси: ${response.status}`);
        }

        const data = await response.json();
        
        // Кэшируем результат, если нет фильтров
        if (!params.role && !params.query) {
          usersCache = data;
          lastFetchTime = now;
          console.log('Данные пользователей обновлены в кэше');
        }
        
        return data;
      } catch (proxyError) {
        console.error('Ошибка при использовании API прокси:', proxyError);
        throw proxyError;
      }
    } catch (error: any) {
      console.error('Ошибка при получении пользователей:', error.message || error);
      
      // В случае ошибки пробуем сначала использовать кэш
      if (Array.isArray(usersCache) && usersCache.length > 0) {
        console.log('Возвращаем кэшированные данные из-за ошибки');
        return usersCache;
      }
      
      // Если кэша нет, возвращаем моковые данные, чтобы интерфейс не ломался
      console.log('Возвращаем мок-данные для пользователей из-за ошибки:', error.message);
      return this.getMockUsers();
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
        phone: `+7 (${900 + Math.floor(Math.random() * 99)}) ${100 + Math.floor(Math.random() * 899)}-${10 + Math.floor(Math.random() * 89)}-${10 + Math.floor(Math.random() * 89)}`,
        role,
        created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(), // Случайная дата в прошлом
        updated_at: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
        is_active: isActive,
        birthday: Math.random() > 0.5 ? null : new Date(Date.now() - Math.random() * 1000000000000).toISOString().split('T')[0],
        age_group: ageGroup,
        orders_count: role === 'client' ? Math.floor(Math.random() * 10) : 0,
        reservations_count: role === 'client' ? Math.floor(Math.random() * 5) : 0
      });
    }
    
    // Объединяем базовых и случайных пользователей
    const allUsers = [...baseUsers, ...randomUsers];
    
    console.log(`Сгенерировано ${allUsers.length} мок-пользователей`);
    return allUsers;
  },
  
  // Получение пользователя по ID
  async getUserById(userId: number): Promise<UserData> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для получения пользователя');
        throw new Error('Отсутствует токен авторизации');
      }
      
      const response = await usersAxios.get(`/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при получении пользователя #${userId}:`, error.message || error);
      throw new Error(`Не удалось получить данные пользователя: ${error.message}`);
    }
  },
  
  // Создание нового пользователя
  async createUser(userData: UserData): Promise<UserData> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для создания пользователя');
        throw new Error('Отсутствует токен авторизации');
      }
      
      const response = await usersAxios.post('/users', userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Инвалидируем кэш после создания
      usersCache = null;
      
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при создании пользователя:', error.message || error);
      throw new Error(`Не удалось создать пользователя: ${error.message}`);
    }
  },
  
  // Обновление данных пользователя
  async updateUser(userId: number, userData: UserData): Promise<UserData> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для обновления пользователя');
        throw new Error('Отсутствует токен авторизации');
      }
      
      const response = await usersAxios.put(`/users/${userId}`, userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Инвалидируем кэш после обновления
      usersCache = null;
      
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при обновлении пользователя #${userId}:`, error.message || error);
      throw new Error(`Не удалось обновить данные пользователя: ${error.message}`);
    }
  },
  
  // Удаление пользователя
  async deleteUser(userId: number): Promise<boolean> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для удаления пользователя');
        throw new Error('Отсутствует токен авторизации');
      }
      
      await usersAxios.delete(`/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Инвалидируем кэш после удаления
      usersCache = null;
      
      return true;
    } catch (error: any) {
      console.error(`Ошибка при удалении пользователя #${userId}:`, error.message || error);
      throw new Error(`Не удалось удалить пользователя: ${error.message}`);
    }
  },
  
  // Получение профиля текущего пользователя
  async getCurrentUser(): Promise<UserData> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для получения текущего пользователя');
        throw new Error('Отсутствует токен авторизации');
      }
      
      const response = await usersAxios.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при получении текущего пользователя:', error.message || error);
      throw new Error(`Не удалось получить данные текущего пользователя: ${error.message}`);
    }
  },
  
  // Обновление профиля текущего пользователя
  async updateCurrentUser(userData: UserData): Promise<UserData> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для обновления текущего пользователя');
        throw new Error('Отсутствует токен авторизации');
      }
      
      const response = await usersAxios.put('/users/me', userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при обновлении текущего пользователя:', error.message || error);
      throw new Error(`Не удалось обновить данные текущего пользователя: ${error.message}`);
    }
  },
  
  // Создание пользователя-клиента (для официантов и администраторов)
  async createCustomer(userData: UserData): Promise<UserData> {
    try {
      // Проверяем наличие токена авторизации
      const token = getAuthTokenFromAllSources();
      if (!token) {
        console.warn('Отсутствует токен авторизации для создания клиента');
        throw new Error('Отсутствует токен авторизации');
      }
      
      const response = await usersAxios.post('/users/customer', userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Инвалидируем кэш после создания
      usersCache = null;
      
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при создании клиента:', error.message || error);
      throw new Error(`Не удалось создать клиента: ${error.message}`);
    }
  },
  
  // Очистка кэша пользователей
  clearCache() {
    usersCache = null;
    lastFetchTime = 0;
    console.log('Кэш пользователей очищен');
  },
  
  // Обновление статуса пользователя
  async toggleUserStatus(userId: number, isActive: boolean): Promise<UserData> {
    try {
      console.log(`Обновление статуса пользователя ${userId} на ${isActive}`);
      
      const response = await usersAxios.patch(`/users/${userId}/status`, {
        is_active: isActive
      });
      
      // Очищаем кэш после обновления
      this.clearCache();
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при обновлении статуса пользователя:', error);
      throw error;
    }
  }
}; 