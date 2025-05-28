import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultApiUrl } from '../../src/config/defaults';
import axios from 'axios';

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
      usersCount: Array.isArray(data) ? data.length : 'не массив'
    });

    // Возвращаем данные клиенту
    return res.status(200).json(data);
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