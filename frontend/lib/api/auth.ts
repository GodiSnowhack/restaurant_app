import { LoginCredentials, RegisterCredentials, LoginResponse, User } from '../types/auth';
import { saveToken, saveUser } from '../utils/auth';
import { api } from './core';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-1a78.up.railway.app/api/v1';

interface IAuthApi {
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (credentials: RegisterCredentials) => Promise<LoginResponse>;
  getProfile: () => Promise<User>;
  logout: () => Promise<void>;
}

export const authApi: IAuthApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Начало процесса входа', { 
        email: credentials.email,
        hasPassword: !!credentials.password
      });

      // Формируем данные для отправки
      const formData = new URLSearchParams();
      formData.append('username', credentials.email);
      formData.append('password', credentials.password);
      formData.append('grant_type', 'password');

      // Отправляем запрос через axios
      const response = await api.post('/auth/login', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      const data = response.data;
      
      console.log('Auth API: Получен ответ', {
        status: response.status,
        hasToken: !!data?.access_token,
        hasUser: !!data?.user
      });

      if (!data.access_token || !data.user) {
        console.error('Auth API: Отсутствуют необходимые данные', {
          hasToken: !!data.access_token,
          hasUser: !!data.user
        });
        throw new Error('Неполные данные в ответе сервера');
      }

      // Сохраняем данные
      saveToken(data.access_token);
      saveUser(data.user);

      console.log('Auth API: Успешный вход', {
        hasToken: true,
        hasUser: true,
        userEmail: data.user.email,
        userRole: data.user.role
      });

      return data;
    } catch (error) {
      console.error('Auth API: Ошибка входа', error);
      throw error;
    }
  },

  register: async (credentials: RegisterCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Попытка регистрации', { email: credentials.email });
      
      const response = await api.post('/auth/register', credentials);
      const data = response.data;

      if (data.access_token && data.user) {
        saveToken(data.access_token);
        saveUser(data.user);
      }

      return data;
    } catch (error: any) {
      console.error('Auth API: Ошибка регистрации', error);
      throw new Error(error.message || 'Ошибка регистрации');
    }
  },

  getProfile: async (): Promise<User> => {
    try {
      console.log('Auth API: Запрос профиля пользователя');
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await api.get('/users/me');
      const data = response.data;

      if (data) {
        console.log('Auth API: Получен профиль пользователя', {
          id: data.id,
          email: data.email,
          role: data.role
        });
        saveUser(data);
      }

      return data;
    } catch (error: any) {
      console.error('Auth API: Ошибка получения профиля', error);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Auth API: Ошибка при выходе', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user_profile');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user_profile');
    }
  }
}; 