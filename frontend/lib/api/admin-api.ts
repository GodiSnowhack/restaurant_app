import { api } from './core';
import { getSecureApiUrl, createApiUrl } from '../utils/api';
import axios from 'axios';
import { handleApiResponse, getBaseApiOptions, ApiError } from '../api';
import { getValidToken } from './auth-helpers';

/**
 * API для взаимодействия с административными функциями
 */
const adminApi = {
  /**
   * Проверяет, имеет ли текущий пользователь права администратора
   * @returns {Promise<boolean>} True, если пользователь администратор
   * @throws {ApiError} При ошибке запроса или если пользователь не администратор
   */
  async checkAdminAccess(): Promise<boolean> {
    try {
      const response = await api.get('/admin/check-access');
      return response.data.isAdmin;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        throw new ApiError(401, 'У вас нет прав администратора');
      }
      throw error;
    }
  },

  /**
   * Получает общую статистику панели управления
   * @returns {Promise<any>} Данные статистики для панели управления
   */
  async getDashboardStats(): Promise<any> {
    try {
      // Получаем актуальный токен с проверкой срока действия
      const token = await getValidToken();
      
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }

      // Используем локальный API-прокси вместо прямого запроса к бэкенду
      const url = '/api/admin/dashboard-stats';
      console.log('Отправляем запрос статистики по URL:', url);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-User-Role': localStorage.getItem('user_role') || 'admin',
          'X-User-ID': localStorage.getItem('user_id') || '1'
        }
      });
      
      console.log('Получен ответ от API статистики:', response.data);
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
      
      // Проверяем, должны ли мы использовать демо-данные
      const useDemoData = localStorage.getItem('force_demo_data') === 'true' || 
                          localStorage.getItem('use_demo_for_errors') === 'true';
                          
      if (useDemoData) {
        console.log('Возвращаем демо-данные статистики');
        // Возвращаем демо-данные в случае ошибки
        return {
          ordersToday: 15,
          ordersTotal: 1432,
          revenue: 542500,
          reservationsToday: 8,
          dishes: 45
        };
      }
      
      // Если демо-данные не используются, возвращаем нули
      return {
        ordersToday: 0,
        ordersTotal: 0,
        revenue: 0,
        reservationsToday: 0,
        dishes: 0
      };
    }
  },
  
  /**
   * Получает список пользователей админ-панели
   * @returns {Promise<any[]>} Список пользователей
   */
  async getAdminUsers(): Promise<any[]> {
    try {
      const url = createApiUrl('/admin/users');
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении списка пользователей:', error);
      throw error;
    }
  },
  
  /**
   * Создает нового пользователя админ-панели
   * @param {object} userData Данные нового пользователя
   * @returns {Promise<any>} Созданный пользователь
   */
  async createAdminUser(userData: any): Promise<any> {
    try {
      const response = await api.post('/admin/users', userData);
      return response.data;
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      throw error;
    }
  },
  
  /**
   * Обновляет пользователя админ-панели
   * @param {number} userId ID пользователя
   * @param {object} userData Обновленные данные пользователя
   * @returns {Promise<any>} Обновленный пользователь
   */
  async updateAdminUser(userId: number, userData: any): Promise<any> {
    try {
      const response = await api.put(`/admin/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error('Ошибка при обновлении пользователя:', error);
      throw error;
    }
  },
  
  /**
   * Удаляет пользователя админ-панели
   * @param {number} userId ID пользователя
   * @returns {Promise<void>}
   */
  async deleteAdminUser(userId: number): Promise<void> {
    try {
      await api.delete(`/admin/users/${userId}`);
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error);
      throw error;
    }
  }
};

export default adminApi; 