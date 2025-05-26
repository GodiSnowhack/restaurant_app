import { getAuthHeaders, isAdmin } from '../utils/auth';
import { getSecureApiUrl, createApiUrl } from '../utils/api';
import axios, { InternalAxiosRequestConfig } from 'axios';

export interface UserData {
  id: number;
  email: string;
  full_name?: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  birthday?: string;
  age_group?: string;
  orders_count?: number;
  reservations_count?: number;
}

export interface UserParams {
  role?: string;
  query?: string;
  page?: number;
  limit?: number;
}

// Создаем экземпляр axios с предустановленными параметрами
const api = axios.create({
  baseURL: 'https://backend-production-1a78.up.railway.app/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Добавляем перехватчик для установки заголовков авторизации
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    // Проверяем и принудительно устанавливаем HTTPS
    if (config.baseURL && config.baseURL.startsWith('http://')) {
      config.baseURL = config.baseURL.replace('http://', 'https://');
    }
    if (config.url && config.url.startsWith('http://')) {
      config.url = config.url.replace('http://', 'https://');
    }

    const headers = await getAuthHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        config.headers.set(key, value);
      }
    });
    return config;
  } catch (error) {
    console.error('Ошибка при установке заголовков:', error);
    return Promise.reject(error);
  }
});

class UsersAPI {
  // Получение списка пользователей
  async getUsers(params: UserParams = {}): Promise<UserData[]> {
    try {
      // Проверяем права доступа
      if (!isAdmin()) {
        throw new Error('Недостаточно прав для просмотра списка пользователей');
      }

      // Формируем параметры запроса
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      // Формируем URL
      const url = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      console.log('Отправка запроса на получение пользователей:', url);

      // Выполняем запрос
      const response = await api.get(url);

      // Проверяем ответ
      if (!response.data) {
        console.warn('Получен пустой ответ от сервера');
        return [];
      }

      // Преобразуем данные
      const users = Array.isArray(response.data) ? response.data : response.data.items || [];
      
      // Маппим данные в нужный формат
      return users.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.name || 'Без имени',
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
    } catch (error: any) {
      console.error('Ошибка при получении списка пользователей:', error);
      
      // Проверяем тип ошибки
      if (error.response) {
        // Если получили ответ от сервера с ошибкой
        throw new Error(`Ошибка сервера: ${error.response.status} - ${error.response.data?.message || error.message}`);
      } else if (error.request) {
        // Если не получили ответ
        throw new Error('Сервер недоступен. Проверьте подключение к интернету.');
      } else {
        // Если произошла ошибка при подготовке запроса
        throw new Error(`Ошибка запроса: ${error.message}`);
      }
    }
  }

  // Получение пользователя по ID
  async getUserById(id: number): Promise<UserData> {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при получении пользователя #${id}:`, error);
      throw new Error(`Не удалось получить данные пользователя: ${error.message}`);
    }
  }

  // Создание пользователя
  async createUser(data: Partial<UserData>): Promise<UserData> {
    try {
      const response = await api.post('/users', data);
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при создании пользователя:', error);
      throw new Error(`Не удалось создать пользователя: ${error.message}`);
    }
  }

  // Обновление пользователя
  async updateUser(id: number, data: Partial<UserData>): Promise<UserData> {
    try {
      const response = await api.put(`/users/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при обновлении пользователя #${id}:`, error);
      throw new Error(`Не удалось обновить пользователя: ${error.message}`);
    }
  }

  // Удаление пользователя
  async deleteUser(id: number): Promise<void> {
    try {
      await api.delete(`/users/${id}`);
    } catch (error: any) {
      console.error(`Ошибка при удалении пользователя #${id}:`, error);
      throw new Error(`Не удалось удалить пользователя: ${error.message}`);
    }
  }

  // Изменение статуса пользователя
  async toggleUserStatus(id: number, isActive: boolean): Promise<UserData> {
    try {
      const response = await api.patch(`/users/${id}/status`, { is_active: isActive });
      return response.data;
    } catch (error: any) {
      console.error(`Ошибка при изменении статуса пользователя #${id}:`, error);
      throw new Error(`Не удалось изменить статус пользователя: ${error.message}`);
    }
  }
}

export const usersApi = new UsersAPI(); 