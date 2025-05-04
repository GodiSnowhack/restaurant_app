import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API-прокси для обновления токена авторизации
 */
export default async function refreshTokenHandler(req: NextApiRequest, res: NextApiResponse) {
  // Устанавливаем CORS заголовки
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Обрабатываем предварительные запросы CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Проверяем метод запроса
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Метод не поддерживается'
    });
  }

  try {
    // Проверяем наличие refresh_token
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствует refresh_token'
      });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const endpoint = `${apiUrl}/token`;

    console.log('Auth API - Отправка запроса на обновление токена');

    try {
      // Отправляем запрос на бэкенд, используя формат урленкода для обновления токена
      const response = await axios.post(endpoint, 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      // Если получили успешный ответ
      if (response.data.access_token) {
        console.log('Auth API - Успешно получен новый токен');
        return res.status(200).json(response.data);
      } else {
        console.log('Auth API - Получен ответ, но без токена:', response.data);
        return res.status(401).json({
          success: false,
          message: 'Не удалось получить новый токен'
        });
      }
    } catch (apiError: any) {
      console.error('Auth API - Ошибка при обновлении токена:', apiError.message);
      
      // Возвращаем ошибку клиенту
      if (apiError.response) {
        return res.status(apiError.response.status).json({
          success: false,
          message: 'Ошибка авторизации',
          error: apiError.response.data
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Ошибка соединения с сервером авторизации',
          error: apiError.message
        });
      }
    }
  } catch (error: any) {
    console.error('Auth API - Критическая ошибка:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error.message
    });
  }
} 