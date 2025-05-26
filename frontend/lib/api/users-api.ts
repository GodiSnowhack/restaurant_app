import { getAuthHeaders, isAdmin } from '../utils/auth';
import { getSecureApiUrl, createApiUrl } from '../utils/api';

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
  private baseUrl: string;

  constructor() {
    this.baseUrl = getSecureApiUrl();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = createApiUrl(endpoint);
    const authHeaders = await getAuthHeaders();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders as Record<string, string>,
      ...(options.headers as Record<string, string> || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
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

      const queryString = queryParams.toString();
      const endpoint = `/users${queryString ? `?${queryString}` : ''}`;

      return await this.request<UserData[]>(endpoint);
    } catch (error) {
      console.error('Ошибка при получении списка пользователей:', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<UserData> {
    try {
      return await this.request<UserData>(`/users/${id}`);
    } catch (error) {
      console.error(`Ошибка при получении пользователя #${id}:`, error);
      throw error;
    }
  }

  async updateUser(id: number, data: Partial<UserData>): Promise<UserData> {
    try {
      return await this.request<UserData>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error(`Ошибка при обновлении пользователя #${id}:`, error);
      throw error;
    }
  }

  async toggleUserStatus(id: number, isActive: boolean): Promise<UserData> {
    try {
      return await this.request<UserData>(`/users/${id}/toggle-status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive })
      });
    } catch (error) {
      console.error(`Ошибка при изменении статуса пользователя #${id}:`, error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await this.request(`/users/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error(`Ошибка при удалении пользователя #${id}:`, error);
      throw error;
    }
  }

  async createUser(data: Partial<UserData>): Promise<UserData> {
    try {
      return await this.request<UserData>('/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      throw error;
    }
  }
}

export const usersApi = new UsersAPI(); 