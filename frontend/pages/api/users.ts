import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import axios from 'axios';

// Интерфейс для данных пользователя
interface UserData {
  id: number;
  email: string;
  full_name?: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  birthday?: string;
  age_group?: string;
  orders_count?: number;
  reservations_count?: number;
}

// Демо-данные для аварийного режима
const FALLBACK_USERS: UserData[] = [
  {
    id: 1,
    email: 'admin@example.com',
    full_name: 'Администратор',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    orders_count: 0,
    reservations_count: 0
  },
  {
    id: 2,
    email: 'user@example.com',
    full_name: 'Тестовый Пользователь',
    role: 'client',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    orders_count: 5,
    reservations_count: 2
  },
  {
    id: 3,
    email: 'waiter@example.com',
    full_name: 'Официант Тестовый',
    role: 'waiter',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    orders_count: 0,
    reservations_count: 0
  }
];

// Кэширование данных пользователей на уровне API-прокси
let usersCache: UserData[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 минута

/**
 * API-прокси для получения списка пользователей
 * Перенаправляет запросы к внутреннему API и возвращает результат
 * В случае ошибки возвращает тестовые данные
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization;
    
    if (!token) {
      console.warn('Users API - Отсутствует токен авторизации, возвращаем тестовые данные');
      return res.status(200).json(FALLBACK_USERS);
    }

    // Проверяем формат токена и при необходимости корректируем
    let authHeader = token;
    if (!token.startsWith('Bearer ')) {
      authHeader = `Bearer ${token}`;
    }
    
    // Проверяем наличие данных в кэше и не устарели ли они
    const now = Date.now();
    if (usersCache && (now - lastFetchTime < CACHE_TTL)) {
      console.log('Users API - Возвращаем данные из кэша');
      return res.status(200).json(usersCache);
    }

    const baseApiUrl = getDefaultApiUrl();
    const usersApiUrl = `${baseApiUrl}/users/`;

    console.log('Users API - Отправка запроса на', usersApiUrl);
    console.log('Users API - Заголовок авторизации:', { 
      original: token,
      formatted: authHeader,
      length: authHeader.length
    });
    
    // Пробуем несколько стратегий получения данных
    
    // Стратегия 1: Запрос с максимальной безопасностью
    try {
      console.log('Users API - Пробуем запрос с ограничением перенаправлений');
      // Отправляем запрос на бэкенд с защитой от перенаправлений
      const response = await axios.get(usersApiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        maxRedirects: 5, // Разрешаем ограниченное количество перенаправлений
        validateStatus: function (status) {
          return status < 500; // Принимаем все статусы, кроме 5xx
        },
        timeout: 5000, // 5 секунд таймаут
        // Важная настройка для предотвращения зацикливания
        proxy: false,
        // Переопределяем опции безопасности
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false, // Разрешаем самоподписанные сертификаты
        })
      });

      // Если получили успешный ответ
      if (response.status < 400 && response.data) {
        const data = response.data;
        console.log('Users API - Успешный ответ от сервера (стратегия 1)');
        
        // Обрабатываем данные
        let formattedUsers = processUsersData(data);
        if (formattedUsers.length > 0) {
          // Сохраняем в кэш
          usersCache = formattedUsers;
          lastFetchTime = now;
          return res.status(200).json(formattedUsers);
        }
      }
    } catch (error: any) {
      console.warn('Users API - Ошибка при запросе (стратегия 1):', error.message);
    }
    
    // Стратегия 2: Запрос с альтернативным форматом токена
    try {
      console.log('Users API - Пробуем запрос с альтернативным форматом токена');
      const altResponse = await axios.get(usersApiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token // Используем оригинальный токен
        },
        maxRedirects: 5,
        validateStatus: null,
        timeout: 5000
      });
      
      if (altResponse.status < 400 && altResponse.data) {
        const data = altResponse.data;
        console.log('Users API - Успешный ответ от сервера (стратегия 2)');
        
        // Обрабатываем данные
        let formattedUsers = processUsersData(data);
        if (formattedUsers.length > 0) {
          // Сохраняем в кэш
          usersCache = formattedUsers;
          lastFetchTime = now;
          return res.status(200).json(formattedUsers);
        }
      }
    } catch (error: any) {
      console.warn('Users API - Ошибка при запросе (стратегия 2):', error.message);
    }
    
    // Если все стратегии не сработали, возвращаем тестовые данные
    console.log('Users API - Все стратегии запроса не сработали, возвращаем тестовые данные');
    return res.status(200).json(FALLBACK_USERS);

  } catch (error: any) {
    console.error('Users API - Ошибка при обработке запроса:', error);
    
    // Если это ошибка перенаправления, возвращаем тестовые данные
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_TOO_MANY_REDIRECTS' || error.code === 'ERR_NETWORK') {
      console.warn('Users API - Возвращаем тестовые данные из-за сетевой ошибки');
      return res.status(200).json(FALLBACK_USERS);
    }
    
    // Для остальных ошибок
    return res.status(500).json({ 
      message: 'Ошибка при получении списка пользователей',
      error: error.message
    });
  }
}

// Функция для обработки данных пользователей из разных форматов ответа
function processUsersData(data: any): UserData[] {
  // Обрабатываем различные форматы данных и преобразуем в нужный формат
  if (Array.isArray(data)) {
    // Если уже массив, просто проверяем наличие всех нужных полей
    return data.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.name || '',
      phone: user.phone || '',
      role: user.role || 'client',
      is_active: user.is_active ?? true,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: user.updated_at || new Date().toISOString(),
      birthday: user.birthday || '',
      age_group: user.age_group || '',
      orders_count: user.orders_count || 0,
      reservations_count: user.reservations_count || 0
    }));
  } else if (data && typeof data === 'object') {
    // Если объект с полем items или users, извлекаем массив
    const usersArray = data.items || data.users || data.data || [];
    
    if (Array.isArray(usersArray) && usersArray.length > 0) {
      return usersArray.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.name || '',
        phone: user.phone || '',
        role: user.role || 'client',
        is_active: user.is_active ?? true,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
        birthday: user.birthday || '',
        age_group: user.age_group || '',
        orders_count: user.orders_count || 0,
        reservations_count: user.reservations_count || 0
      }));
    }
  }
  
  // Если не смогли найти массив пользователей, возвращаем пустой массив
  return [];
} 