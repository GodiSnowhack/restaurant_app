import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getSecureApiUrl } from '../../../../lib/utils/api';

/**
 * API-прокси для управления пользователями
 * Перенаправляет запросы с фронтенда на бэкенд с авторизацией
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const queryParams = new URLSearchParams(req.query as Record<string, string>);
    const url = `${baseUrl}/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    console.log('Прокси: отправка запроса к:', url);
    console.log('Прокси: заголовки:', {
      userId,
      userRole,
      hasToken: !!token
    });
    
    const response = await axios({
      method: req.method,
      url: url,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-ID': userId as string,
        'X-User-Role': userRole as string
      },
      data: req.body,
      validateStatus: function (status) {
        return status < 500; // Разрешаем все статусы < 500
      }
    });

    // Проверяем статус ответа
    if (response.status === 401) {
      console.log('Прокси: ошибка авторизации');
      return res.status(401).json({
        success: false,
        message: 'Ошибка авторизации'
      });
    }

    if (response.status === 403) {
      console.log('Прокси: недостаточно прав');
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для выполнения операции'
      });
    }

    if (response.status !== 200) {
      console.log('Прокси: неожиданный статус ответа:', response.status);
      return res.status(response.status).json({
        success: false,
        message: 'Ошибка при получении данных',
        error: response.data
      });
    }

    // Возвращаем данные
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Прокси: ошибка при получении пользователей:', error);
    
    // Проверяем тип ошибки
    if (error.response) {
      // Ответ получен, но статус не 2xx
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Ошибка при получении данных',
        error: error.message
      });
    } else if (error.request) {
      // Запрос отправлен, но ответ не получен
      return res.status(503).json({
        success: false,
        message: 'Сервер недоступен',
        error: error.message
      });
    } else {
      // Ошибка при настройке запроса
      return res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера',
        error: error.message
      });
    }
  }
} 