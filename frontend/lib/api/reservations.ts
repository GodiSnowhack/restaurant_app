import { api } from './core';
import type { Reservation } from '@/types';

// API функции для работы с бронированиями
export const reservationsApi = {
  // Получение всех бронирований
  getReservations: async (): Promise<Reservation[]> => {
    try {
      console.log('API: Получение бронирований...');
      const response = await api.get('/api/v1/reservations');
      
      if (!response.data) {
        throw new Error('Данные не получены');
      }
      
      // Сохраняем в кэш
      try {
        localStorage.setItem('cached_reservations', JSON.stringify(response.data));
        localStorage.setItem('reservations_cache_timestamp', Date.now().toString());
      } catch (cacheError) {
        console.error('API: Ошибка при кешировании бронирований:', cacheError);
      }
      
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении бронирований:', error);
      
      // Пробуем получить из кэша
      try {
        const cachedReservations = localStorage.getItem('cached_reservations');
        if (cachedReservations) {
          console.log('API: Используем кешированные бронирования');
          return JSON.parse(cachedReservations);
        }
      } catch (cacheError) {
        console.error('API: Ошибка при чтении кеша бронирований:', cacheError);
      }
      
      return [];
    }
  },
  
  // Получение бронирования по ID
  getReservationById: async (id: number): Promise<Reservation | null> => {
    try {
      const response = await api.get(`/api/v1/reservations/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении бронирования ${id}:`, error);
      return null;
    }
  },
  
  // Создание нового бронирования
  createReservation: async (reservationData: Omit<Reservation, 'id' | 'created_at' | 'updated_at'>): Promise<Reservation> => {
    try {
      const response = await api.post('/api/v1/reservations', reservationData);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при создании бронирования:', error);
      throw error;
    }
  },
  
  // Обновление бронирования
  updateReservation: async (id: number, reservationData: Partial<Reservation>): Promise<Reservation> => {
    try {
      const response = await api.put(`/api/v1/reservations/${id}`, reservationData);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обновлении бронирования ${id}:`, error);
      throw error;
    }
  },
  
  // Отмена бронирования
  cancelReservation: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/v1/reservations/${id}`);
    } catch (error) {
      console.error(`API: Ошибка при отмене бронирования ${id}:`, error);
      throw error;
    }
  },
  
  // Проверка кода бронирования
  verifyReservationCode: async (code: string): Promise<any> => {
    try {
      const response = await api.post('/api/v1/reservations/verify-code', { code });
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при проверке кода бронирования:', error);
      throw error;
    }
  }
}; 