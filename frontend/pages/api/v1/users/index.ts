import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../../lib/utils/api';

/**
 * API-прокси для управления пользователями
 * Перенаправляет запросы с фронтенда на бэкенд с авторизацией
 */
export default async function usersHandler(req: NextApiRequest, res: NextApiResponse) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE,PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-ID, X-User-Role'
  );

  // Обработка префлайт-запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Получаем токен авторизации
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Отсутствует токен авторизации'
    });
  }

  // Получаем ID и роль пользователя
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId || !userRole) {
    return res.status(400).json({
      success: false,
      message: 'Отсутствуют необходимые заголовки пользователя'
    });
  }

  try {
    // Используем безопасный URL для API
    const baseUrl = getSecureApiUrl();
    
    // Формируем URL с параметрами
    const queryParams = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value as string);
      }
    });
    
    const url = `${baseUrl}/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    console.log('Отправка запроса к:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-ID': userId as string,
        'X-User-Role': userRole as string
      }
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Ошибка при получении пользователей:', error);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
} 