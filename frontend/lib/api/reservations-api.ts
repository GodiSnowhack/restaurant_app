import { Reservation } from '../../types';
import { api } from './core';

/**
 * API для работы с бронированиями
 * Полностью переработанный функционал для повышения стабильности
 */
export const reservationsApi = {
  /**
   * Получение списка бронирований с возможностью фильтрации
   * @param params Параметры фильтрации (status, date)
   */
  getReservations: async (params?: { status?: string; date?: string }): Promise<Reservation[]> => {
    // Ключи для кэширования
    const cacheKey = 'reservations_data_cache';
    const cacheTimeKey = 'reservations_cache_timestamp';
    
    try {
      console.log('[Reservations API] Начало запроса бронирований');
      
      // Проверяем наличие кэша и его актуальность
      const cachedTimestamp = localStorage.getItem(cacheTimeKey);
      const cachedData = localStorage.getItem(cacheKey);
      const now = Date.now();
      const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp) : Infinity;
      
      // Используем кэш, если он не старше 5 минут и нет дополнительных параметров
      if (!params && cachedData && cachedTimestamp && cacheAge < 5 * 60 * 1000) {
        console.log('[Reservations API] Используем кэшированные данные (возраст кэша:', Math.round(cacheAge/1000), 'сек)');
        return JSON.parse(cachedData);
      }
      
      // Получаем токен авторизации
      const token = await getAuthToken();
      console.log('[Reservations API] Токен авторизации:', token ? 'получен' : 'отсутствует');
      
      if (!token) {
        console.error('[Reservations API] Ошибка авторизации: отсутствует токен');
        // Возвращаем кэшированные данные если есть, иначе пустой массив
        if (cachedData) {
          console.log('[Reservations API] Используем кэшированные данные из-за отсутствия токена');
          return JSON.parse(cachedData);
        }
        return [];
      }
      
      // Формируем параметры запроса
      let queryParams = '';
      if (params) {
        const queryParts = [];
        if (params.status) queryParts.push(`status=${params.status}`);
        if (params.date) queryParts.push(`date=${params.date}`);
        
        if (queryParts.length > 0) {
          queryParams = `?${queryParts.join('&')}`;
        }
      }
      
      // Пробуем сначала через API-прокси
      console.log(`[Reservations API] Отправка запроса на /api/reservations${queryParams}`);
      
      // Создаем контроллер для отмены запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
      
      try {
        // Сначала попробуем через прокси API
        let response = await fetch(`/api/reservations${queryParams}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Если прокси вернул 404, пробуем прямой запрос к бэкенду
        if (response.status === 404) {
          console.log('[Reservations API] Прокси вернул 404, пробуем прямой запрос к бэкенду');
          
          // Получаем базовый URL API
          const baseApiUrl = api.defaults.baseURL || '';
          
          // Создаем новый контроллер для второго запроса
          const directController = new AbortController();
          const directTimeoutId = setTimeout(() => directController.abort(), 10000);
          
          try {
            response = await fetch(`${baseApiUrl}/reservations${queryParams}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              signal: directController.signal
            });
            
            clearTimeout(directTimeoutId);
          } catch (directError) {
            clearTimeout(directTimeoutId);
            console.error('[Reservations API] Ошибка при прямом запросе:', directError);
            throw directError;
          }
        }
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('[Reservations API] Ответ получен:', {
          status: response.status,
          dataLength: Array.isArray(data) ? data.length : 'не массив'
        });
        
        if (Array.isArray(data)) {
          // Кэшируем результат запроса без фильтров
          if (!params) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data));
              localStorage.setItem(cacheTimeKey, Date.now().toString());
            } catch (e) {
              console.error('[Reservations API] Ошибка при кэшировании данных:', e);
            }
          }
          
          console.log(`[Reservations API] Получено ${data.length} бронирований`);
          return data;
        } else if (data && typeof data === 'object' && data.items && Array.isArray(data.items)) {
          // На случай, если API возвращает данные в формате { items: [] }
          console.log(`[Reservations API] Получено ${data.items.length} бронирований в формате items`);
          
          // Кэшируем
          if (!params) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data.items));
              localStorage.setItem(cacheTimeKey, Date.now().toString());
            } catch (e) {
              console.error('[Reservations API] Ошибка при кэшировании данных:', e);
            }
          }
          
          return data.items;
        } else {
          console.warn('[Reservations API] Сервер вернул неожиданный формат данных:', data);
          // Возвращаем кэшированные данные, если есть
          if (cachedData) {
            console.log('[Reservations API] Используем кэшированные данные из-за неожиданного формата');
            return JSON.parse(cachedData);
          }
          return [];
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error: any) {
      console.error('[Reservations API] Критическая ошибка:', error);
      
      // Возвращаем кэшированные данные в случае ошибки
      if (typeof window !== 'undefined') {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          console.log('[Reservations API] Используем кэшированные данные из-за ошибки');
          try {
            return JSON.parse(cachedData);
          } catch (e) {
            console.error('[Reservations API] Ошибка при разборе кэшированных данных');
          }
        }
      }
      
      // Если кэшированных данных нет, используем пустой массив
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
      const response = await api.patch(`/api/reservations/${id}/status`, { status });
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
      await api.delete(`/api/reservations/${id}`);
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
      
      const responseData = await response.json();
      console.log('[Reservations API] Бронирование успешно создано:', responseData);
      
      // Обработка разных форматов ответа от сервера
      // Если сервер вернул массив, но мы ожидаем объект, создаем заглушку для объекта бронирования
      if (Array.isArray(responseData) && responseData.length === 0) {
        console.log('[Reservations API] Сервер вернул пустой массив вместо объекта бронирования. Создаем заглушку.');
        // Возвращаем заглушку с базовой информацией о бронировании
        return {
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
          reservation_code: `RES-${Math.floor(1000 + Math.random() * 9000)}`
        };
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
      const response = await api.put(`/api/reservations/${id}`, data);
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
      const response = await api.post('/api/reservations/verify-code', { code });
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