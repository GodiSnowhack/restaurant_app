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
      // Получаем токен авторизации
      const token = await getAuthToken();
      if (!token) {
        console.error('[Reservations API] Ошибка авторизации: отсутствует токен');
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
      
      // Проверяем кэш (используем его, если данные не старше 2 минут)
      const cachedData = localStorage.getItem(cacheKey);
      const cacheTimestamp = localStorage.getItem(cacheTimeKey);
      
      if (cachedData && cacheTimestamp && !params) { // Используем кэш только для запроса без фильтров
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        if (cacheAge < 2 * 60 * 1000) { // 2 минуты
          console.log(`[Reservations API] Используем кэшированные данные (возраст: ${Math.round(cacheAge/1000)}с)`);
          try {
            return JSON.parse(cachedData);
          } catch (e) {
            console.error('[Reservations API] Ошибка при разборе кэшированных данных');
          }
        }
      }
      
      // Подготавливаем URL и заголовки запроса
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      };
      
      console.log(`[Reservations API] Запрос бронирований${queryParams ? ` с параметрами: ${queryParams}` : ''}`);
      
      // Устанавливаем таймаут для запроса
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
      
      try {
        // Отправляем запрос через API
        const response = await api.get<Reservation[]>(`/reservations${queryParams}`, {
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.data) {
          // Кэшируем результат запроса без фильтров
          if (!params) {
            localStorage.setItem(cacheKey, JSON.stringify(response.data));
            localStorage.setItem(cacheTimeKey, Date.now().toString());
          }
          
          console.log(`[Reservations API] Получено ${response.data.length} бронирований`);
          return response.data;
        }
        
        throw new Error('Сервер вернул пустой ответ');
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Если ошибка связана с таймаутом
        if (error.name === 'AbortError') {
          console.error('[Reservations API] Превышено время ожидания запроса');
        } else {
          console.error('[Reservations API] Ошибка при запросе бронирований:', error);
        }
        
        // Возвращаем кэшированные данные в случае ошибки
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          console.log('[Reservations API] Используем кэшированные данные из-за ошибки');
          try {
            return JSON.parse(cachedData);
          } catch (e) {
            console.error('[Reservations API] Ошибка при разборе кэшированных данных');
          }
        }
        
        return [];
      }
    } catch (error: any) {
      console.error('[Reservations API] Критическая ошибка:', error);
      
      // Возвращаем кэшированные данные в случае ошибки
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        console.log('[Reservations API] Используем кэшированные данные из-за ошибки');
        try {
          return JSON.parse(cachedData);
        } catch (e) {
          console.error('[Reservations API] Ошибка при разборе кэшированных данных');
        }
      }
      
      return [];
    }
  },
  
  /**
   * Получение бронирования по ID
   */
  getReservationById: async (id: number): Promise<Reservation | null> => {
    try {
      // Получаем токен авторизации
      const token = await getAuthToken();
      if (!token) {
        console.error('[Reservations API] Ошибка авторизации: отсутствует токен');
        return null;
      }
      
      // Отправляем запрос на получение бронирования
      const response = await fetch(`/reservations/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
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
      // Получаем токен авторизации
      const token = await getAuthToken();
      if (!token) {
        console.error('[Reservations API] Ошибка авторизации: отсутствует токен');
        return false;
      }
      
      console.log(`[Reservations API] Обновление статуса бронирования #${id} на "${status}"`);
      
      // Отправляем запрос на обновление статуса
      const response = await fetch(`/reservations/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка HTTP: ${response.status} - ${errorText}`);
      }
      
      // Очищаем кэш бронирований при успешном обновлении
      localStorage.removeItem('reservations_data_cache');
      console.log(`[Reservations API] Статус бронирования #${id} успешно обновлен на "${status}"`);
      
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
      // Получаем токен авторизации
      const token = await getAuthToken();
      if (!token) {
        console.error('[Reservations API] Ошибка авторизации: отсутствует токен');
        return false;
      }
      
      console.log(`[Reservations API] Удаление бронирования #${id}`);
      
      // Отправляем запрос на удаление бронирования
      const response = await fetch(`/reservations?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка HTTP: ${response.status} - ${errorText}`);
      }
      
      // Очищаем кэш бронирований при успешном удалении
      localStorage.removeItem('reservations_data_cache');
      console.log(`[Reservations API] Бронирование #${id} успешно удалено`);
      
      return true;
    } catch (error) {
      console.error(`[Reservations API] Ошибка при удалении бронирования #${id}:`, error);
      return false;
    }
  },

  // Создание нового бронирования
  createReservation: async (data: any) => {
    console.log('API: Создание бронирования...');
    try {
      const response = await api.post('/reservations', data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при создании бронирования:', error);
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