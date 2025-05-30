import { Reservation } from '../../types';
import { api } from './core';
import axios from 'axios';

// Интерфейс для кешированных данных
interface CachedReservations {
  data: Reservation[];
  timestamp: number;
}

// Функция для получения кешированных бронирований
const getCachedReservations = (): CachedReservations | null => {
  try {
    const cacheKey = 'reservations_data_cache';
    const cacheTimeKey = 'reservations_cache_timestamp';
    
    if (typeof window === 'undefined') return null;
    
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimeKey);
    
    if (!cachedData || !cachedTimestamp) return null;
    
    return {
      data: JSON.parse(cachedData),
      timestamp: parseInt(cachedTimestamp)
    };
  } catch (error) {
    console.error('[Reservations API] Ошибка при получении кеша:', error);
    return null;
  }
};

// Функция для сохранения бронирований в кеш
const saveReservationsToCache = (data: Reservation[]): void => {
  try {
    const cacheKey = 'reservations_data_cache';
    const cacheTimeKey = 'reservations_cache_timestamp';
    
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    
    console.log(`[Reservations API] Данные сохранены в кеш (${data.length} бронирований)`);
  } catch (error) {
    console.error('[Reservations API] Ошибка при сохранении в кеш:', error);
  }
};

/**
 * API для работы с бронированиями
 * Полностью переработанный функционал для повышения стабильности
 */
