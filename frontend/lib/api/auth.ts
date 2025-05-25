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

      // Отправляем запрос через прокси
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
      const data = await response.json();

      console.log('Auth API: Получен ответ от сервера', {
        status: response.status,
        ok: response.ok,
        hasData: !!data,
        hasToken: !!data?.access_token,
        hasUser: !!data?.user
      });

      // Проверяем успешность запроса
      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Ошибка авторизации');
      }

      // Проверяем наличие необходимых данных
      if (!data.access_token || !data.user) {
        console.error('Auth API: Отсутствуют необходимые данные в ответе', {
          hasToken: !!data.access_token,
          hasUser: !!data.user,
          data: JSON.stringify({
            ...data,
            access_token: data.access_token ? '***' : undefined
          })
        });
        throw new Error('Неверный формат ответа от сервера');
      }

      // Проверяем обязательные поля пользователя
      if (!data.user.email || !data.user.role) {
        console.error('Auth API: Неполные данные пользователя', {
          user: {
            ...data.user,
            email: data.user.email ? '***' : undefined
          }
        });
        throw new Error('Неполные данные пользователя в ответе сервера');
      }

      // Формируем объект ответа
      const loginResponse: LoginResponse = {
        access_token: data.access_token,
        token_type: data.token_type || 'bearer',
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.full_name,
          role: data.user.role,
          is_active: data.user.is_active,
          created_at: data.user.created_at || new Date().toISOString(),
          updated_at: data.user.updated_at || new Date().toISOString()
        }
      };

      // Сохраняем данные
      console.log('Auth API: Сохранение данных авторизации');
      saveToken(loginResponse.access_token);
      saveUser(loginResponse.user);

      console.log('Auth API: Успешный вход', {
        hasToken: !!loginResponse.access_token,
        hasUser: !!loginResponse.user,
        role: loginResponse.user.role,
        email: loginResponse.user.email
      });

      return loginResponse;
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