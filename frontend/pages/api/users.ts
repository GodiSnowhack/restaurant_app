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

/**
 * API-прокси для получения списка пользователей
 * Перенаправляет запросы к внутреннему API и возвращает результат
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
      return res.status(401).json({
        detail: 'Отсутствует токен авторизации'
      });
    }

    const baseApiUrl = getDefaultApiUrl();
    const usersApiUrl = `${baseApiUrl}/users`;

    console.log('Users API - Отправка запроса на', usersApiUrl);

    // Отправляем запрос на бэкенд
    const response = await axios.get(usersApiUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 500; // Принимаем все статусы, кроме 5xx
      },
      timeout: 10000 // 10 секунд таймаут
    });

    // Если ответ не успешный, возвращаем ошибку
    if (response.status >= 400) {
      console.error('Users API - Ошибка от сервера:', {
        status: response.status,
        data: response.data
      });
      
      return res.status(response.status).json({
        detail: response.data.detail || 'Ошибка при получении списка пользователей'
      });
    }

    const data = response.data;

    console.log('Users API - Ответ от сервера:', {
      status: response.status,
      usersCount: Array.isArray(data) ? data.length : 'не массив',
      dataType: typeof data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
    });

    // Обрабатываем различные форматы данных и преобразуем в нужный формат
    let formattedUsers: UserData[];
    
    if (Array.isArray(data)) {
      // Если уже массив, просто проверяем наличие всех нужных полей
      formattedUsers = data.map(user => ({
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
        formattedUsers = usersArray.map(user => ({
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
      } else {
        // Если не смогли найти массив пользователей
        console.warn('Users API - Не найден массив пользователей в ответе');
        return res.status(500).json({
          detail: 'Неверный формат данных от сервера'
        });
      }
    } else {
      // Если неизвестный формат
      console.warn('Users API - Неизвестный формат данных');
      return res.status(500).json({
        detail: 'Неверный формат данных от сервера'
      });
    }

    // Возвращаем данные клиенту
    return res.status(200).json(formattedUsers);
  } catch (error: any) {
    console.error('Users API - Ошибка:', error);
    
    // Формируем сообщение об ошибке
    const errorMessage = error.response?.data?.detail || error.message || 'Внутренняя ошибка сервера';
    const statusCode = error.response?.status || 500;
    
    return res.status(statusCode).json({
      detail: errorMessage
    });
  }
} 