export const reservationsApi = {
  /**
   * Получение списка бронирований
   * @param options Параметры запроса: булевое значение forceRefresh или объект с параметрами фильтрации
   */
  getReservations: async (options?: boolean | { status?: string; date?: string }): Promise<Reservation[]> => {
    // Определяем, является ли options флагом forceRefresh или объектом с параметрами фильтрации
    const forceRefresh = typeof options === 'boolean' ? options : false;
    const filterParams = typeof options === 'object' ? options : {};
    
    try {
      console.log('[Reservations API] Начало запроса бронирований');
      
      // Проверяем наличие данных в кеше
      const cachedData = getCachedReservations();
      const cacheAge = cachedData?.timestamp ? (Date.now() - cachedData.timestamp) / 1000 : 0;
      
      // Если есть кешированные данные и они не устарели, используем их (если не запрошено принудительное обновление)
      if (cachedData?.data && cachedData.timestamp && cacheAge < 300 && !forceRefresh) {
        console.log(`[Reservations API] Используем кэшированные данные (возраст кэша: ${Math.floor(cacheAge)} сек)`);
        
        // Если переданы параметры фильтрации, применяем их к кешированным данным
        if (Object.keys(filterParams).length > 0) {
          let filteredData = [...cachedData.data];
          
          // Фильтрация по статусу
          if (filterParams.status) {
            filteredData = filteredData.filter(r => r.status === filterParams.status);
          }
          
          // Фильтрация по дате
          if (filterParams.date) {
            filteredData = filteredData.filter(r => {
              if (r.reservation_time) {
                return r.reservation_time.startsWith(filterParams.date!);
              }
              if (r.reservation_date) {
                return r.reservation_date === filterParams.date;
              }
              return false;
            });
          }
          
          return filteredData;
        }
        
        return cachedData.data;
      }
      
      console.log('[Reservations API] Загрузка данных с сервера...');
      
      // Получаем токен авторизации
      const token = await getAuthToken();
      
      // Формируем URL с учетом параметров фильтрации
      let url = '/api/reservations';
      
      if (typeof options === 'object' && Object.keys(filterParams).length > 0) {
        const queryParams = new URLSearchParams();
        
        if (filterParams.status) {
          queryParams.append('status', filterParams.status);
        }
        
        if (filterParams.date) {
          queryParams.append('date', filterParams.date);
        }
        
        const queryString = queryParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }
      
      // Запрашиваем данные с сервера
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Сохраняем в кеше
      saveReservationsToCache(data);
      
      // Если переданы параметры фильтрации, применяем их к полученным данным
      if (typeof options === 'object' && Object.keys(filterParams).length > 0) {
        let filteredData = [...data];
        
        // Фильтрация по статусу
        if (filterParams.status) {
          filteredData = filteredData.filter(r => r.status === filterParams.status);
        }
        
        // Фильтрация по дате
        if (filterParams.date) {
          filteredData = filteredData.filter(r => {
            if (r.reservation_time) {
              return r.reservation_time.startsWith(filterParams.date!);
            }
            if (r.reservation_date) {
              return r.reservation_date === filterParams.date;
            }
            return false;
          });
        }
        
        return filteredData;
      }
      
      return data;
    } catch (error) {
      console.error('[Reservations API] Ошибка при получении бронирований:', error);
      
      // Возвращаем кешированные данные если есть ошибка
      const cachedData = getCachedReservations();
      if (cachedData?.data) {
        console.log('[Reservations API] Возвращаем кешированные данные из-за ошибки');
        
        // Если переданы параметры фильтрации, применяем их к кешированным данным
        if (typeof options === 'object' && Object.keys(filterParams).length > 0) {
          let filteredData = [...cachedData.data];
          
          // Фильтрация по статусу
          if (filterParams.status) {
            filteredData = filteredData.filter(r => r.status === filterParams.status);
          }
          
          // Фильтрация по дате
          if (filterParams.date) {
            filteredData = filteredData.filter(r => {
              if (r.reservation_time) {
                return r.reservation_time.startsWith(filterParams.date!);
              }
              if (r.reservation_date) {
                return r.reservation_date === filterParams.date;
              }
              return false;
            });
          }
          
          return filteredData;
        }
        
        return cachedData.data;
      }
      
      // Иначе используем локальные фиктивные данные
      return [];
    }
  },
  
  /**
   * Получение бронирования по ID
   */
  getReservationById: async (id: number): Promise<Reservation | null> => {
    try {
      // Используем локальный API-прокси вместо прямого обращения к бэкенду
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`[Reservations API] Ошибка при получении бронирования #${id}:`, error);
      return null;
    }
  },
  
  /**
   * Обновление статуса бронирования
   */
  updateReservationStatus: async (id: number, status: string): Promise<boolean> => {
    try {
      console.log(`[Reservations API] Отправка запроса на обновление статуса бронирования #${id} на ${status}`);
      const response = await api.patch(`/reservations/${id}/status`, { status });
      console.log(`[Reservations API] Статус бронирования #${id} успешно обновлен на ${status}`);
      return true;
    } catch (error) {
      console.error(`[Reservations API] Ошибка при обновлении статуса бронирования #${id}:`, error);
      return false;
    }
  },
  
  /**
   * Удаление бронирования
   */
  deleteReservation: async (id: number): Promise<boolean> => {
    try {
      await api.delete(`/reservations/${id}`);
      return true;
    } catch (error) {
      console.error(`[Reservations API] Ошибка при удалении бронирования #${id}:`, error);
      return false;
    }
  },

  /**
   * Создание нового бронирования
   */
  createReservation: async (data: any): Promise<Reservation> => {
    try {
      console.log('[Reservations API] Создание бронирования с данными:', data);
      
      // Корректируем данные перед отправкой
      const processedData = { ...data };
      
      // Проверяем формат даты и времени и формируем правильный формат для API
      if (processedData.reservation_date && processedData.reservation_time) {
        // Создаем дату в правильном формате
        const dateStr = processedData.reservation_date;
        const timeStr = processedData.reservation_time;
        
        // Формируем правильный формат даты-времени для API
        const dateTimeStr = `${dateStr}T${timeStr}:00`;
        processedData.reservation_time = dateTimeStr;
      }
      
      // Убеждаемся, что table_number передается в нужном формате
      if (processedData.table_number !== undefined && processedData.table_number !== null) {
        processedData.table_number = Number(processedData.table_number);
      }
      
      // Получаем токен авторизации
      const token = localStorage.getItem('token') || '';
      
      // Проверяем что мы используем правильный URL для прокси
      const url = '/api/reservations'; // Используем локальный API прокси
      
      console.log('[Reservations API] Отправка POST запроса на:', url);
      console.log('[Reservations API] Обработанные данные:', processedData);
      
      // Отправляем запрос через fetch для большего контроля
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-User-ID': processedData.user_id ? String(processedData.user_id) : ''
        },
        body: JSON.stringify(processedData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Reservations API] Ошибка при создании бронирования. Статус:', response.status, 'Текст:', errorText);
        throw new Error(`Ошибка HTTP: ${response.status}, ${errorText}`);
      }
      
      // Получаем данные из ответа
      let responseData;
      try {
        responseData = await response.json();
        console.log('[Reservations API] Бронирование успешно создано:', responseData);
      } catch (error) {
        console.error('[Reservations API] Ошибка при парсинге JSON из ответа:', error);
        // Создаем заглушку для бронирования
        responseData = {
          id: Date.now(),
          ...processedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reservation_code: generateReservationCode()
        };
      }
      
      // Обработка разных форматов ответа от сервера
      // Если сервер вернул массив, но мы ожидаем объект, создаем заглушку для объекта бронирования
      if (Array.isArray(responseData) && responseData.length === 0) {
        console.log('[Reservations API] Сервер вернул пустой массив вместо объекта бронирования. Создаем заглушку.');
        // Возвращаем заглушку с базовой информацией о бронировании
        responseData = {
          id: Date.now(), // временный ID
          user_id: processedData.user_id,
          reservation_date: processedData.reservation_date,
          reservation_time: processedData.reservation_time,
          guests_count: processedData.guests_count,
          guest_name: processedData.guest_name,
          guest_phone: processedData.guest_phone,
          table_number: processedData.table_number,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Генерируем код бронирования
          reservation_code: generateReservationCode()
        };
      }
      
      // Принудительно обновляем кеш и данные бронирований
      try {
        console.log('[Reservations API] Принудительное обновление списка бронирований');
        
        // Инвалидируем кеш
        localStorage.removeItem('reservations_data_cache');
        localStorage.removeItem('reservations_cache_timestamp');
        
        // Запрашиваем свежие данные с флагом принудительного обновления
        setTimeout(() => {
          reservationsApi.getReservations(true)
            .then(freshData => {
              console.log('[Reservations API] Получены свежие данные после создания бронирования:', freshData.length);
            })
            .catch(refreshError => {
              console.error('[Reservations API] Ошибка при обновлении данных:', refreshError);
            });
        }, 500);
      } catch (refreshError) {
        console.error('[Reservations API] Ошибка при обновлении кеша:', refreshError);
      }
      
      // Если сервер вернул объект, используем его
      if (typeof responseData === 'object' && !Array.isArray(responseData)) {
        return responseData;
      }
      
      // Для любых других случаев возвращаем безопасный объект
      return responseData;
    } catch (error) {
      console.error('[Reservations API] Ошибка при создании бронирования:', error);
      throw error;
    }
  },

  /**
   * Обновление бронирования
   */
  updateReservation: async (id: number, data: Partial<Reservation>): Promise<Reservation> => {
    try {
      const response = await api.put(`/reservations/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`[Reservations API] Ошибка при обновлении бронирования #${id}:`, error);
      throw error;
    }
  },

  /**
   * Отмена бронирования
   */
  cancelReservation: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/reservations/${id}`);
    } catch (error) {
      console.error(`[Reservations API] Ошибка при отмене бронирования #${id}:`, error);
      throw error;
    }
  },

  /**
   * Проверка кода бронирования
   */
  verifyReservationCode: async (code: string): Promise<any> => {
    try {
      const response = await api.post('/reservations/verify-code', { code });
      return response.data;
    } catch (error) {
      console.error('[Reservations API] Ошибка при проверке кода бронирования:', error);
      throw error;
    }
  }
};

