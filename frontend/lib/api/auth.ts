import { LoginCredentials, RegisterCredentials, LoginResponse, User } from '../types/auth';
import { saveToken, saveUser } from '../utils/auth';

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

      // Отправляем запрос напрямую на бэкенд
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formData
      });

      const data = await response.json();
      
      console.log('Auth API: Получен ответ', {
        status: response.status,
        ok: response.ok,
        hasToken: !!data?.access_token,
        hasUser: !!data?.user
      });

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка авторизации');
      }

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
      
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка регистрации');
      }

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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка получения профиля');
      }

      if (data) {
        saveUser(data);
      }

      return data;
    } catch (error: any) {
      console.error('Auth API: Ошибка получения профиля', error);
      throw new Error(error.message || 'Ошибка получения профиля');
    }
  },

  logout: async (): Promise<void> => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
    } catch (error: any) {
      console.error('Auth API: Ошибка выхода', error);
    }
  }
}; 