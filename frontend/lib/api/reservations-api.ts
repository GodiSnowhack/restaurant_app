import { api } from '../api';
import { Reservation } from '../../types';

/**
 * API для работы с бронированиями
 */
export const reservationsApi = {
  /**
   * Получение списка бронирований с возможностью фильтрации
   * @param params Параметры фильтрации (status, date и т.д.)
   * @returns Массив бронирований
   */
  getReservations: async (params?: { status?: string; date?: string }): Promise<Reservation[]> => {
    try {
      console.log('API getReservations - Начало запроса с параметрами:', params);
      
      let queryParams = '';
      if (params) {
        const queryParts = [];
        if (params.status) queryParts.push(`status=${params.status}`);
        if (params.date) queryParts.push(`date=${params.date}`);
        
        if (queryParts.length > 0) {
          queryParams = `?${queryParts.join('&')}`;
        }
      }
      
      const response = await api.get(`/reservations${queryParams}`);
      
      console.log(`API getReservations - Получено ${response.data.length} бронирований`);
      return response.data;
    } catch (error: any) {
      console.error('API getReservations - Ошибка:', error);
      
      // Если основной запрос не сработал, пробуем альтернативный
      try {
        console.log('API getReservations - Пробуем получить данные через альтернативный эндпоинт');
        const response = await api.get('/admin/reservations');
        
        if (response.data) {
          console.log(`API getReservations - Получено ${response.data.length} бронирований через альтернативный эндпоинт`);
          return response.data;
        }
      } catch (alternativeError) {
        console.error('API getReservations - Ошибка при запросе через альтернативный эндпоинт:', alternativeError);
      }
      
      throw error;
    }
  },
  
  /**
   * Получение конкретного бронирования по ID
   * @param id ID бронирования
   * @returns Данные бронирования
   */
  getReservation: async (id: number): Promise<Reservation> => {
    const response = await api.get(`/reservations/${id}`);
    return response.data;
  },
  
  /**
   * Создание нового бронирования
   * @param data Данные для бронирования
   * @returns Созданное бронирование
   */
  createReservation: async (data: any): Promise<Reservation> => {
    const response = await api.post('/reservations/', data);
    return response.data;
  },
  
  /**
   * Обновление бронирования
   * @param id ID бронирования
   * @param data Обновленные данные
   * @returns Обновленное бронирование
   */
  updateReservation: async (id: number, data: any): Promise<Reservation> => {
    const response = await api.put(`/reservations/${id}`, data);
    return response.data;
  },
  
  /**
   * Обновление статуса бронирования
   * @param id ID бронирования
   * @param status Новый статус
   * @returns Обновленное бронирование
   */
  updateReservationStatus: async (id: number, status: string): Promise<Reservation> => {
    return reservationsApi.updateReservation(id, { status });
  },
  
  /**
   * Отмена бронирования
   * @param id ID бронирования
   * @returns Обновленное бронирование
   */
  cancelReservation: async (id: number): Promise<Reservation> => {
    return reservationsApi.updateReservationStatus(id, 'cancelled');
  },
  
  /**
   * Получение списка бронирований для официанта
   * @returns Массив бронирований
   */
  getWaiterReservations: async (): Promise<Reservation[]> => {
    try {
      const response = await api.get('/waiter/reservations');
      return response.data;
    } catch (error) {
      console.error('API getWaiterReservations - Ошибка:', error);
      throw error;
    }
  }
}; 