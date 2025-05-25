import axios, { AxiosError } from 'axios';
import { LoginCredentials, RegisterCredentials, LoginResponse, User, UserRole } from '../types/auth';
import { getToken, saveToken, saveUser } from '../utils/auth';
import { api as apiClient } from './core';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';

// Создаем тип для ошибки сервера
interface ServerError extends Error {
  response?: {
    data: {
      message?: string;
      detail?: string;
    };
    status: number;
  };
}

// Создаем экземпляр axios с базовой конфигурацией
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Добавляем перехватчик для установки токена
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Добавляем перехватчик для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.data) {
      const serverError = new Error(
        (error.response.data as any).message || 
        (error.response.data as any).detail || 
        'Ошибка сервера'
      ) as ServerError;
      serverError.response = {
        data: error.response.data as any,
        status: error.response.status
      };
      return Promise.reject(serverError);
    }
    return Promise.reject(error);
  }
);

// Определяем интерфейс для API аутентификации
interface IAuthApi {
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (credentials: RegisterCredentials) => Promise<LoginResponse>;
  getProfile: () => Promise<User>;
  logout: () => Promise<void>;
}

export const authApi: IAuthApi = {
  // Авторизация пользователя
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Начало процесса входа', { 
        email: credentials.email,
        hasPassword: !!credentials.password
      });

      // Отправляем запрос на сервер
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        })
      });

      // Получаем и парсим ответ
      const rawData = await response.json();

      console.log('API login - Сырые данные от сервера:', rawData);

      // Проверяем успешность запроса
      if (!response.ok) {
        console.error('API login - Ошибка запроса:', {
          status: response.status,
          data: rawData
        });
        throw new Error(rawData.detail || rawData.message || 'Ошибка авторизации');
      }

      // Проверяем структуру данных
      if (!rawData || typeof rawData !== 'object') {
        console.error('API login - Неверный формат данных:', rawData);
        throw new Error('Неверный формат ответа от сервера');
      }

      // Проверяем наличие токена в разных возможных местах
      const accessToken = rawData.access_token || rawData.accessToken || rawData.token || (rawData.data && rawData.data.access_token);
      
      if (!accessToken) {
        console.error('API login - Токен не найден в ответе:', rawData);
        throw new Error('Токен не найден в ответе сервера');
      }

      // Проверяем наличие данных пользователя в разных возможных местах
      const userData = rawData.user || rawData.data?.user || rawData;

      // Формируем объект ответа в соответствии с типом LoginResponse
      const data: LoginResponse = {
        access_token: accessToken,
        token_type: rawData.token_type || 'bearer',
        user: {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name || userData.fullName || userData.name || '',
          role: userData.role || 'client',
          is_active: userData.is_active ?? true,
          created_at: userData.created_at || userData.createdAt || new Date().toISOString(),
          updated_at: userData.updated_at || userData.updatedAt || new Date().toISOString()
        },
        detail: rawData.detail,
        message: rawData.message
      };

      console.log('API login - Преобразованные данные:', {
        hasToken: !!data.access_token,
        hasUser: !!data.user,
        userData: data.user
      });

      // Проверяем наличие необходимых данных
      if (!data.access_token || !data.user) {
        console.error('Auth API: Отсутствуют необходимые данные в ответе', {
          hasToken: !!data.access_token,
          hasUser: !!data.user,
          data: JSON.stringify(data)
        });
        throw new Error('Неверный формат ответа от сервера');
      }

      // Сохраняем данные
      console.log('Auth API: Сохранение данных авторизации');
      saveToken(data.access_token);
      saveUser(data.user);

      console.log('Auth API: Успешный вход', {
        hasToken: !!data.access_token,
        hasUser: !!data.user,
        role: data.user.role,
        email: data.user.email
      });

      return data;
    } catch (error) {
      console.error('Auth API: Ошибка входа', error);
      throw error;
    }
  },

  // Регистрация пользователя
  register: async (credentials: RegisterCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Попытка регистрации', { email: credentials.email });
      const response = await apiClient.post<LoginResponse>('/auth/register', credentials);
      
      if (response.data.access_token && response.data.user) {
        saveToken(response.data.access_token);
        saveUser(response.data.user);
      }
      
      console.log('Auth API: Успешная регистрация', { 
        hasToken: !!response.data.access_token,
        hasUser: !!response.data.user,
        role: response.data.user?.role 
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Auth API: Ошибка регистрации', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Ошибка регистрации');
    }
  },

  // Получение профиля пользователя
  getProfile: async (): Promise<User> => {
    try {
      console.log('Auth API: Запрос профиля пользователя');
      const response = await apiClient.get<User>('/users/me');
      
      if (response.data) {
        saveUser(response.data);
      }
      
      console.log('Auth API: Профиль получен', { 
        hasData: !!response.data,
        role: response.data?.role 
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Auth API: Ошибка получения профиля', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Ошибка получения профиля');
    }
  },

  // Выход из системы
  logout: async (): Promise<void> => {
    try {
      console.log('Auth API: Попытка выхода');
      await apiClient.post('/auth/logout');
      localStorage.clear();
      sessionStorage.clear();
      console.log('Auth API: Успешный выход');
    } catch (error: any) {
      console.error('Auth API: Ошибка выхода', error.response?.data || error.message);
      // Даже если запрос не удался, очищаем локальное хранилище
      localStorage.clear();
      sessionStorage.clear();
    }
  }
}; 