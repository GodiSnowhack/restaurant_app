import { LoginCredentials, RegisterCredentials, LoginResponse, User } from '../types/auth';
import { saveToken, saveUser } from '../utils/auth';
import axios from 'axios';

// Используем внутренние прокси вместо прямого обращения к бэкенду
const API_BASE_URL = '/api';

interface IAuthApi {
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (credentials: RegisterCredentials) => Promise<LoginResponse>;
  getProfile: () => Promise<User>;
  logout: () => Promise<void>;
}

// Создаем экземпляр axios для аутентификации
const authAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  maxRedirects: 0
});

export const authApi: IAuthApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('Auth API: Начало процесса входа', { 
        email: credentials.email,
        hasPassword: !!credentials.password
      });

      // Используем отдельную проверку для обязательных полей
      if (!credentials.email || !credentials.password) {
        console.error('Auth API: Отсутствуют обязательные поля');
        throw new Error('Необходимо указать email и пароль');
      }

      // Отправляем запрос в формате JSON
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        })
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
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
      console.log('Auth API: Запрос профиля пользователя');

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      // Используем внутренний прокси-эндпоинт для профиля
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Если у нас есть кэшированный пользователь, используем его
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          console.log('Auth API: Используем кэшированные данные пользователя');
          return JSON.parse(cachedUser);
        }
        throw new Error('Ошибка получения профиля');
      }

      const data = await response.json();
      console.log('Auth API: Получен профиль', data);

      if (data) {
        saveUser(data);
      }

      return data;
    } catch (error: any) {
      console.error('Auth API: Ошибка получения профиля', error);
      
      // В случае ошибки проверяем, есть ли кэшированные данные
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        console.log('Auth API: Используем кэшированные данные пользователя после ошибки');
        return JSON.parse(cachedUser);
      }
      
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