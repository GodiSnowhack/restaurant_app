import { handleApiResponse, getBaseApiOptions, ApiError } from '../api';

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
      const response = await fetch('/api/admin/check-access', getBaseApiOptions('GET'));
      const data = await handleApiResponse(response);
      return data.isAdmin;
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
      const response = await fetch('/api/admin/dashboard-stats', getBaseApiOptions('GET'));
      return await handleApiResponse(response);
    } catch (error) {
      console.error('Ошибка при получении статистики панели управления:', error);
      
      // Возвращаем демо-данные в случае ошибки
      return {
        ordersToday: 0,
        ordersTotal: 0,
        revenue: 0,
        reservationsToday: 0,
        users: 0,
        dishes: 0,
        totalRevenue: 0,
        totalOrders: 0,
        averageCheck: 0,
        totalCustomers: 0,
        pendingOrders: 0,
        popularItems: [
          { name: 'Стейк рибай', count: 0, revenue: 0 },
          { name: 'Паста карбонара', count: 0, revenue: 0 },
          { name: 'Тирамису', count: 0, revenue: 0 },
        ],
        recentOrders: [
          { id: 0, customer: 'Загрузка...', status: 'pending', total: 0, date: new Date().toISOString() }
        ]
      };
    }
  },
  
  /**
   * Получает список пользователей админ-панели
   * @returns {Promise<any[]>} Список пользователей
   */
  async getAdminUsers(): Promise<any[]> {
    try {
      const response = await fetch('/api/admin/users', getBaseApiOptions('GET'));
      return await handleApiResponse(response);
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
      const options = getBaseApiOptions('POST', userData);
      const response = await fetch('/api/admin/users', options);
      return await handleApiResponse(response);
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
      const options = getBaseApiOptions('PUT', userData);
      const response = await fetch(`/api/admin/users/${userId}`, options);
      return await handleApiResponse(response);
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
      const response = await fetch(`/api/admin/users/${userId}`, getBaseApiOptions('DELETE'));
      await handleApiResponse(response);
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error);
      throw error;
    }
  }
};

export default adminApi; 