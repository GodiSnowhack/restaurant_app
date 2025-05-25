import axios from 'axios';
import { LoginCredentials, RegisterCredentials, LoginResponse, User } from '../types/auth';
import { getToken } from '../utils/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';

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

// Определяем тип ответа от сервера
interface ServerLoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authApi = {
  // Авторизация пользователя
  login: async (credentials: LoginCredentials): Promise<{ access_token: string; token_type: string; user: User }> => {
    try {
      console.log('Auth API: Попытка входа', { email: credentials.email });
      const { data } = await api.post<{ access_token: string; token_type: string; user: User }>('/auth/login', credentials);

      console.log('Auth API: Успешный вход', { 
        status: 200,
        hasToken: !!data.access_token,
        role: data.user?.role 
      });

      return data;
    } catch (error: any) {
      console.error('Auth API: Ошибка входа', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Ошибка авторизации');
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