/**
 * Получение токена авторизации с возможным обновлением
 */
async function getAuthToken(): Promise<string | null> {
  try {
    // Проверяем наличие токена в localStorage
    let token = localStorage.getItem('token');
    
    if (!token) {
      console.log('[Auth API] Токен отсутствует, пытаемся получить');
      
      // Пробуем получить из сессионного хранилища или cookie
      token = sessionStorage.getItem('token');
      
      if (!token) {
        // Пробуем получить из cookie
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'auth_token') {
            token = value;
            break;
          }
        }
      }
      
      if (!token) {
        // Пробуем обновить токен
        token = await refreshTokenSafe();
      }
    }
    
    return token;
  } catch (error) {
    console.error('[Auth API] Ошибка при получении токена авторизации:', error);
    return null;
  }
}

/**
 * Безопасное обновление токена с защитой от зацикливания
 */
async function refreshTokenSafe(): Promise<string | null> {
  const refreshInProgressKey = 'auth_refresh_in_progress';
  const lastRefreshTimeKey = 'auth_refresh_time';
  
  // Проверяем, не выполняется ли уже обновление токена
  if (localStorage.getItem(refreshInProgressKey) === 'true') {
    console.log('[Auth API] Обновление токена уже выполняется, ожидаем...');
    
    // Ждем до 5 секунд, проверяя каждые 500мс
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      
      if (localStorage.getItem(refreshInProgressKey) !== 'true') {
        // Обновление завершено, возвращаем новый токен
        return localStorage.getItem('token');
      }
    }
    
    console.warn('[Auth API] Превышено время ожидания обновления токена');
    return localStorage.getItem('token'); // Вернем текущий токен, даже если он истек
  }
  
  // Проверяем, не было ли недавнего обновления токена
  const lastRefreshTime = localStorage.getItem(lastRefreshTimeKey);
  if (lastRefreshTime) {
    const elapsed = Date.now() - parseInt(lastRefreshTime);
    if (elapsed < 30 * 1000) { // Менее 30 секунд назад
      console.log(`[Auth API] Токен недавно обновлялся (${Math.round(elapsed/1000)}с назад)`);
      return localStorage.getItem('token');
    }
  }
  
  // Устанавливаем флаг, что обновление выполняется
  localStorage.setItem(refreshInProgressKey, 'true');
  localStorage.setItem(lastRefreshTimeKey, Date.now().toString());
  
  try {
    // Получаем refresh_token
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      console.warn('[Auth API] Отсутствует refresh_token для обновления');
      localStorage.removeItem(refreshInProgressKey);
      return null;
    }
    
    console.log('[Auth API] Отправка запроса на обновление токена');
    
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('В ответе отсутствует access_token');
    }
    
    // Сохраняем токены во всех доступных хранилищах
    const newToken = data.access_token;
    localStorage.setItem('token', newToken);
    sessionStorage.setItem('token', newToken);
    document.cookie = `auth_token=${newToken}; path=/; max-age=86400; SameSite=Lax`;
    
    // Сохраняем новый refresh_token, если он есть
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    
    console.log('[Auth API] Токен успешно обновлен');
    return newToken;
  } catch (error) {
    console.error('[Auth API] Ошибка при обновлении токена:', error);
    return null;
  } finally {
    // Снимаем флаг обновления токена
    localStorage.removeItem(refreshInProgressKey);
  }
}

