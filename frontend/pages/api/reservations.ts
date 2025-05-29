import { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Путь к кешу
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const RESERVATIONS_CACHE_FILE = path.join(CACHE_DIR, 'reservations_cache.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 минут в миллисекундах

// Убедимся, что директория кеша существует
const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

// Получение данных из кеша
const getFromCache = (key: string) => {
  try {
    ensureCacheDir();
    if (!fs.existsSync(RESERVATIONS_CACHE_FILE)) {
      return null;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(RESERVATIONS_CACHE_FILE, 'utf8'));
    if (!cacheData[key] || (Date.now() - cacheData[key].timestamp > CACHE_TTL)) {
      return null;
    }
    
    return cacheData[key].data;
  } catch (error) {
    console.error('Ошибка при чтении кеша:', error);
    return null;
  }
};

// Сохранение данных в кеш
const saveToCache = (key: string, data: any) => {
  try {
    ensureCacheDir();
    
    let cacheData = {};
    if (fs.existsSync(RESERVATIONS_CACHE_FILE)) {
      cacheData = JSON.parse(fs.readFileSync(RESERVATIONS_CACHE_FILE, 'utf8'));
    }
    
    cacheData = {
      ...cacheData,
      [key]: {
        data,
        timestamp: Date.now()
      }
    };
    
    fs.writeFileSync(RESERVATIONS_CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка при сохранении в кеш:', error);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Получаем данные из запроса
  const { method, query, body } = req;
  const token = req.headers.authorization;
  const userId = req.headers['x-user-id'];
  
  try {
    // Формируем ключ для кеширования
    const cacheKey = `reservations_${JSON.stringify(query)}`;
    
    // Проверяем наличие данных в кеше
    if (method === 'GET') {
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log('API Proxy: Данные бронирований получены из кеша');
        return res.status(200).json(cachedData);
      }
    }

    // Получаем базовый URL API
    let baseApiUrl = getDefaultApiUrl();
    
    // Важно: путь должен быть /api/v1/reservations
    // Убедимся что URL правильно сформирован и содержит /api/v1
    if (!baseApiUrl.includes('/api/v1')) {
      baseApiUrl = baseApiUrl.replace(/\/+$/, '') + '/api/v1';
    }
    
    // Формируем корректный URL для запроса к бэкенду
    const url = `${baseApiUrl.replace(/\/+$/, '')}/reservations${query && Object.keys(query).length > 0 
      ? `?${new URLSearchParams(query as Record<string, string>).toString()}` 
      : ''}`;

    console.log('API Proxy: Отправка запроса на', url);

    // Формируем заголовки запроса
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Добавляем заголовки авторизации
    if (token) {
      headers['Authorization'] = token;
    }
    if (userId) {
      headers['X-User-ID'] = userId.toString();
    }

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к бэкенду с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Увеличиваем таймаут до 15 секунд

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // @ts-ignore - добавляем агент напрямую
        agent: url.startsWith('https') ? httpsAgent : undefined
      });

      clearTimeout(timeoutId);
      
      console.log(`API Proxy: Получен ответ, статус ${response.status}, тип: ${response.headers.get('content-type')}`);
      
      // Проверяем, что ответ успешный
      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
      }
      
      // Проверяем Content-Type
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        console.warn(`API Proxy: Некорректный Content-Type: ${contentType}`);
      }
      
      // Получаем текст ответа сначала
      const text = await response.text();
      
      // Логируем начало ответа для отладки
      console.log(`API Proxy: Начало ответа: ${text.substring(0, 100)}...`);
      
      // Пробуем парсить JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonError: any) {
        console.error('API Proxy: Ошибка парсинга JSON:', jsonError);
        throw new Error(`Ошибка парсинга JSON: ${jsonError.message}. Текст ответа: ${text.substring(0, 100)}...`);
      }

      // Если это GET запрос, кешируем результат
      if (method === 'GET') {
        saveToCache(cacheKey, data);
      }

      // Отправляем ответ клиенту
      return res.status(200).json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('[API Proxy] Ошибка при отправке запроса:', fetchError.message);
      
      // Проверяем наличие авторизации
      const hasAuthToken = !!token;
      
      // Проверяем наличие кэшированных данных
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log('[API Proxy] Возвращаем кэшированные данные из-за ошибки запроса');
        return res.status(200).json(cachedData);
      }
      
      // Если пользователь авторизован и кэша нет, пробуем сделать запрос альтернативным способом
      if (hasAuthToken) {
        try {
          // Попробуем запросить данные через альтернативный URL
          const altBaseUrl = baseApiUrl.includes('/api/v1') 
            ? baseApiUrl.replace('/api/v1', '') 
            : baseApiUrl;
            
          const altUrl = `${altBaseUrl.replace(/\/+$/, '')}/reservations${query && Object.keys(query).length > 0 
            ? `?${new URLSearchParams(query as Record<string, string>).toString()}` 
            : ''}`;
            
          console.log('[API Proxy] Пробуем альтернативный URL:', altUrl);
          
          const altController = new AbortController();
          const altTimeoutId = setTimeout(() => altController.abort(), 10000);
          
          const altResponse = await fetch(altUrl, {
            method,
            headers,
            signal: altController.signal,
            // @ts-ignore
            agent: altUrl.startsWith('https') ? httpsAgent : undefined
          });
          
          clearTimeout(altTimeoutId);
          
          if (!altResponse.ok) {
            throw new Error(`Альтернативный запрос: HTTP ошибка ${altResponse.status}`);
          }
          
          const altText = await altResponse.text();
          console.log(`[API Proxy] Альтернативный ответ получен: ${altText.substring(0, 100)}...`);
          
          const altData = JSON.parse(altText);
          
          // Кэшируем результат
          if (method === 'GET') {
            saveToCache(cacheKey, altData);
          }
          
          // Возвращаем данные
          return res.status(200).json(altData);
        } catch (altError) {
          console.error('[API Proxy] Ошибка альтернативного запроса:', altError);
          
          // Возвращаем демо-данные для авторизованных пользователей, только если нет кэша
          console.log('[API Proxy] Возвращаем демо-данные для авторизованного пользователя (нет кэша)');
          const demoReservations = generateDemoReservations();
          saveToCache(cacheKey, demoReservations);
          return res.status(200).json(demoReservations);
        }
      } else {
        // Для неавторизованных пользователей возвращаем демо-данные
        console.log('[API Proxy] Пользователь не авторизован, возвращаем демо-данные');
        const demoReservations = generateDemoReservations();
        saveToCache(cacheKey, demoReservations);
        return res.status(200).json(demoReservations);
      }
    }
  } catch (error: any) {
    console.error('[API Proxy] Ошибка при обработке запроса бронирований:', error);
    
    // Проверяем наличие кэшированных данных
    const cacheKey = `reservations_${JSON.stringify(query)}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('[API Proxy] Возвращаем кэшированные данные из-за общей ошибки');
      return res.status(200).json(cachedData);
    }
    
    // Проверяем наличие авторизации
    const hasAuthToken = !!token;
    if (hasAuthToken) {
      // Для авторизованных пользователей без кэша возвращаем демо-данные
      console.log('[API Proxy] Возвращаем демо-данные для авторизованного пользователя (общая ошибка)');
      const demoReservations = generateDemoReservations();
      return res.status(200).json(demoReservations);
    } else {
      // Для неавторизованных пользователей возвращаем демо-данные
      console.log('[API Proxy] Пользователь не авторизован, возвращаем демо-данные');
      const demoReservations = generateDemoReservations();
      return res.status(200).json(demoReservations);
    }
  }
}

// Функция для генерации демо-данных бронирований
function generateDemoReservations() {
  const now = new Date();
  
  // Генерируем дату в прошлом со случайным смещением (до 10 дней назад)
  const getRandomPastDate = () => {
    const date = new Date(now);
    const randomDaysBack = Math.floor(Math.random() * 10) + 1;
    date.setDate(date.getDate() - randomDaysBack);
    return date.toISOString();
  };
  
  // Генерируем дату в будущем со случайным смещением (до 10 дней вперед)
  const getRandomFutureDate = () => {
    const date = new Date(now);
    const randomDaysForward = Math.floor(Math.random() * 10) + 1;
    date.setDate(date.getDate() + randomDaysForward);
    return date.toISOString();
  };
  
  // Генерируем случайное число в заданном диапазоне
  const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  // Список статусов бронирования
  const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  
  // Генерируем демо-бронирования
  const reservationCount = getRandomInt(5, 10);
  const reservations = [];
  
  for (let i = 0; i < reservationCount; i++) {
    const id = 1000 + i + 1;
    const created_at = getRandomPastDate();
    const reservation_time = getRandomFutureDate();
    const status = statuses[getRandomInt(0, statuses.length - 1)];
    
    reservations.push({
      id,
      user_id: getRandomInt(1, 5),
      table_id: getRandomInt(1, 10),
      table_number: getRandomInt(1, 10),
      guests_count: getRandomInt(1, 6),
      reservation_time,
      created_at,
      updated_at: created_at,
      status,
      guest_name: ['Александр Иванов', 'Елена Петрова', 'Дмитрий Сидоров', 'Андрей Кузнецов', 'Наталья Смирнова'][getRandomInt(0, 4)],
      guest_phone: `+7 (${getRandomInt(900, 999)}) ${getRandomInt(100, 999)}-${getRandomInt(10, 99)}-${getRandomInt(10, 99)}`,
      guest_email: `user${getRandomInt(1, 999)}@example.com`,
      comment: Math.random() < 0.3 ? 'Комментарий к бронированию' : null,
      reservation_code: `RES-${getRandomInt(1000, 9999)}`
    });
  }
  
  console.log(`[API Proxy] Сгенерировано ${reservations.length} демо-бронирований`);
  return reservations;
} 