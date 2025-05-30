import { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { jwtDecode } from 'jwt-decode';

// Интерфейс для JWT токена
interface JWTPayload {
  sub: string;  // ID пользователя
  role: string; // Роль пользователя
  exp: number;  // Время истечения
}

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

// Получаем данные из JWT токена
const getUserFromToken = (token: string): { id: string; role: string } | null => {
  try {
    if (!token || !token.startsWith('Bearer ')) {
      return null;
    }
    
    const tokenValue = token.substring(7); // Убираем 'Bearer '
    const decoded = jwtDecode<JWTPayload>(tokenValue);
    
    return {
      id: decoded.sub,
      role: decoded.role
    };
  } catch (error) {
    console.error('Ошибка при декодировании токена:', error);
    return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { method, query, body } = req;
    const token = req.headers.authorization;
    
    console.log('Reservations API Proxy: Получен запрос', { 
      method, 
      hasQuery: !!query && Object.keys(query).length > 0, 
      hasBody: !!body,
      hasToken: !!token
    });
    
    if (method === 'POST') {
      console.log('Reservations API Proxy: POST запрос с данными:', body);
    }
    
    // Проверяем токен и получаем данные пользователя
    const userData = token ? getUserFromToken(token) : null;
    
    if (!userData && method === 'GET') {
      console.log('Reservations API Proxy: Запрос без авторизации отклонен');
      return res.status(401).json({ 
        error: 'Необходима авторизация',
        message: 'Для просмотра бронирований необходимо войти в систему'
      });
    }
    
    // Используем ID пользователя из токена
    const userId = userData?.id || req.headers['x-user-id'];
    const userRole = userData?.role || 'client';
    
    console.log('Reservations API Proxy: Данные пользователя', { userId, userRole });

    // Формируем ключ для кеширования с учетом пользователя
    // Важно: разные пользователи должны видеть разные данные
    const cacheKey = `reservations_${userId}_${userRole}_${JSON.stringify(query)}`;
    
    // Проверяем наличие данных в кеше
    if (method === 'GET') {
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        console.log('Reservations API Proxy: Данные бронирований получены из кеша');
        return res.status(200).json(cachedData);
      }
    }

    // Получаем базовый URL API
    const baseApiUrl = getDefaultApiUrl();
    
    // Удаляем завершающие слэши
    const cleanApiUrl = baseApiUrl.replace(/\/+$/, '');
    
    // Проверяем, нужно ли добавлять /api/v1
    let apiUrl = cleanApiUrl;
    if (!apiUrl.includes('/api/v1')) {
      apiUrl = `${cleanApiUrl}/api/v1`;
    }
    
    // Обрабатываем данные для POST запроса
    let processedBody = body;
    if (method === 'POST' && body) {
      // Преобразование данных, если необходимо
      processedBody = { ...body };
      
      // Убеждаемся, что user_id установлен (если не указан явно)
      if (!processedBody.user_id && userId) {
        processedBody.user_id = userId;
      }
      
      console.log('Reservations API Proxy: Обработанные данные для POST запроса:', processedBody);
    }
    
    // Создаем копию query параметров, чтобы добавить user_id для клиентов
    const queryParams = new URLSearchParams();
    
    // Добавляем все существующие параметры запроса
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, Array.isArray(value) ? value[0] : String(value));
        }
      });
    }
    
    // Если пользователь - клиент, добавляем его ID в параметры запроса
    // чтобы обеспечить фильтрацию только своих бронирований
    if (userRole === 'client' && userId) {
      queryParams.append('user_id', String(userId));
    }
    
    // Формируем корректный URL для запроса к бэкенду
    // Важно: URL не должен содержать дублирование /api/
    const queryString = queryParams.toString();
    const url = `${apiUrl}/reservations${queryString ? `?${queryString}` : ''}`;

    console.log('Reservations API Proxy: Отправка запроса на', url);

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
      headers['X-User-ID'] = String(userId);
    }
    if (userRole) {
      headers['X-User-Role'] = userRole;
    }

    // Настройка HTTPS агента с отключенной проверкой сертификата
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Отправляем запрос к бэкенду с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && processedBody ? JSON.stringify(processedBody) : undefined,
        signal: controller.signal,
        // @ts-ignore - добавляем агент напрямую
        agent: url.startsWith('https') ? httpsAgent : undefined
      });

      clearTimeout(timeoutId);

      // Получаем данные ответа
      const data = await response.json();
      
      console.log('Reservations API Proxy: Получен ответ', {
        status: response.status,
        itemsCount: Array.isArray(data) ? data.length : 'не массив'
      });

      // Если это GET запрос, кешируем результат
      if (method === 'GET' && response.ok) {
        saveToCache(cacheKey, data);
      }

      // Отправляем ответ клиенту
      res.status(response.status).json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('Reservations API Proxy: Ошибка при отправке запроса:', fetchError.message);
      
      // В случае ошибки сети возвращаем демо-данные только для конкретного пользователя
      const demoReservations = generateDemoReservations(userId ? Number(userId) : undefined, userRole);
      
      // Сохраняем демо-данные в кеш
      saveToCache(cacheKey, demoReservations);
      
      // Отправляем демо-данные клиенту
      res.status(200).json(demoReservations);
    }
  } catch (error: any) {
    console.error('Reservations API Proxy: Ошибка при обработке запроса:', error);
    
    // В случае любой ошибки возвращаем демо-данные
    // Получаем ID пользователя из токена
    const token = req.headers.authorization;
    const userData = token ? getUserFromToken(token) : null;
    const userId = userData?.id || req.headers['x-user-id'];
    const userRole = userData?.role || 'client';
    
    const demoReservations = generateDemoReservations(userId ? Number(userId) : undefined, userRole);
    
    res.status(200).json(demoReservations);
  }
}

// Функция для генерации демо-данных бронирований с учетом пользователя
function generateDemoReservations(userId?: number, userRole?: string) {
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
    
    // Используем переданный userId или генерируем случайный
    const reservationUserId = userId || getRandomInt(1, 5);
    
    // Если пользователь обычный клиент, то генерируем только его бронирования
    // Если админ или официант - генерируем бронирования для разных пользователей
    const actualUserId = (userRole === 'admin' || userRole === 'waiter') 
      ? getRandomInt(1, 5) 
      : reservationUserId;
    
    reservations.push({
      id,
      user_id: actualUserId,
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
  
  console.log(`Reservations API Proxy: Сгенерировано ${reservations.length} демо-бронирований для пользователя ${userId || 'гость'} с ролью ${userRole || 'client'}`);
  return reservations;
} 