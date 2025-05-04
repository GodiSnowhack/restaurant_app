import { api } from './core';

// Интерфейс для бронирования столика
export interface Reservation {
  id?: number;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  date: string;
  time: string;
  duration?: number;
  guests: number;
  table_number?: number;
  status: string;
  special_requests?: string;
  confirmation_code?: string;
  created_at?: string;
  updated_at?: string;
}

// API функции для работы с бронированиями
export const reservationsApi = {
  // Получение всех бронирований
  getReservations: async (): Promise<Reservation[]> => {
    try {
      const response = await api.get('/reservations');
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении бронирований:', error);
      return [];
    }
  },
  
  // Получение бронирований пользователя
  getUserReservations: async (userEmail?: string): Promise<Reservation[]> => {
    try {
      // Если email пользователя не указан, используем /me для текущего пользователя
      const endpoint = userEmail ? `/reservations/user/${userEmail}` : '/reservations/me';
      
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении бронирований пользователя:', error);
      return [];
    }
  },
  
  // Получение бронирования по ID
  getReservationById: async (id: number): Promise<Reservation | null> => {
    try {
      const response = await api.get(`/reservations/${id}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении бронирования ${id}:`, error);
      return null;
    }
  },
  
  // Получение бронирования по коду подтверждения
  getReservationByCode: async (code: string): Promise<Reservation | null> => {
    try {
      const response = await api.get(`/reservations/code/${code}`);
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при получении бронирования по коду ${code}:`, error);
      return null;
    }
  },
  
  // Создание нового бронирования
  createReservation: async (reservationData: Omit<Reservation, 'id' | 'created_at' | 'updated_at' | 'confirmation_code'>): Promise<Reservation> => {
    try {
      console.log('API: Создание бронирования с данными:', reservationData);
      
      // Если не указан статус, устанавливаем 'pending'
      if (!reservationData.status) {
        reservationData.status = 'pending';
      }
      
      // Сначала пробуем через API
      try {
        const response = await api.post('/reservations', reservationData);
        console.log('API: Бронирование успешно создано через API, ID:', response.data.id);
        
        // Сохраняем информацию о бронировании в локальном хранилище
        try {
          let userReservations = [];
          const localReservations = localStorage.getItem('user_reservations');
          
          if (localReservations) {
            userReservations = JSON.parse(localReservations);
          }
          
          userReservations.push(response.data);
          localStorage.setItem('user_reservations', JSON.stringify(userReservations));
          localStorage.setItem('last_reservation_code', response.data.confirmation_code);
          
          console.log('API: Информация о бронировании сохранена локально');
        } catch (storageError) {
          console.error('API: Ошибка при сохранении информации о бронировании:', storageError);
        }
        
        return response.data;
      } catch (apiError) {
        console.error('API: Ошибка при создании бронирования через API:', apiError);
        
        // Пробуем через fetch
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(reservationData)
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API: Бронирование успешно создано через fetch, ID:', data.id);
        
        // Сохраняем информацию о бронировании в локальном хранилище
        try {
          let userReservations = [];
          const localReservations = localStorage.getItem('user_reservations');
          
          if (localReservations) {
            userReservations = JSON.parse(localReservations);
          }
          
          userReservations.push(data);
          localStorage.setItem('user_reservations', JSON.stringify(userReservations));
          localStorage.setItem('last_reservation_code', data.confirmation_code);
          
          console.log('API: Информация о бронировании сохранена локально');
        } catch (storageError) {
          console.error('API: Ошибка при сохранении информации о бронировании:', storageError);
        }
        
        return data;
      }
    } catch (error) {
      console.error('API: Ошибка при создании бронирования:', error);
      throw error;
    }
  },
  
  // Обновление бронирования
  updateReservation: async (id: number, reservationData: Partial<Reservation>): Promise<Reservation> => {
    try {
      console.log(`API: Обновление бронирования ${id} с данными:`, reservationData);
      
      const response = await api.put(`/reservations/${id}`, reservationData);
      console.log(`API: Бронирование ${id} успешно обновлено`);
      
      // Обновляем информацию о бронировании в локальном хранилище
      try {
        const localReservations = localStorage.getItem('user_reservations');
        
        if (localReservations) {
          let userReservations = JSON.parse(localReservations);
          
          userReservations = userReservations.map((reservation: Reservation) => {
            if (reservation.id === id) {
              return { ...reservation, ...response.data };
            }
            return reservation;
          });
          
          localStorage.setItem('user_reservations', JSON.stringify(userReservations));
          console.log('API: Информация о бронировании обновлена локально');
        }
      } catch (storageError) {
        console.error('API: Ошибка при обновлении информации о бронировании:', storageError);
      }
      
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при обновлении бронирования ${id}:`, error);
      throw error;
    }
  },
  
  // Отмена бронирования
  cancelReservation: async (id: number, reason?: string): Promise<Reservation> => {
    try {
      console.log(`API: Отмена бронирования ${id}`, reason ? `с причиной: ${reason}` : '');
      
      const response = await api.post(`/reservations/${id}/cancel`, { reason });
      console.log(`API: Бронирование ${id} успешно отменено`);
      
      // Обновляем информацию о бронировании в локальном хранилище
      try {
        const localReservations = localStorage.getItem('user_reservations');
        
        if (localReservations) {
          let userReservations = JSON.parse(localReservations);
          
          userReservations = userReservations.map((reservation: Reservation) => {
            if (reservation.id === id) {
              return { ...reservation, status: 'cancelled' };
            }
            return reservation;
          });
          
          localStorage.setItem('user_reservations', JSON.stringify(userReservations));
          console.log('API: Информация о бронировании обновлена локально');
        }
      } catch (storageError) {
        console.error('API: Ошибка при обновлении информации о бронировании:', storageError);
      }
      
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при отмене бронирования ${id}:`, error);
      throw error;
    }
  },
  
  // Подтверждение бронирования по коду
  confirmReservation: async (code: string): Promise<Reservation> => {
    try {
      console.log(`API: Подтверждение бронирования по коду ${code}`);
      
      const response = await api.post(`/reservations/confirm/${code}`);
      console.log(`API: Бронирование по коду ${code} успешно подтверждено`);
      
      // Обновляем информацию о бронировании в локальном хранилище
      try {
        const localReservations = localStorage.getItem('user_reservations');
        
        if (localReservations) {
          let userReservations = JSON.parse(localReservations);
          
          userReservations = userReservations.map((reservation: Reservation) => {
            if (reservation.confirmation_code === code) {
              return { ...reservation, status: 'confirmed' };
            }
            return reservation;
          });
          
          localStorage.setItem('user_reservations', JSON.stringify(userReservations));
          console.log('API: Информация о бронировании обновлена локально');
        }
      } catch (storageError) {
        console.error('API: Ошибка при обновлении информации о бронировании:', storageError);
      }
      
      return response.data;
    } catch (error) {
      console.error(`API: Ошибка при подтверждении бронирования по коду ${code}:`, error);
      throw error;
    }
  },
  
  // Получение доступных столиков для бронирования
  getAvailableTables: async (date: string, time: string, guests: number): Promise<any[]> => {
    try {
      console.log(`API: Получение доступных столиков на ${date} ${time} для ${guests} гостей`);
      
      const response = await api.get('/reservations/available-tables', {
        params: { date, time, guests }
      });
      
      console.log(`API: Получено доступных столиков: ${response.data.length}`);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении доступных столиков:', error);
      return [];
    }
  },
  
  // Получение доступных временных слотов для бронирования
  getAvailableTimeSlots: async (date: string, guests: number): Promise<string[]> => {
    try {
      console.log(`API: Получение доступных временных слотов на ${date} для ${guests} гостей`);
      
      const response = await api.get('/reservations/available-slots', {
        params: { date, guests }
      });
      
      console.log(`API: Получено доступных временных слотов: ${response.data.length}`);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при получении доступных временных слотов:', error);
      return [];
    }
  },
  
  // Получение локальных бронирований из хранилища
  getLocalReservations: (): Reservation[] => {
    try {
      const localReservations = localStorage.getItem('user_reservations');
      
      if (localReservations) {
        return JSON.parse(localReservations);
      }
    } catch (error) {
      console.error('API: Ошибка при получении локальных бронирований:', error);
    }
    
    return [];
  },
  
  // Получение последнего кода бронирования
  getLastReservationCode: (): string | null => {
    try {
      return localStorage.getItem('last_reservation_code');
    } catch (error) {
      console.error('API: Ошибка при получении последнего кода бронирования:', error);
      return null;
    }
  }
}; 