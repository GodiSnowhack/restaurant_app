import axios, { AxiosError } from 'axios';
import { LoginCredentials, RegisterCredentials, LoginResponse, User } from '../types/auth';
import { getToken } from '../utils/auth';
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
      // Если есть данные об ошибке от сервера, используем их
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
    // Если нет данных от сервера, возвращаем исходную ошибку
    return Promise.reject(error);
  }
);

// Определяем тип ответа от сервера
interface ServerLoginResponse extends LoginResponse {}

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
      console.log('Auth API: Попытка входа', { email: credentials.email });
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.message || 'Ошибка авторизации');
      }

      const data = await response.json();

      // Проверяем наличие всех необходимых данных
      if (!data.access_token || !data.user) {
        console.error('Auth API: Неверный формат ответа:', data);
        throw new Error('Неверный формат ответа от сервера');
      }

      // Создаем объект с правильной типизацией
      const loginResponse: LoginResponse = {
        access_token: data.access_token,
        token_type: data.token_type || 'bearer',
        user: data.user
      };
      
      console.log('Auth API: Успешный вход', { 
        status: response.status,
        hasToken: !!loginResponse.access_token,
        hasUser: !!loginResponse.user,
        role: loginResponse.user?.role 
      });

      return loginResponse;
    } catch (error) {
      const serverError = error as ServerError;
      console.error('Auth API: Ошибка входа', {
        status: serverError.response?.status,
        data: serverError.response?.data,
        message: serverError.message
      });
      throw serverError;
    }
  },

  // Регистрация пользователя
  register: async (credentials: RegisterCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Попытка регистрации', { email: credentials.email });
      const response = await apiClient.post<LoginResponse>('/auth/register', credentials);
      console.log('Auth API: Успешная регистрация', { status: response.status });
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
      console.log('Auth API: Профиль получен', { 
        status: response.status,
        role: response.data.role 
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
      console.log('Auth API: Успешный выход');
    } catch (error: any) {
      console.error('Auth API: Ошибка выхода', error.response?.data || error.message);
      // Даже если запрос не удался, мы все равно разлогиниваем пользователя локально
    }
  }
}; 