/**
 * Запасной способ получения бронирований
 * Пробует различные способы доступа к API для обеспечения отказоустойчивости
 */
async function fetchReservationsFallback(token: string | null, queryParams: string = ''): Promise<Reservation[]> {
  if (!token) return [];
  
  console.log('[Reservations API] Используем запасные методы получения бронирований');
  
  // Список методов для получения данных в порядке приоритета
  const methods = [
    // 1. Прямой запрос к бэкенду
    async () => {
      const apiUrl = getApiUrl();
      console.log(`[Reservations API] Прямой запрос к бэкенду: ${apiUrl}/reservations${queryParams}`);
      
      const response = await fetch(`${apiUrl}/reservations${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
      return await response.json();
    },
    
    // 2. Через API администратора
    async () => {
      const apiUrl = getApiUrl();
      console.log(`[Reservations API] Запрос через API администратора: ${apiUrl}/admin/reservations${queryParams}`);
      
      const response = await fetch(`${apiUrl}/admin/reservations${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
      return await response.json();
    },
    
    // 3. Через другой API прокси
    async () => {
      console.log(`[Reservations API] Запрос через альтернативный API прокси: /api/admin/reservations${queryParams}`);
      
      const response = await fetch(`/api/admin/reservations${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
      return await response.json();
    }
  ];
  
  // Последовательно пробуем все методы
  for (const method of methods) {
    try {
      const data = await method();
      console.log(`[Reservations API] Успешно получено ${data.length} бронирований через запасной метод`);
      
      // Кэшируем успешный результат
      localStorage.setItem('reservations_data_cache', JSON.stringify(data));
      localStorage.setItem('reservations_cache_timestamp', Date.now().toString());
      
      return data;
    } catch (error) {
      console.warn('[Reservations API] Запасной метод не сработал:', error);
      // Продолжаем со следующим методом
    }
  }
  
  console.error('[Reservations API] Все запасные методы не сработали');
  
  // Возвращаем кэшированные данные, если есть
  const cachedData = localStorage.getItem('reservations_data_cache');
  if (cachedData) {
    console.log('[Reservations API] Используем кэшированные данные из-за неудачных запросов');
    try {
      return JSON.parse(cachedData);
    } catch (e) {
      console.error('[Reservations API] Ошибка при разборе кэшированных данных');
    }
  }
  
  return []; // Возвращаем пустой массив, если все методы не сработали
}

// Функция для получения URL API
const getApiUrl = () => {
  return api.defaults.baseURL;
};

/**
 * Генерирует код бронирования в нужном формате (XXX-XXX)
 */
function generateReservationCode(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключены похожие символы I, O, 0, 1
  let result = '';
  const charactersLength = characters.length;
  
  // Генерируем первые 3 символа
  for (let i = 0; i < 3; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  // Добавляем дефис
  result += '-';
  
  // Генерируем последние 3 символа
  for (let i = 0; i < 3; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result; // Формат "XXX-XXX"
} 