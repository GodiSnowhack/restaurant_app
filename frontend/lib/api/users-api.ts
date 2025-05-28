import { getAuthHeaders, isAdmin } from '../utils/auth';
import { getSecureApiUrl, createApiUrl } from '../utils/api';

const BASE_URL = 'https://backend-production-1a78.up.railway.app/api/v1';

// Демо-данные для тестирования
const DEMO_USERS: UserData[] = [
  {
    id: 1,
    email: 'admin@example.com',
    full_name: 'Администратор',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    orders_count: 0,
    reservations_count: 0
  },
  {
    id: 2,
    email: 'user@example.com',
    full_name: 'Тестовый Пользователь',
    role: 'client',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    orders_count: 5,
    reservations_count: 2
  }
];

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

class UsersAPI {
  private isDevMode = process.env.NODE_ENV === 'development';
  private retryCount = 3;
  private retryDelay = 1000;

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const headers = await getAuthHeaders();
        const url = createApiUrl(endpoint);
        
        console.log('Отправка запроса на URL:', url);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP ошибка: ${response.status}`);
        }

        return await response.json();
      } catch (error: any) {
        console.warn(`Попытка ${attempt + 1}/${this.retryCount} не удалась:`, error);
        lastError = error;
        
        if (attempt === this.retryCount - 1) {
          if (this.isDevMode) {
            console.warn('Возвращаем демо-данные из-за ошибки API');
            return this.getDemoData(endpoint) as T;
          }
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }

    throw lastError;
  }

  private getDemoData(endpoint: string): UserData | UserData[] {
    if (endpoint.includes('/users/')) {
      const id = parseInt(endpoint.split('/').pop() || '1');
      return DEMO_USERS.find(u => u.id === id) || DEMO_USERS[0];
    }
    return DEMO_USERS;
  }

  async getUsers(params: UserParams = {}): Promise<UserData[]> {
    try {
      if (!isAdmin()) {
        throw new Error('Недостаточно прав для просмотра списка пользователей');
      }

      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      console.log('Запрос пользователей с параметрами:', params);
      
      // Формируем URL запроса
      const endpoint = `/api/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }

      const data = await response.json();
      console.log('Получены данные пользователей:', data);
      
      if (!Array.isArray(data)) {
        console.warn('Получен неверный формат данных от сервера');
        return this.isDevMode ? DEMO_USERS : [];
      }

      return data.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.name || '',
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
      if (this.isDevMode) {
        console.warn('Возвращаем демо-данные из-за ошибки');
        return DEMO_USERS;
      }
      throw new Error(error.message || 'Не удалось загрузить список пользователей');
    }
  }

  async getUserById(id: number): Promise<UserData> {
    try {
      const endpoint = `/api/users/${id}`;
      const headers = await getAuthHeaders();
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }

      const user = await response.json();
      
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.name || '',
        phone: user.phone || null,
        role: user.role || 'client',
        is_active: user.is_active ?? true,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
        birthday: user.birthday || null,
        age_group: user.age_group || null,
        orders_count: user.orders_count || 0,
        reservations_count: user.reservations_count || 0
      };
    } catch (error: any) {
      console.error(`Ошибка при получении пользователя #${id}:`, error);
      if (this.isDevMode) {
        const demoUser = DEMO_USERS.find(u => u.id === id) || DEMO_USERS[0];
        return demoUser;
      }
      throw new Error(`Не удалось получить данные пользователя: ${error.message}`);
    }
  }

  async createUser(data: Partial<UserData>): Promise<UserData> {
    try {
      const endpoint = `/api/users`;
      const headers = await getAuthHeaders();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Ошибка при создании пользователя:', error);
      throw new Error(`Не удалось создать пользователя: ${error.message}`);
    }
  }

  async updateUser(id: number, data: Partial<UserData>): Promise<UserData> {
    try {
      const endpoint = `/api/users/${id}`;
      const headers = await getAuthHeaders();
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`Ошибка при обновлении пользователя #${id}:`, error);
      throw new Error(`Не удалось обновить пользователя: ${error.message}`);
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      const endpoint = `/api/users/${id}`;
      const headers = await getAuthHeaders();
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`Ошибка при удалении пользователя #${id}:`, error);
      throw new Error(`Не удалось удалить пользователя: ${error.message}`);
    }
  }

  async toggleUserStatus(id: number, isActive: boolean): Promise<UserData> {
    try {
      const endpoint = `/api/users/${id}/status`;
      const headers = await getAuthHeaders();
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ is_active: isActive }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`Ошибка при изменении статуса пользователя #${id}:`, error);
      throw new Error(`Не удалось изменить статус пользователя: ${error.message}`);
    }
  }
}

export const usersApi = new UsersAPI(); 