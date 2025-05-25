import axios, { AxiosError } from 'axios';
import { LoginCredentials, RegisterCredentials, LoginResponse, User } from '../types/auth';
import { getToken } from '../utils/auth';

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
interface ServerLoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authApi = {
  // Авторизация пользователя
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Попытка входа', { email: credentials.email });
      
      const response = await api.post<LoginResponse>('/auth/login', credentials);
      
      console.log('Auth API: Успешный вход', { 
        status: response.status,
        hasToken: !!response.data.access_token,
        role: response.data.user?.role 
      });

      return response.data;
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
      const response = await api.post<LoginResponse>('/auth/register', credentials);
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
      const response = await api.get<User>('/users/me');
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
      await api.post('/auth/logout');
      console.log('Auth API: Успешный выход');
    } catch (error: any) {
      console.error('Auth API: Ошибка выхода', error.response?.data || error.message);
      // Даже если запрос не удался, мы все равно разлогиниваем пользователя локально
    }
  }
}; 