import { create } from 'zustand';
import { api } from './api';
import { Reservation } from '../types';

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
  getReservations: () => Promise<void>;
  createReservation: (data: ReservationCreateData) => Promise<Reservation>;
  cancelReservation: (id: number) => Promise<void>;
  generateReservationCode: (reservationId: number) => string;
  verifyReservationCode: (code: string) => Promise<boolean>;
}

// Генерирует произвольную строку заданной длины
const generateRandomString = (length: number): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключены похожие символы I, O, 0, 1
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const useReservationsStore = create<ReservationsState>((set, get) => ({
  reservations: [],
  isLoading: false,
  error: null,
  
  getReservations: async () => {
    set({ isLoading: true, error: null });
    try {
      // Получаем ID пользователя из кэшированного профиля
      let userId = null;
      
      // Проверяем наличие кэшированного профиля
      if (typeof window !== 'undefined') {
        const userProfile = localStorage.getItem('user_profile');
        if (userProfile) {
          try {
            const profileData = JSON.parse(userProfile);
            userId = profileData.id;
          } catch (e) {
            console.error('Ошибка при парсинге профиля пользователя:', e);
          }
        }
      }
      
      // Если ID не найден в user_profile, пробуем загрузить данные через API
      if (!userId) {
        try {
          const response = await api.get('/users/me');
          if (response.data && response.data.id) {
            userId = response.data.id;
            
            // Сохраняем профиль, чтобы в следующий раз не делать лишний запрос
            if (typeof window !== 'undefined') {
              localStorage.setItem('user_profile', JSON.stringify(response.data));
            }
          }
        } catch (apiError) {
          console.error('Ошибка при получении профиля пользователя через API:', apiError);
          throw new Error('Пользователь не авторизован');
        }
      }
      
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }
      
      // Запрашиваем бронирования пользователя - они автоматически фильтруются
      // на стороне сервера на основе текущего пользователя
      const response = await api.get('/reservations/');
      
      // Если нужно явно отфильтровать:
      // const response = await api.get(`/reservations/?user_id=${userId}`);
      
      // Обрабатываем полученные бронирования
      let reservations = response.data;
      
      // Добавляем коды бронирования из localStorage для существующих бронирований
      const storedCodes = JSON.parse(localStorage.getItem('reservationCodes') || '{}');
      
      reservations = reservations.map(reservation => {
        // Ищем код бронирования для этого ID
        const reservationCode = Object.keys(storedCodes).find(
          code => storedCodes[code] === reservation.id
        );
        
        // Форматируем дату и время из ISO в читаемые поля
        if (reservation.reservation_time && typeof reservation.reservation_time === 'string') {
          try {
            const date = new Date(reservation.reservation_time);
            reservation.reservation_date = date.toISOString().split('T')[0];
            reservation.reservation_time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          } catch (e) {
            console.error('Ошибка при парсинге даты/времени:', e);
          }
        }
        
        return {
          ...reservation,
          reservation_code: reservationCode || reservation.reservation_code
        };
      });
      
      set({ reservations, isLoading: false });
      return reservations;
    } catch (error) {
      console.error('Ошибка при загрузке бронирований:', error);
      set({ 
        error: 'Не удалось загрузить бронирования', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  createReservation: async (data: ReservationCreateData) => {
    set({ isLoading: true, error: null });
    try {
      console.log("Данные перед отправкой:", JSON.stringify(data, null, 2));
      
      // Проверяем формат времени перед отправкой
      if (data.reservation_time && !/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(data.reservation_time)) {
        throw new Error('Время должно быть в формате HH:MM');
      }
      
      // Проверяем формат даты перед отправкой
      if (data.reservation_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.reservation_date)) {
        throw new Error('Дата должна быть в формате YYYY-MM-DD');
      }
      
      // Создаем копию данных для модификации
      const apiData = { ...data };
      
      // Объединяем дату и время в один формат ISO для отправки на сервер
      if (apiData.reservation_date && apiData.reservation_time) {
        const datetime = `${apiData.reservation_date}T${apiData.reservation_time}:00`;
        apiData.reservation_time = datetime;
      }
      
      // Удаляем reservation_date так как бэкенд ожидает только reservation_time
      delete apiData.reservation_date;
      
      // Переименовываем comments в comment (так как в API используется comment)
      if (apiData.comments) {
        apiData.comment = apiData.comments;
        delete apiData.comments;
      }
      
      // Если передан table_number, но не как число, преобразуем его
      if (apiData.table_number && typeof apiData.table_number !== 'number') {
        apiData.table_number = Number(apiData.table_number);
      }
      
      // Отправляем запрос с настройкой для получения полной ошибки
      const response = await api.post('/reservations/', apiData, {
        validateStatus: (status) => {
          return status < 500; // Получаем полный ответ для любого статуса ниже 500
        }
      });
      
      // Проверяем статус ответа
      if (response.status >= 400) {
        console.error("Ошибка от сервера:", response.status, response.data);
        
        let errorMessage = 'Ошибка при создании бронирования';
        
        if (response.data) {
          if (typeof response.data === 'object') {
            if (response.data.detail) {
              // Если detail - это массив объектов (формат FastAPI ValidationError)
              if (Array.isArray(response.data.detail)) {
                errorMessage = response.data.detail.map(error => {
                  // Типичный формат ошибки FastAPI: {loc: [...], msg: "...", type: "..."}
                  if (error.loc && error.msg) {
                    const field = error.loc.slice(1).join('.') || 'значение';
                    return `Поле "${field}": ${error.msg}`;
                  }
                  return JSON.stringify(error);
                }).join("; ");
              } else {
                errorMessage = response.data.detail;
              }
            } else {
              errorMessage = JSON.stringify(response.data);
            }
          } else if (typeof response.data === 'string') {
            errorMessage = response.data;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      console.log("Ответ от сервера:", JSON.stringify(response.data, null, 2));
      
      // Генерируем код бронирования и сохраняем его в localStorage
      const reservationCode = get().generateReservationCode(response.data.id);
      const storedCodes = JSON.parse(localStorage.getItem('reservationCodes') || '{}');
      storedCodes[reservationCode] = response.data.id;
      localStorage.setItem('reservationCodes', JSON.stringify(storedCodes));
      
      // Обновляем список бронирований с новым элементом и кодом
      const reservationWithCode = {
        ...response.data,
        reservation_code: reservationCode
      };
      
      set(state => ({
        reservations: [reservationWithCode, ...state.reservations],
        isLoading: false
      }));
      
      return reservationWithCode;
    } catch (error: any) {
      console.error('Ошибка при создании бронирования:', error);
      console.error('Детали ошибки API:', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'Нет данных ответа',
        request: error.request ? 'Request был отправлен' : 'Request не был отправлен'
      });
      
      let errorMessage = 'Ошибка при создании бронирования';
      
      if (error.response?.data) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((err: any) => {
            if (err.loc && err.msg) {
              const field = err.loc.slice(1).join('.') || 'значение';
              return `Поле "${field}": ${err.msg}`;
            }
            return typeof err === 'string' ? err : JSON.stringify(err);
          }).join('\n');
        } else if (typeof error.response.data.detail === 'string') {
          errorMessage += `: ${error.response.data.detail}`;
        } else {
          errorMessage += `: ${JSON.stringify(error.response.data.detail)}`;
        }
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw new Error(errorMessage);
    }
  },
  
  cancelReservation: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/reservations/${id}`);
      
      // Удаляем бронирование из списка
      set(state => ({
        reservations: state.reservations.filter(r => r.id !== id),
        isLoading: false
      }));
      
      // Удаляем связанный код бронирования
      const storedCodes = JSON.parse(localStorage.getItem('reservationCodes') || '{}');
      for (const [code, reservationId] of Object.entries(storedCodes)) {
        if (reservationId === id) {
          delete storedCodes[code];
        }
      }
      localStorage.setItem('reservationCodes', JSON.stringify(storedCodes));
    } catch (error) {
      console.error('Ошибка при отмене бронирования:', error);
      set({ 
        error: 'Не удалось отменить бронирование', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // Генерирует уникальный код бронирования
  generateReservationCode: (reservationId: number): string => {
    // Формат кода: XXX-YYY, где XXX - случайные символы, YYY - часть идентификатора бронирования
    const randomPart = generateRandomString(3);
    const idPart = String(reservationId).padStart(3, '0').slice(-3);
    return `${randomPart}-${idPart}`;
  },
  
  // Проверяет действительность кода бронирования
  verifyReservationCode: async (code: string): Promise<boolean> => {
    if (!code || code.length !== 7) {
      return false;
    }
    
    try {
      // Проверяем код в локальном хранилище
      const storedCodes = JSON.parse(localStorage.getItem('reservationCodes') || '{}');
      const reservationId = storedCodes[code];
      
      if (!reservationId) {
        // Если код не найден в локальном хранилище, пробуем проверить через API
        try {
          // Предполагаем, что у нас есть API-метод для проверки кода бронирования
          const response = await api.post('/reservations/verify-code', { code });
          
          // Если сервер подтвердил код, добавляем его в локальное хранилище
          if (response.data && response.data.valid) {
            storedCodes[code] = response.data.reservation_id;
            localStorage.setItem('reservationCodes', JSON.stringify(storedCodes));
            
            // Если код был использован, но всё равно действителен (для повторных заказов)
            if (response.data.used) {
              console.log(`Код ${code} уже был использован, но разрешено повторное использование`);
            }
            
            // Сохраняем информацию о столе
            if (response.data.table_id || response.data.table_number) {
              const tableInfo = {
                table_id: response.data.table_id,
                table_number: response.data.table_number,
                table_name: response.data.table_name
              };
              localStorage.setItem(`table_info_${code}`, JSON.stringify(tableInfo));
            }
            
            return true;
          }
          return false;
        } catch {
          return false;
        }
      }
      
      // Проверяем, что бронирование существует и подтверждено
      const reservations = get().reservations;
      const reservation = reservations.find(r => r.id === reservationId);
      
      if (!reservation) {
        // Если бронирования нет в кеше, запрашиваем его с сервера
        try {
          const response = await api.get(`/reservations/${reservationId}`);
          
          // Включаем даже те бронирования, которые уже были использованы для заказа
          // При условии, что они ранее были подтверждены
          const isValid = response.data && 
            (response.data.status === 'confirmed' || 
             (response.data.used_for_order && response.data.status !== 'cancelled'));
          
          // Сохраняем информацию о столе
          if (isValid && (response.data.table_id || response.data.table_number)) {
            const tableInfo = {
              table_id: response.data.table_id,
              table_number: response.data.table_number,
              table_name: response.data.table?.name
            };
            localStorage.setItem(`table_info_${code}`, JSON.stringify(tableInfo));
          }
          
          return isValid;
        } catch {
          return false;
        }
      }
      
      // Включаем даже те бронирования, которые уже были использованы для заказа
      return reservation.status === 'confirmed' || 
        (reservation.used_for_order && reservation.status !== 'cancelled');
    } catch {
      return false;
    }
  }
}));

export default useReservationsStore; 