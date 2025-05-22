import { create } from 'zustand';
import { reservationsApi } from './api/reservations';
import type { Reservation } from '@/types';

interface ReservationCreateData {
  reservation_date: string;
  reservation_time: string;
  guests_count: number;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  table_id?: number | null;
  comments?: string;
  user_id?: number | null;
  status?: string;
}

interface ReservationsState {
  reservations: Reservation[];
  isLoading: boolean;
  error: string | null;
  selectedDate: string | null;
  init: () => void;
  getReservations: () => Promise<void>;
  createReservation: (data: ReservationCreateData) => Promise<Reservation>;
  cancelReservation: (id: number) => Promise<void>;
  generateReservationCode: (reservationId: number) => string;
  verifyReservationCode: (code: string) => Promise<any>;
  syncLocalReservations: () => Promise<void>;
  clearStore: () => void;
}

const useReservationsStore = create<ReservationsState>((set, get) => ({
  reservations: [],
  isLoading: false,
  error: null,
  selectedDate: null,
  
  /**
   * Инициализация хранилища
   */
  init: () => {
    console.log('[ReservationsStore] Инициализация хранилища бронирований');
    
    // Проверяем наличие профиля пользователя
    if (typeof window !== 'undefined') {
      const userProfile = localStorage.getItem('user_profile');
      if (!userProfile) {
        // Создаем базовый профиль в localStorage
        const basicProfile = { id: 1, name: "Гость" };
        localStorage.setItem('user_profile', JSON.stringify(basicProfile));
        console.log('[ReservationsStore] Создан базовый профиль пользователя');
      }
    }
    
    // Загружаем бронирования при инициализации
    get().getReservations();
  },
  
  /**
   * Очистка хранилища
   */
  clearStore: () => {
    console.log('[ReservationsStore] Очистка хранилища бронирований');
    set({
      reservations: [],
      isLoading: false,
      error: null,
      selectedDate: null
    });
  },
  
  /**
   * Получение списка бронирований
   */
  getReservations: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const reservations = await reservationsApi.getReservations();
      set({ reservations, isLoading: false });
    } catch (error) {
      console.error('[ReservationsStore] Ошибка при получении бронирований:', error);
      set({ error: 'Ошибка при получении бронирований', isLoading: false });
    }
  },
  
  /**
   * Создание нового бронирования
   */
  createReservation: async (data: ReservationCreateData) => {
    set({ isLoading: true, error: null });
    
    try {
      // Генерируем код бронирования
      const reservationCode = get().generateReservationCode(Date.now());
      
      // Преобразуем дату и время в формат ISO
      const [year, month, day] = data.reservation_date.split('-');
      const [hours, minutes] = data.reservation_time.split(':');
      const reservationTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      ).toISOString();
      
      // Подготавливаем данные для API
      const apiData = {
        table_number: data.table_id || undefined,
        guests_count: data.guests_count,
        reservation_time: reservationTime,
        reservation_date: data.reservation_date,
        guest_name: data.guest_name,
        guest_phone: data.guest_phone,
        comment: data.comments,
        reservation_code: reservationCode,
        user_id: data.user_id || 1,
        status: data.status || 'pending'
      };
      
      // Отправляем запрос на создание бронирования
      const newReservation = await reservationsApi.createReservation(apiData);
      
      // Обновляем список бронирований
      const currentReservations = get().reservations;
      set({
        reservations: [...currentReservations, newReservation],
        isLoading: false
      });
      
      return newReservation;
    } catch (error) {
      console.error('[ReservationsStore] Ошибка при создании бронирования:', error);
      set({ error: 'Ошибка при создании бронирования', isLoading: false });
      throw error;
    }
  },
  
  /**
   * Отмена бронирования
   */
  cancelReservation: async (id: number) => {
    set({ isLoading: true, error: null });
    
    try {
      await reservationsApi.cancelReservation(id);
      
      // Обновляем список бронирований
      const currentReservations = get().reservations;
      set({
        reservations: currentReservations.filter(r => r.id !== id),
        isLoading: false
      });
    } catch (error) {
      console.error('[ReservationsStore] Ошибка при отмене бронирования:', error);
      set({ error: 'Ошибка при отмене бронирования', isLoading: false });
      throw error;
    }
  },
  
  /**
   * Генерация кода бронирования
   */
  generateReservationCode: (reservationId: number): string => {
    const timestamp = Date.now().toString().slice(-6);
    const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RES-${timestamp}-${randomPart}`;
  },
  
  /**
   * Проверка кода бронирования
   */
  verifyReservationCode: async (code: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await reservationsApi.verifyReservationCode(code);
      set({ isLoading: false });
      return result;
    } catch (error) {
      console.error('[ReservationsStore] Ошибка при проверке кода бронирования:', error);
      set({ error: 'Ошибка при проверке кода бронирования', isLoading: false });
      throw error;
    }
  },
  
  /**
   * Синхронизация локальных бронирований с сервером
   */
  syncLocalReservations: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // Получаем все бронирования с сервера
      const serverReservations = await reservationsApi.getReservations();
      
      // Получаем локальные бронирования
      const localReservations = JSON.parse(localStorage.getItem('cached_reservations') || '[]');
      
      // Синхронизируем данные
      const mergedReservations = [...serverReservations];
      
      // Добавляем локальные бронирования, которых нет на сервере
      localReservations.forEach((localRes: Reservation) => {
        if (!serverReservations.find(serverRes => serverRes.id === localRes.id)) {
          mergedReservations.push(localRes);
        }
      });
      
      // Обновляем хранилище
      set({
        reservations: mergedReservations,
        isLoading: false
      });
      
      // Обновляем кэш
      localStorage.setItem('cached_reservations', JSON.stringify(mergedReservations));
      localStorage.setItem('reservations_cache_timestamp', Date.now().toString());
    } catch (error) {
      console.error('[ReservationsStore] Ошибка при синхронизации бронирований:', error);
      set({ error: 'Ошибка при синхронизации бронирований', isLoading: false });
    }
  }
}));

export default useReservationsStore; 